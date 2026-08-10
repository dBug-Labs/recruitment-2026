/**
 * app/api/admin/assignments/[assignmentId]/route.js
 *
 * PATCH /api/admin/assignments/:assignmentId
 *
 * Two jobs, either or both in one call:
 *   • { score, feedback } — records a review and marks the assignment reviewed
 *   • { dueAt, reason }   — extends the deadline and emails the candidate
 *
 * Extending a deadline deliberately does NOT touch the status: an unsubmitted
 * task must stay "assigned" after being given more time.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff, hasDomainAccess, actorRef, withErrorHandling } from "@/lib/rbac";
import { AssignmentPatchSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { sendDeadlineExtended } from "@/lib/email";
import { ObjectId } from "mongodb";

export const PATCH = withErrorHandling(async function handler(request, { params }) {
  const { assignmentId } = await params;
  const session = await auth();
  const user = requireStaff(session);

  if (!ObjectId.isValid(assignmentId)) return jsonError("Invalid assignment id", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = AssignmentPatchSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? "general";
      if (!errors[field]) errors[field] = issue.message;
    }
    return jsonError("Invalid update", 422, { fields: errors });
  }

  const col = await getCollection("assignments");
  const assignment = await col.findOne({ _id: new ObjectId(assignmentId) });
  if (!assignment) return jsonError("Assignment not found", 404);

  if (!hasDomainAccess(user, [assignment.domain])) {
    return jsonError("Forbidden: outside your domains", 403);
  }

  const { score, feedback, dueAt, reason } = parsed.data;
  const now = new Date();
  const update = { updatedAt: now };

  const isReview = score !== undefined || feedback !== undefined;
  if (isReview) {
    update.score = score ?? null;
    update.feedback = feedback ?? "";
    update.status = "reviewed";
    update.reviewedBy = actorRef(user);
    update.reviewedAt = now;
  }

  const newDueAt = dueAt ? new Date(dueAt) : null;
  if (newDueAt) {
    if (assignment.dueAt && newDueAt <= new Date(assignment.dueAt)) {
      return jsonError("The new deadline has to be later than the current one.", 422, {
        fields: { dueAt: "Must be later than the current deadline" },
      });
    }
    update.dueAt = newDueAt;
    update.deadlineHistory = [
      ...(assignment.deadlineHistory ?? []),
      { from: assignment.dueAt ?? null, to: newDueAt, reason: reason ?? "", by: actorRef(user), at: now },
    ];
  }

  await col.updateOne({ _id: assignment._id }, { $set: update });

  // Tell the candidate they have more time — non-blocking
  if (newDueAt) {
    try {
      const [apps, tasks] = await Promise.all([getCollection("applications"), getCollection("tasks")]);
      const [application, task] = await Promise.all([
        apps.findOne({ _id: assignment.applicationId }),
        tasks.findOne({ _id: assignment.taskId }),
      ]);
      if (application?.srmEmail) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
        sendDeadlineExtended({
          name: application.name,
          email: application.srmEmail,
          taskTitle: task?.title ?? "your task",
          dueAt: newDueAt,
          dashboardUrl: `${baseUrl}/dashboard/tasks`,
          reason,
        }).catch((err) => console.error("[email] Deadline extension notice failed:", err));
      }
    } catch (err) {
      console.error("[assignments] could not send extension notice:", err);
    }
  }

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: newDueAt ? (isReview ? "REVIEW_AND_EXTEND" : "EXTEND_DEADLINE") : "REVIEW_SUBMISSION",
    target: { collection: "assignments", id: assignmentId },
    before: { score: assignment.score ?? null, status: assignment.status, dueAt: assignment.dueAt ?? null },
    after: { score: update.score ?? assignment.score ?? null, status: update.status ?? assignment.status, dueAt: update.dueAt ?? assignment.dueAt ?? null },
    ip: request.headers.get("x-forwarded-for") || "unknown",
  });

  return new Response(
    JSON.stringify({ success: true, dueAt: (update.dueAt ?? assignment.dueAt)?.toISOString?.() ?? null }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
