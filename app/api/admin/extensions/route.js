/**
 * app/api/admin/extensions/route.js
 *
 * POST /api/admin/extensions
 *
 * One extension, applied to every unsubmitted candidate who is running out of
 * time.
 *
 * Doing this candidate by candidate through PATCH /api/admin/assignments/:id
 * is the same work N times over, and half way through a drive N is in the
 * hundreds — so this takes the length of the extension and the filters, and
 * does the whole set in one write.
 *
 * ─── Three things worth knowing ──────────────────────────────────────────────
 *
 *  1. **Days, not a date.** Each candidate's new deadline is counted from
 *     whichever is later, their current deadline or now. An already-overdue
 *     candidate therefore gets the full N days rather than none, and nobody's
 *     deadline is ever pulled *forward* by a shared date that happened to fall
 *     before their own.
 *
 *  2. **`withinHours` is who, not when.** It selects on time *remaining*, so
 *     it is a cutoff ahead of now and everyone past it is already included:
 *     24 means "under a day left", and someone three days overdue is under a
 *     day left by a wide margin. Candidates with no deadline at all are never
 *     matched — `$lt` against a date does not select null in a query filter,
 *     which is the behaviour wanted here rather than an accident.
 *
 *  3. **The mail is best-effort, the deadline is not.** Every deadline is
 *     written before a single email is attempted, so a slow SMTP server or a
 *     serverless timeout can never leave half the drive extended. Sends then
 *     run inline until the function is nearly out of time; the rest are queued
 *     for `npm run flush-outbox`. The response says which is which.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff, hasDomainAccess, actorRef, withErrorHandling } from "@/lib/rbac";
import { BulkExtendSchema } from "@/lib/schemas";
// The panel's own scoping rule, reused rather than restated — a second copy
// of "which domains may this user see" is exactly how one of them drifts.
import { domainScope } from "@/app/(admin)/admin/_components/scope";
import { logAudit } from "@/lib/audit";
import { sendDeadlineExtended } from "@/lib/email";
import { ObjectId } from "mongodb";

/** Sends are paced ~900ms apart, so this is measured in tens of seconds. */
export const maxDuration = 60;

/**
 * When to stop sending inline and start queueing. Comfortably inside
 * maxDuration so the response — which is the only record of what was queued —
 * still gets out.
 */
const SEND_BUDGET_MS = 40_000;

const CHUNK_SIZE  = 10;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY  = 24 * MS_PER_HOUR;

export const POST = withErrorHandling(async function handler(request) {
  const startedAt = Date.now();
  const session = await auth();
  const user = requireStaff(session);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = BulkExtendSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? "general";
      if (!errors[field]) errors[field] = issue.message;
    }
    return jsonError("Invalid extension", 422, { fields: errors });
  }

  const { days, taskId, domain, withinHours, notify, reason, dryRun } = parsed.data;

  if (taskId && !ObjectId.isValid(taskId)) return jsonError("Invalid task id", 400);
  if (domain && !hasDomainAccess(user, [domain])) {
    return jsonError("Forbidden: outside your domains", 403);
  }

  const now = new Date();

  // domainScope() is what keeps a domain lead inside their own domains; an
  // explicit `domain` only ever narrows further, never widens.
  const extra = { status: "assigned" };
  if (taskId) extra.taskId = new ObjectId(taskId);
  if (domain) extra.domain = domain;
  if (withinHours !== undefined) {
    extra.dueAt = { $lt: new Date(now.getTime() + withinHours * MS_PER_HOUR) };
  }

  const assignmentsCol = await getCollection("assignments");
  const rows = await assignmentsCol
    .aggregate([
      { $match: domainScope(user, extra) },
      { $sort: { dueAt: 1 } },
      { $lookup: { from: "applications", localField: "applicationId", foreignField: "_id", as: "application" } },
      { $lookup: { from: "tasks",        localField: "taskId",        foreignField: "_id", as: "task" } },
      { $unwind: { path: "$application", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$task",        preserveNullAndEmptyArrays: true } },
      { $project: {
          dueAt: 1,
          "application.name": 1,
          "application.srmEmail": 1,
          "task.title": 1,
      } },
    ])
    .toArray();

  if (dryRun) {
    return json({
      success: true,
      dryRun: true,
      matched: rows.length,
      overdue: rows.filter((r) => r.dueAt && new Date(r.dueAt) < now).length,
    });
  }

  if (rows.length === 0) {
    return json({ success: true, matched: 0, extended: 0, sent: 0, queued: 0, failed: [] });
  }

  // ─── The deadlines ──────────────────────────────────────────────────────────

  const targets = rows.map((row) => {
    const current = row.dueAt ? new Date(row.dueAt) : null;
    const base = current && current > now ? current : now;
    return { row, from: current, to: new Date(base.getTime() + days * MS_PER_DAY) };
  });

  const writeResult = await assignmentsCol.bulkWrite(
    targets.map(({ row, from, to }) => ({
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set:  { dueAt: to, updatedAt: now },
          // $push, not a read-and-rewrite of the array — two admins extending
          // at once would otherwise each drop the other's entry.
          $push: { deadlineHistory: { from, to, reason: reason ?? "", by: actorRef(user), at: now } },
        },
      },
    })),
    { ordered: false }
  );

  const extended = writeResult.modifiedCount ?? 0;

  // ─── The mail ───────────────────────────────────────────────────────────────

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  let sent = 0;
  let queued = 0;
  const failed = [];

  if (notify) {
    const recipients = targets.filter(({ row }) => row.application?.srmEmail);

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      // Past the budget the remaining mail is queued rather than sent, so the
      // response still makes it back to say so.
      const background = Date.now() - startedAt > SEND_BUDGET_MS;
      const chunk = recipients.slice(i, i + CHUNK_SIZE);

      const results = await Promise.allSettled(
        chunk.map(({ row, to }) =>
          sendDeadlineExtended({
            name:         row.application.name,
            email:        row.application.srmEmail,
            taskTitle:    row.task?.title ?? "your task",
            dueAt:        to,
            dashboardUrl: `${baseUrl}/dashboard/tasks`,
            reason,
            bulk:         true,
            background,
          })
        )
      );

      results.forEach((result, idx) => {
        if (result.status !== "fulfilled") failed.push(chunk[idx].row.application.srmEmail);
        else if (background) queued += 1;
        else sent += 1;
      });
    }
  }

  await logAudit({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "BULK_EXTEND_DEADLINE",
    target:     { collection: "assignments", id: `${taskId ?? "all"}:${domain ?? "all"}:${withinHours ?? "any"}h` },
    before:     { matched: rows.length },
    after:      { days, withinHours: withinHours ?? null, extended, reason: reason ?? "", notify, sent, queued, failed: failed.length },
    ip:         request.headers.get("x-forwarded-for") || "unknown",
  });

  return json({ success: true, matched: rows.length, extended, sent, queued, failed });
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, status);
}
