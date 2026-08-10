/**
 * app/api/submissions/route.js
 *
 * POST /api/submissions
 *
 * A candidate submits (or re-submits) work for an assignment they own.
 * Every submission is appended to `history`; the latest one also lands on
 * `submission` so the dashboard and admin views can read it directly.
 */

import { sendTaskSubmissionReceipt } from "@/lib/email";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { TaskSubmissionSchema } from "@/lib/schemas";
import { requireAuth, withErrorHandling } from "@/lib/rbac";
import { ObjectId } from "mongodb";

export const POST = withErrorHandling(async function handler(request) {
  const session = await auth();
  const user = requireAuth(session);

  if (!user.applicationId || !ObjectId.isValid(user.applicationId)) {
    return jsonError("No application found for this user", 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = TaskSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? "general";
      if (!errors[field]) errors[field] = issue.message;
    }
    return jsonError("Validation failed", 422, { fields: errors });
  }

  const data = parsed.data;
  if (!ObjectId.isValid(data.assignmentId)) {
    return jsonError("Assignment not found or access denied", 404);
  }

  const assignmentsCol = await getCollection("assignments");
  const applicationsCol = await getCollection("applications");
  const tasksCol = await getCollection("tasks");

  // Ownership check is part of the query — a candidate can only ever write to
  // an assignment whose applicationId matches their session.
  const assignment = await assignmentsCol.findOne({
    _id: new ObjectId(data.assignmentId),
    applicationId: new ObjectId(user.applicationId),
  });

  if (!assignment) {
    return jsonError("Assignment not found or access denied", 404);
  }

  // Honour the task's accepted link type
  const task = await tasksCol.findOne({ _id: assignment.taskId });
  if (task?.submissionType && task.submissionType !== "either" && task.submissionType !== data.type) {
    return jsonError(
      `This task only accepts ${task.submissionType === "github" ? "GitHub" : "Google Drive"} submissions.`,
      422,
      { fields: { type: `Must be a ${task.submissionType} link` } }
    );
  }

  const now = new Date();
  const dueAt = assignment.dueAt ? new Date(assignment.dueAt) : null;

  const submissionRecord = {
    type:        data.type,
    url:         data.url,
    notes:       data.notes,
    submittedAt: now,
    late:        dueAt ? now > dueAt : false,
  };

  await assignmentsCol.updateOne(
    { _id: assignment._id },
    {
      $set: {
        submission: submissionRecord,
        status:     "submitted",
        updatedAt:  now,
      },
      $push: { history: submissionRecord },
    }
  );

  // Only advance the application if it is still waiting on this task
  await applicationsCol.updateOne(
    { _id: new ObjectId(user.applicationId), status: "task_assigned" },
    { $set: { status: "task_submitted", updatedAt: now } }
  );

  // Send submission receipt — non-blocking
  try {
    const application = await applicationsCol.findOne({ _id: new ObjectId(user.applicationId) });
    if (application?.srmEmail) {
      sendTaskSubmissionReceipt({
        name: application.name,
        email: application.srmEmail,
        taskTitle: task?.title ?? "your task",
        late: submissionRecord.late,
      }).catch((err) => console.error("[email] Submission receipt failed:", err));
    }
  } catch (err) {
    console.error("[submissions] could not send submission receipt:", err);
  }

  return new Response(JSON.stringify({ success: true, late: submissionRecord.late }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
