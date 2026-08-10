/**
 * app/api/admin/applications/[id]/route.js
 *
 * PATCH /api/admin/applications/:id — move an application through the pipeline.
 *
 * Transitions are validated against STATUS_TRANSITIONS. An admin may pass
 * `force: true` to correct a mistake and jump to any status; domain leads
 * always have to follow the lifecycle.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import { requireStaff, hasDomainAccess, ROLES, withErrorHandling } from "@/lib/rbac";
import { StatusTransitionSchema, STATUS_TRANSITIONS, domainKeys } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { sendResultNotification, sendInterviewShortlist } from "@/lib/email";

export const PATCH = withErrorHandling(async function handler(request, { params }) {
  const { id } = await params;
  const session = await auth();
  const user = requireStaff(session);

  if (!ObjectId.isValid(id)) return jsonError("Invalid application id", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = StatusTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid status", 422);
  }

  const { status } = parsed.data;
  const force = body.force === true && user.role === ROLES.ADMIN;

  const col = await getCollection("applications");
  const application = await col.findOne({ _id: new ObjectId(id) });

  if (!application) {
    return jsonError("Application not found", 404);
  }

  // Domain leads may only manage candidates inside their own domains
  const appDomainKeys = application.domainKeys ?? domainKeys(application.domains ?? []);
  if (!hasDomainAccess(user, appDomainKeys)) {
    return jsonError("Forbidden: Cannot manage applications outside your domain", 403);
  }

  if (status === application.status) {
    return json({ success: true, status, unchanged: true });
  }

  const allowed = STATUS_TRANSITIONS[application.status] ?? new Set();
  if (!allowed.has(status) && !force) {
    return jsonError(
      `Cannot move from "${application.status}" to "${status}". Allowed: ${[...allowed].join(", ") || "none"}.`,
      409,
      { allowed: [...allowed] }
    );
  }

  await col.updateOne(
    { _id: application._id },
    { $set: { status, updatedAt: new Date() } }
  );

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: force ? "UPDATE_STATUS_FORCED" : "UPDATE_STATUS",
    target: { collection: "applications", id },
    before: { status: application.status },
    after: { status },
    ip: request.headers.get("x-forwarded-for") || "unknown"
  });

  // Auto-send lifecycle emails — non-blocking, keyed off the candidate's SRM email
  if (status === "interview_scheduled") {
    sendInterviewShortlist({
      name: application.name,
      email: application.srmEmail,
    }).catch(err => console.error("[email] Interview shortlist send failed:", err));
  } else if (status === "selected") {
    sendResultNotification({
      name: application.name,
      email: application.srmEmail,
      selected: true,
      onboardingUrl: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/onboarding` : undefined
    }).catch(err => console.error("[email] Selected send failed:", err));
  } else if (status === "rejected") {
    sendResultNotification({
      name: application.name,
      email: application.srmEmail,
      selected: false
    }).catch(err => console.error("[email] Rejected send failed:", err));
  }

  return json({ success: true, status });
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
