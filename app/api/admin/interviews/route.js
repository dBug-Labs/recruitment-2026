/**
 * app/api/admin/interviews/route.js
 *
 * POST /api/admin/interviews
 *
 * Schedules an interview for an application, moves the application into
 * `interview_scheduled`, and emails the candidate the slot details.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff, hasDomainAccess, actorRef, withErrorHandling } from "@/lib/rbac";
import { InterviewSchema, domainKeys } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { ObjectId } from "mongodb";
import { sendInterviewInvitation } from "@/lib/email";

const DRIVE_ID = process.env.DRIVE_ID ?? "2026";

export const POST = withErrorHandling(async function handler(request) {
  const session = await auth();
  const user = requireStaff(session);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = InterviewSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid interview data", 422, { fields: fieldErrors(parsed.error) });
  }

  const data = parsed.data;

  if (!ObjectId.isValid(data.applicationId)) {
    return jsonError("Invalid application id", 400);
  }

  const col = await getCollection("interviews");
  const appsCol = await getCollection("applications");

  const application = await appsCol.findOne({ _id: new ObjectId(data.applicationId) });
  if (!application) {
    return jsonError("Application not found", 404);
  }

  // Domain leads may only schedule for candidates inside their own domains
  const appDomainKeys = application.domainKeys ?? domainKeys(application.domains ?? []);
  if (!hasDomainAccess(user, appDomainKeys)) {
    return jsonError("Forbidden: application is outside your domains", 403);
  }
  if (!hasDomainAccess(user, [data.domain])) {
    return jsonError("Forbidden: you do not own this domain", 403);
  }

  const now = new Date();
  const doc = {
    ...data,
    applicationId: new ObjectId(data.applicationId),
    slotAt:        new Date(data.slotAt),
    driveId:       DRIVE_ID,
    status:        "scheduled",
    scheduledBy:   actorRef(user),
    createdAt:     now,
    updatedAt:     now,
  };

  const result = await col.insertOne(doc);

  await appsCol.updateOne(
    { _id: application._id },
    { $set: { status: "interview_scheduled", updatedAt: now } }
  );

  // Non-blocking — a mail failure must not lose the scheduled interview
  sendInterviewInvitation({
    name:     application.name,
    email:    application.srmEmail,
    slotAt:   doc.slotAt,
    mode:     data.mode,
    location: data.location,
  }).catch((err) => console.error("[email] Failed to send interview invite:", err));

  await logAudit({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "SCHEDULE_INTERVIEW",
    target:     { collection: "interviews", id: result.insertedId.toString() },
    before:     null,
    after:      { applicationId: data.applicationId, slotAt: doc.slotAt, mode: data.mode },
    ip:         request.headers.get("x-forwarded-for") || "unknown",
  });

  return new Response(
    JSON.stringify({ success: true, interviewId: result.insertedId.toString() }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
});

function fieldErrors(error) {
  const errors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] ?? "general";
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
