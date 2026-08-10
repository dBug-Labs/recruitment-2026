/**
 * app/api/admin/tasks/[taskId]/document/route.js
 *
 * GET /api/admin/tasks/[taskId]/document
 * Streams the PDF document for the specified task from GridFS.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { streamTaskDocument } from "@/lib/storage";
import { ObjectId } from "mongodb";

export async function GET(request, { params }) {
  const { taskId } = await params;
  
  const session = await auth();
  const user = requireAuth(session);
  // Both candidates and admins can download tasks, so no strict role check here, 
  // but if needed we can ensure candidates only download tasks assigned to them.
  // For now, simple auth is enough.

  try {
    const col = await getCollection("tasks");
    const task = await col.findOne({ _id: new ObjectId(taskId) });

    if (!task) {
      return new Response("Task not found", { status: 404 });
    }

    if (!task.documentFileId) {
      return new Response("Task document not found", { status: 404 });
    }

    const { stream, filename, contentType, length } = await streamTaskDocument(taskId);

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", length.toString());
    // Use inline to view in browser, attachment to download
    headers.set("Content-Disposition", `inline; filename="${filename}"`);

    // Node Streams to Web Streams
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
  } catch (error) {
    console.error("[tasks] document stream error:", error);
    if (error.status === 404) {
      return new Response("Document not found", { status: 404 });
    }
    return new Response("Internal server error", { status: 500 });
  }
}
