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
import { sendResultNotification, sendShortlistNotification, sendInterviewShortlist } from "@/lib/email";

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

  const { emailSent, emailError } = await notifyCandidate(status, application);

  return json({ success: true, status, emailSent, ...(emailError ? { emailError } : {}) });
});

/**
 * The lifecycle mail for a status move, keyed off the candidate's SRM email.
 *
 * Awaited, not detached. These were fire-and-forget `.catch()` calls, which on
 * serverless means the promise is killed the instant the response returns — the
 * status flipped in the panel and no mail was ever sent, with only a log line
 * that nobody was around to read. Awaiting costs the request a second and makes
 * the outcome something the admin can actually see.
 *
 * A failure is reported, never thrown: the status change is already committed
 * and re-sending a mail is cheap, so losing the transition would be the worse
 * trade.
 *
 * @returns {Promise<{ emailSent: boolean, emailError: string|null }>}
 */
async function notifyCandidate(status, application) {
  const to = {
    name: application.name,
    email: application.srmEmail,
    domain: application.assignedDomain || (application.assignedDomains && application.assignedDomains[0])
  };
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  let send;
  switch (status) {
    case "shortlisted":
      send = () => sendShortlistNotification(to);
      break;
    // Moved here by hand rather than through the Schedule-an-interview modal,
    // so there is no slot to quote yet. POST /api/admin/interviews sends the
    // invitation with the actual date; this one only says "you're through, the
    // slot is coming" — without it this transition mailed nothing at all.
    case "interview_scheduled":
      send = () => sendInterviewShortlist(to);
      break;
    case "selected":
      send = () => sendResultNotification({
        ...to,
        selected: true,
        onboardingUrl: baseUrl ? `${baseUrl}/onboarding` : undefined,
      });
      break;
    case "rejected":
      send = () => sendResultNotification({ ...to, selected: false });
      break;
    default:
      return { emailSent: false, emailError: null };
  }

  try {
    await send();
    return { emailSent: true, emailError: null };
  } catch (err) {
    console.error(
      `[email] ${status} → ${application.srmEmail} failed (${err.outboxStatus ?? "unknown"}):`,
      err.message
    );
    return { emailSent: false, emailError: err.message };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, status);
}
