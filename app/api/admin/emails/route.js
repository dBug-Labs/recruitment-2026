/**
 * app/api/admin/emails/route.js
 *
 * POST /api/admin/emails
 *
 * Sends an announcement to every candidate matching an optional status and
 * domain filter. Admin only. Sends are chunked so a large drive does not open
 * hundreds of simultaneous SMTP connections, and one bad address never aborts
 * the run — the response reports how many succeeded and failed.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireAdmin, withErrorHandling } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sendAnnouncement } from "@/lib/email";
import { APPLICATION_STATUSES, ALL_DOMAIN_KEYS } from "@/lib/schemas";
import { z } from "zod";

const DRIVE_ID = process.env.DRIVE_ID ?? "2026";
const CHUNK_SIZE = 10;

const AnnouncementSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(150).trim(),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000).trim(),
  status:  z.enum(APPLICATION_STATUSES).optional(),
  domain:  z.enum(ALL_DOMAIN_KEYS).optional(),
  dryRun:  z.boolean().optional().default(false),
});

export const POST = withErrorHandling(async function handler(request) {
  const session = await auth();
  const user = requireAdmin(session);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = AnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? "general";
      if (!errors[field]) errors[field] = issue.message;
    }
    return jsonError("Invalid announcement", 422, { fields: errors });
  }

  const { subject, message, status, domain, dryRun } = parsed.data;

  const query = { driveId: DRIVE_ID };
  if (status) query.status = status;
  if (domain) query.domainKeys = domain;

  const col = await getCollection("applications");
  const recipients = await col
    .find(query, { projection: { name: 1, srmEmail: 1 } })
    .toArray();

  if (dryRun) {
    return json({ success: true, dryRun: true, recipients: recipients.length });
  }

  let sent = 0;
  const failed = [];

  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((r) =>
        sendAnnouncement({ name: r.name, email: r.srmEmail, subject, message })
      )
    );
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") sent += 1;
      else failed.push(chunk[idx].srmEmail);
    });
  }

  await logAudit({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "SEND_BULK_EMAIL",
    target:     { collection: "applications", id: `${status ?? "all"}:${domain ?? "all"}` },
    before:     null,
    after:      { subject, recipients: recipients.length, sent, failed: failed.length },
    ip:         request.headers.get("x-forwarded-for") || "unknown",
  });

  return json({ success: true, recipients: recipients.length, sent, failed });
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
