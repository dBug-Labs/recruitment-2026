/**
 * app/api/admin/tasks/[taskId]/route.js
 *
 * PATCH  /api/admin/tasks/:taskId — edit title, brief, deadline, resources, active
 * DELETE /api/admin/tasks/:taskId — remove a task that has no assignments yet
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff, hasDomainAccess, withErrorHandling } from "@/lib/rbac";
import { TaskUpdateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { ObjectId } from "mongodb";

export const PATCH = withErrorHandling(async function handler(request, { params }) {
  const { taskId } = await params;
  const session = await auth();
  const user = requireStaff(session);

  if (!ObjectId.isValid(taskId)) return jsonError("Invalid task id", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = TaskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? "general";
      if (!errors[field]) errors[field] = issue.message;
    }
    return jsonError("Invalid task data", 422, { fields: errors });
  }

  const col = await getCollection("tasks");
  const task = await col.findOne({ _id: new ObjectId(taskId) });
  if (!task) return jsonError("Task not found", 404);

  if (!hasDomainAccess(user, [task.domain])) {
    return jsonError("Forbidden: task is outside your domains", 403);
  }

  const update = { ...parsed.data, updatedAt: new Date() };
  if (update.dueAt) update.dueAt = new Date(update.dueAt);

  await col.updateOne({ _id: task._id }, { $set: update });

  await logAudit({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "UPDATE_TASK",
    target:     { collection: "tasks", id: taskId },
    before:     { title: task.title, dueAt: task.dueAt, active: task.active },
    after:      update,
    ip:         request.headers.get("x-forwarded-for") || "unknown",
  });

  return json({ success: true });
});

export const DELETE = withErrorHandling(async function handler(request, { params }) {
  const { taskId } = await params;
  const session = await auth();
  const user = requireStaff(session);

  if (!ObjectId.isValid(taskId)) return jsonError("Invalid task id", 400);

  const col = await getCollection("tasks");
  const task = await col.findOne({ _id: new ObjectId(taskId) });
  if (!task) return jsonError("Task not found", 404);

  if (!hasDomainAccess(user, [task.domain])) {
    return jsonError("Forbidden: task is outside your domains", 403);
  }

  // Deleting a task that candidates are already working on would orphan their
  // submissions — deactivate it instead.
  const assignments = await getCollection("assignments");
  const inUse = await assignments.countDocuments({ taskId: task._id }, { limit: 1 });
  if (inUse > 0) {
    return jsonError(
      "This task is already assigned to candidates. Deactivate it instead of deleting.",
      409
    );
  }

  await col.deleteOne({ _id: task._id });

  await logAudit({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "DELETE_TASK",
    target:     { collection: "tasks", id: taskId },
    before:     { title: task.title, domain: task.domain },
    after:      null,
    ip:         request.headers.get("x-forwarded-for") || "unknown",
  });

  return json({ success: true });
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
