/**
 * app/api/admin/tasks/[taskId]/document/route.js
 *
 * GET /api/admin/tasks/[taskId]/document
 * Streams the PDF brief for a task from GridFS.
 *
 * Staff may read any task's document; a candidate may only read a task that is
 * actually assigned to them.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireAuth, isStaff, withErrorHandling } from "@/lib/rbac";
import { streamTaskDocument } from "@/lib/storage";
import { ObjectId } from "mongodb";

export const GET = withErrorHandling(async function handler(request, { params }) {
  const { taskId } = await params;

  const session = await auth();
  const user = requireAuth(session);

  if (!ObjectId.isValid(taskId)) {
    return new Response("Task not found", { status: 404 });
  }

  const col = await getCollection("tasks");
  const task = await col.findOne({ _id: new ObjectId(taskId) });

  if (!task) {
    return new Response("Task not found", { status: 404 });
  }

  if (!isStaff(user)) {
    if (!user.applicationId || !ObjectId.isValid(user.applicationId)) {
      return new Response("Forbidden", { status: 403 });
    }
    const assignments = await getCollection("assignments");
    const owns = await assignments.countDocuments(
      { taskId: task._id, applicationId: new ObjectId(user.applicationId) },
      { limit: 1 }
    );
    if (owns === 0) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  if (!task.documentFileId) {
    return new Response("Task document not found", { status: 404 });
  }

  let doc;
  try {
    doc = await streamTaskDocument(taskId);
  } catch (error) {
    if (error.status === 404) {
      return new Response("Document not found", { status: 404 });
    }
    throw error;
  }

  const { stream, filename, contentType, length } = doc;

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  if (length) headers.set("Content-Length", String(length));
  // inline so it opens in the browser's PDF viewer rather than downloading
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
  headers.set("Cache-Control", "private, no-store");

  // Node Readable → Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new Response(webStream, { headers });
});
