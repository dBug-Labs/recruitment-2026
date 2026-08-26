/**
 * app/api/admin/outbox/route.js
 *
 * GET  /api/admin/outbox — what is queued and what is left of today's budget.
 * POST /api/admin/outbox — deliver whatever is due, right now.
 *
 * This is `npm run flush-outbox` with a button on it. The script still exists
 * and still works; it just should not be the only way to get a stuck message
 * out, because it needs a laptop with the production connection string on it.
 *
 * ─── Why the run is bounded ──────────────────────────────────────────────────
 *
 * Sends are paced ~900ms apart, so a backlog of any size outlasts a serverless
 * request. The pump is handed a deadline a few seconds inside `maxDuration` so
 * it stops between messages instead of being killed inside one — a row cut off
 * mid-send sits in `sending` until the stale-claim sweep frees it. Whatever is
 * left stays pending and the response says so, so pressing the button again is
 * the right move rather than a gamble.
 */

import { auth } from "@/lib/auth";
import { requireAdmin, requireStaff, withErrorHandling } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { flushOutbox, quotaSnapshot, outboxSummary } from "@/lib/email";

/** The pump paces its sends, so this is a stopwatch, not a formality. */
export const maxDuration = 60;

/** Left for the response to be written after the pump stops claiming work. */
const HEADROOM_MS = 5_000;

export const GET = withErrorHandling(async function handler() {
  const session = await auth();
  requireStaff(session);

  const [quota, outbox] = await Promise.all([quotaSnapshot(), outboxSummary()]);
  return json({ quota, outbox });
});

export const POST = withErrorHandling(async function handler(request) {
  const session = await auth();
  // Reading the queue is staff-wide; draining it spends the shared SMTP budget,
  // which is the same reason bulk announcements are admin-only.
  const user = requireAdmin(session);

  const before = await outboxSummary();
  const pending = before.byStatus.pending ?? 0;

  if (pending === 0) {
    const [quota, outbox] = await Promise.all([quotaSnapshot(), outboxSummary()]);
    return json({ success: true, sent: 0, failed: 0, deferred: 0, pending: 0, quota, outbox });
  }

  const result = await flushOutbox({
    deadline: Date.now() + (maxDuration * 1000 - HEADROOM_MS),
  });

  const [quota, outbox] = await Promise.all([quotaSnapshot(), outboxSummary()]);

  await logAudit({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "FLUSH_OUTBOX",
    target:     { collection: "emailOutbox", id: quota.day },
    before:     { pending },
    after:      { sent: result.sent, failed: result.failed, deferred: result.deferred, stopped: result.stopped },
    ip:         request.headers.get("x-forwarded-for") || "unknown",
  });

  return json({
    success:  true,
    sent:     result.sent,
    failed:   result.failed,
    deferred: result.deferred,
    stopped:  result.stopped,
    pending:  outbox.byStatus.pending ?? 0,
    quota,
    outbox,
  });
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
