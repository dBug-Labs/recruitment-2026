import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import Link from "next/link";
import TaskSubmissionForm from "./TaskSubmissionForm";

export default async function TaskDetailPage({ params }) {
  const { taskId } = await params;
  const session = await auth();

  if (!session?.user?.applicationId) {
    return <div>Application not found.</div>;
  }

  const tasksCol = await getCollection("tasks");
  const assignmentsCol = await getCollection("assignments");

  // Verify the assignment exists for this user and task
  const assignment = await assignmentsCol.findOne({
    applicationId: session.user.applicationId,
    taskId,
  });

  if (!assignment) {
    return (
      <div className="formCard" style={{ padding: 40, textAlign: "center" }}>
        <h2 style={{ color: "var(--red)", marginBottom: 16 }}>Access Denied</h2>
        <p style={{ color: "#a99bad" }}>This task is not assigned to you.</p>
        <Link href="/dashboard/tasks" style={{ display: "inline-block", marginTop: 16, color: "var(--purple-soft)" }}>← Back to Tasks</Link>
      </div>
    );
  }

  const task = await tasksCol.findOne({ _id: new ObjectId(taskId) });
  if (!task) return <div>Task not found.</div>;

  const dueAt = new Date(assignment.dueAt ?? task.dueAt);
  const isOverdue = dueAt < new Date();

  return (
    <div>
      <Link href="/dashboard/tasks" style={{ display: "inline-block", marginBottom: 24, color: "#a99bad", fontSize: 14 }}>
        ← Back to Tasks
      </Link>
      
      <div className="formCard" style={{ padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--purple-soft)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{task.domain} DOMAIN</div>
            <h1 style={{ fontSize: 28, margin: "0 0 8px", color: "#f2ebf4" }}>{task.title}</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 6 }}>DEADLINE</div>
            <div style={{ fontSize: 15, color: isOverdue ? "var(--red)" : "#f4eef6", fontWeight: isOverdue ? 600 : 400 }}>
              {dueAt.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}
              {isOverdue && " (Overdue)"}
            </div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", padding: 24, borderRadius: 8, marginBottom: 32, border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#8d8091", letterSpacing: 1 }}>TASK BRIEF</h3>
            {task.documentFileId && (
              <a href={`/api/admin/tasks/${task._id.toString()}/document`} target="_blank" rel="noopener noreferrer" className="btn grad sm">
                Download Document <span>↓</span>
              </a>
            )}
          </div>
          {/* Note: In a real app, you'd use a markdown renderer here for task.brief */}
          <div style={{ color: "#cfc3d2", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {task.brief}
          </div>

          {task.resources?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 14, color: "#8d8091", letterSpacing: 1, margin: "0 0 12px" }}>RESOURCES</h4>
              <ul style={{ margin: 0, padding: "0 0 0 20px", color: "var(--pink)" }}>
                {task.resources.map((r, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Previous Submission History */}
        {assignment.history?.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, color: "#8d8091", letterSpacing: 1, marginBottom: 12 }}>PREVIOUS SUBMISSIONS</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assignment.history.map((sub, i) => (
                <div key={i} style={{ padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 6, border: "1px solid var(--line)", fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#f4eef6" }}>{sub.type === "github" ? "GitHub Repository" : "Google Drive"}</span>
                    <span style={{ color: "#8d8091", fontSize: 13 }}>{new Date(sub.submittedAt).toLocaleString("en-IN")}</span>
                  </div>
                  <a href={sub.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-soft)", wordBreak: "break-all" }}>{sub.url}</a>
                  {sub.notes && <div style={{ color: "#a99bad", marginTop: 8, fontStyle: "italic" }}>"{sub.notes}"</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <hr className="rule" style={{ margin: "32px 0", border: "none" }} />
        
        <TaskSubmissionForm assignmentId={assignment._id.toString()} />
      </div>
    </div>
  );
}
