import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { TaskSubmissionSchema } from "@/lib/schemas";
import { requireAuth, withErrorHandling } from "@/lib/rbac";
import { ObjectId } from "mongodb";

export const POST = withErrorHandling(async function handler(request) {
  const session = await auth();
  const user = requireAuth(session);

  if (!user.applicationId) {
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
  const assignmentsCol = await getCollection("assignments");
  const applicationsCol = await getCollection("applications");

  // Verify the assignment belongs to the user
  const assignment = await assignmentsCol.findOne({
    _id: new ObjectId(data.assignmentId),
    applicationId: user.applicationId,
  });

  if (!assignment) {
    return jsonError("Assignment not found or access denied", 404);
  }

  const now = new Date();
  
  // Format the submission object
  const submissionRecord = {
    type: data.type,
    url: data.url,
    notes: data.notes,
    submittedAt: now,
  };

  // Push to history array and update current submission & status
  await assignmentsCol.updateOne(
    { _id: assignment._id },
    {
      $set: { 
        submission: submissionRecord,
        status: "task_submitted",
        updatedAt: now,
      },
      $push: { history: submissionRecord },
    }
  );

  // Update application status to task_submitted if it's currently task_assigned
  await applicationsCol.updateOne(
    { _id: new ObjectId(user.applicationId), status: "task_assigned" },
    { $set: { status: "task_submitted", updatedAt: now } }
  );

  return new Response(JSON.stringify({ success: true }), {
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
