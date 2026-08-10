/**
 * app/api/admin/tasks/route.js
 *
 * POST /api/admin/tasks
 *
 * Creates a new task for a specific domain.
 * Accepts multipart/form-data with a required PDF document upload.
 */

import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireAuth, ROLES, withErrorHandling } from "@/lib/rbac";
import { TaskSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { uploadTaskDocument, validatePdfBuffer } from "@/lib/storage";
import { ObjectId } from "mongodb";

export const POST = withErrorHandling(async function handler(request) {
  const session = await auth();
  const user = requireAuth(session);
  
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.DOMAIN_LEAD) {
    return jsonError("Forbidden", 403);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  // Parse resources JSON if it exists
  let resources = [];
  try {
    if (formData.get('resources')) {
      resources = JSON.parse(formData.get('resources'));
    }
  } catch {
    return jsonError("Invalid resources JSON", 400);
  }

  const raw = {
    driveId: process.env.DRIVE_ID ?? "2026",
    domain: formData.get('domain'),
    title: formData.get('title'),
    brief: formData.get('brief'),
    resources: resources,
    submissionType: formData.get('submissionType'),
    dueAt: formData.get('dueAt'),
    active: formData.get('active') === 'true',
  };

  const parsed = TaskSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? 'general'
      if (!errors[field]) errors[field] = issue.message
    }
    return jsonError("Invalid task data", 400, { fields: errors });
  }

  const data = parsed.data;

  // Verify domain authorization
  if (user.role === ROLES.DOMAIN_LEAD) {
    if (!user.domains.includes(data.domain)) {
      return jsonError("Forbidden: Cannot create tasks for unassigned domains", 403);
    }
  }

  const documentFile = formData.get('document');
  if (!documentFile || documentFile.size === 0) {
    return jsonError("Task document (PDF) is required", 422, { fields: { document: 'Document is required' } });
  }

  const buffer = Buffer.from(await documentFile.arrayBuffer());
  const validation = validatePdfBuffer(buffer);
  if (!validation.valid) {
    return jsonError(validation.reason, 422, { fields: { document: validation.reason } });
  }

  const col = await getCollection("tasks");
  const now = new Date();
  
  const tempId = new ObjectId();
  const upload = await uploadTaskDocument(buffer, documentFile.name, {
    taskId: tempId.toString(),
    domain: data.domain,
  });

  const doc = {
    _id: tempId,
    ...data,
    documentFileId: upload.fileId,
    createdBy: new ObjectId(user.id),
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(doc);

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE_TASK",
    target: "TASK",
    before: null,
    after: { taskId: result.insertedId.toString(), title: data.title },
    ip: request.headers.get("x-forwarded-for") || "unknown"
  });

  return new Response(JSON.stringify({ success: true, taskId: result.insertedId.toString() }), {
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
