/**
 * app/api/admin/assignments/route.js
 *
 * POST /api/admin/assignments
 *
 * Hands a task to a candidate: creates the assignment, moves the application
 * into `task_assigned`, and emails the candidate the brief and deadline.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff, hasDomainAccess, actorRef, withErrorHandling } from "@/lib/rbac";
import { AssignmentSchema, domainKeys } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { sendTaskNotification } from "@/lib/email";
import { taskDeadlineFor } from "@/lib/recruitment";
import { ObjectId } from "mongodb";

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

  const parsed = AssignmentSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? "general";
      if (!errors[field]) errors[field] = issue.message;
    }
    return jsonError("Invalid assignment data", 422, { fields: errors });
  }

  const data = parsed.data;
  if (!ObjectId.isValid(data.applicationId)) return jsonError("Invalid application id", 400);
  if (!ObjectId.isValid(data.taskId))        return jsonError("Invalid task id", 400);

  const appsCol        = await getCollection("applications");
  const tasksCol       = await getCollection("tasks");
  const assignmentsCol = await getCollection("assignments");

  const application = await appsCol.findOne({ _id: new ObjectId(data.applicationId) });
  if (!application) return jsonError("Application not found", 404);

  const task = await tasksCol.findOne({ _id: new ObjectId(data.taskId) });
  if (!task) return jsonError("Task not found", 404);

  const appDomainKeys = application.domainKeys ?? domainKeys(application.domains ?? []);
  if (!hasDomainAccess(user, appDomainKeys) || !hasDomainAccess(user, [task.domain])) {
    return jsonError("Forbidden: outside your domains", 403);
  }

  const existing = await assignmentsCol.findOne({
    applicationId: application._id,
    taskId:        task._id,
  });
  if (existing) {
    return jsonError("This task is already assigned to that candidate.", 409, {
      assignmentId: existing._id.toString(),
    });
  }

  const now = new Date();
  // Default to the candidate's own five-day window counted from when they
  // registered, not the task's shared deadline. An explicit dueAt still wins.
  const dueAt = data.dueAt
    ? new Date(data.dueAt)
    : taskDeadlineFor(application.createdAt ?? now);

  const result = await assignmentsCol.insertOne({
    driveId:       DRIVE_ID,
    applicationId: application._id,
    taskId:        task._id,
    domain:        task.domain,
    status:        "assigned",
    dueAt,
    submission:    null,
    history:       [],
    score:         null,
    feedback:      "",
    assignedBy:    actorRef(user),
    assignedAt:    now,
    updatedAt:     now,
  });

  await appsCol.updateOne(
    { _id: application._id },
    { $set: { status: "task_assigned", assignedDomain: task.domain, updatedAt: now } }
  );

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  sendTaskNotification({
    name:         application.name,
    email:        application.srmEmail,
    taskTitle:    task.title,
    dueAt,
    dashboardUrl: `${baseUrl}/dashboard/tasks`,
  }).catch((err) => console.error("[email] Task notification failed:", err));

  await logAudit({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "ASSIGN_TASK",
    target:     { collection: "assignments", id: result.insertedId.toString() },
    before:     { status: application.status },
    after:      { status: "task_assigned", taskId: data.taskId, dueAt },
    ip:         request.headers.get("x-forwarded-for") || "unknown",
  });

  return new Response(
    JSON.stringify({ success: true, assignmentId: result.insertedId.toString() }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
});

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
