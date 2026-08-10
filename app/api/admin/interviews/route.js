import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireAuth, ROLES, withErrorHandling } from "@/lib/rbac";
import { InterviewSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { ObjectId } from "mongodb";
import { sendInterviewInvitation } from "@/lib/email";

export const POST = withErrorHandling(async function handler(request) {
  const session = await auth();
  const user = requireAuth(session);
  
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.DOMAIN_LEAD) {
    return jsonError("Forbidden", 403);
  }

  const body = await request.json();
  const parsed = InterviewSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid interview data", 400);
  }

  const data = parsed.data;
  const col = await getCollection("interviews");
  const appsCol = await getCollection("applications");

  // Validate application exists
  const application = await appsCol.findOne({ _id: new ObjectId(data.applicationId) });
  if (!application) {
    return jsonError("Application not found", 404);
  }

  const now = new Date();
  const doc = {
    ...data,
    applicationId: new ObjectId(data.applicationId),
    driveId: process.env.DRIVE_ID ?? "2026",
    status: "scheduled",
    scheduledBy: new ObjectId(user.id),
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(doc);

  // Send Email (Non-blocking)
  sendInterviewInvitation({
    name: application.name,
    email: application.email,
    slot: `${new Date(data.slot.start).toLocaleString()} - ${new Date(data.slot.end).toLocaleTimeString()}`,
    mode: data.mode,
    location: data.location
  }).catch(err => console.error("[email] Failed to send interview invite:", err));

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "SCHEDULE_INTERVIEW",
    target: "APPLICATION",
    before: null,
    after: { applicationId: data.applicationId, interviewId: result.insertedId.toString() },
    ip: request.headers.get("x-forwarded-for") || "unknown"
  });

  return new Response(JSON.stringify({ success: true, interviewId: result.insertedId.toString() }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
});

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
