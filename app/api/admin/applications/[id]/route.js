import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import { requireAuth, requireRole, ROLES, withErrorHandling } from "@/lib/rbac";
import { StatusTransitionSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { sendResultNotification, sendInterviewShortlist } from "@/lib/email";

export const PATCH = withErrorHandling(async function handler(request, { params }) {
  const { id } = await params;
  const session = await auth();
  const user = requireAuth(session);
  
  // Require Admin or Domain Lead
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.DOMAIN_LEAD) {
    return jsonError("Forbidden", 403);
  }

  const body = await request.json();
  const parsed = StatusTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid status", 400);
  }

  const { status } = parsed.data;

  const col = await getCollection("applications");
  const application = await col.findOne({ _id: new ObjectId(id) });

  if (!application) {
    return jsonError("Application not found", 404);
  }

  // Domain Lead authorization check (cannot change status of candidate applied to unowned domain)
  if (user.role === ROLES.DOMAIN_LEAD) {
      const isOwnedDomain = application.domains.some(d => user.domains.includes(d));
      if (!isOwnedDomain) {
          return jsonError("Forbidden: Cannot manage applications outside your domain", 403);
      }
  }

  // Perform status update
  const result = await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, updatedAt: new Date() } }
  );

  // Audit log
  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE_STATUS",
    target: "APPLICATION",
    before: { status: application.status },
    after: { status },
    ip: request.headers.get("x-forwarded-for") || "unknown"
  });

  // Auto-send emails based on status
  // Notice we use srmEmail
  if (status === "interview_scheduled" && application.status !== "interview_scheduled") {
    sendInterviewShortlist({
      name: application.name,
      email: application.srmEmail,
    }).catch(err => console.error("[email] Interview shortlist send failed:", err));
  } else if (status === "selected" && application.status !== "selected") {
    sendResultNotification({
      name: application.name,
      email: application.srmEmail,
      selected: true,
      onboardingUrl: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/onboarding` : undefined
    }).catch(err => console.error("[email] Selected send failed:", err));
  } else if (status === "rejected" && application.status !== "rejected") {
    sendResultNotification({
      name: application.name,
      email: application.srmEmail,
      selected: false
    }).catch(err => console.error("[email] Rejected send failed:", err));
  }

  return new Response(JSON.stringify({ success: true, status }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
