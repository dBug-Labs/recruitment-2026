import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { domainLabel } from "@/lib/schemas";
import { fmtDateTime } from "@/app/_components/status";
import TaskSubmissionForm from "./TaskSubmissionForm";

export const metadata = { title: "Task" };

export default async function TaskDetailPage({ params }) {
  const { taskId } = await params;
  const session = await auth();

  if (!session?.user?.applicationId || !ObjectId.isValid(session.user.applicationId)) {
    return <div className="formCard" style={{ padding: 32 }}>Application not found.</div>;
  }
  if (!ObjectId.isValid(taskId)) notFound();

  const tasksCol = await getCollection("tasks");
  const assignmentsCol = await getCollection("assignments");

  // The ownership check is the query itself
  const assignment = await assignmentsCol.findOne({
    applicationId: new ObjectId(session.user.applicationId),
    taskId: new ObjectId(taskId),
  });

  if (!assignment) {
    return (
      <div className="formCard" style={{ padding: 36, textAlign: "center" }}>
        <h1 style={{ color: "var(--red)", marginBottom: 12, fontSize: 22 }}>Not your task</h1>
        <p style={{ color: "#a99bad", margin: 0 }}>This task is not assigned to you.</p>
        <Link href="/dashboard/tasks" style={{ display: "inline-block", marginTop: 16, color: "var(--purple-soft)" }}>
          ← Back to tasks
        </Link>
      </div>
    );
  }

  const task = await tasksCol.findOne({ _id: new ObjectId(taskId) });
  if (!task) notFound();

  const dueAt = new Date(assignment.dueAt ?? task.dueAt);
  const isOverdue = dueAt < new Date();
  const documentUrl = `/api/admin/tasks/${task._id.toString()}/document`;

  return (
    <div>
      <Link href="/dashboard/tasks" style={{ display: "inline-block", marginBottom: 18, color: "#a99bad", fontSize: 14 }}>
        ← Back to tasks
      </Link>

      <div className="formCard" style={{ padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--purple-soft)", letterSpacing: 1.4, marginBottom: 6, textTransform: "uppercase" }}>
              {domainLabel(task.domain)}
            </div>
            <h1 style={{ fontSize: 26, margin: 0, color: "#f2ebf4", lineHeight: 1.2 }}>{task.title}</h1>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#8d8091", letterSpacing: 1.5, marginBottom: 6 }}>DEADLINE</div>
            <div style={{ fontSize: 15, color: isOverdue ? "var(--red)" : "#f4eef6", fontWeight: isOverdue ? 600 : 400 }}>
              {fmtDateTime(dueAt)}{isOverdue && " (overdue)"}
            </div>
          </div>
        </div>

        {task.documentFileId && (
          <section className="pdfBlock">
            <div className="pdfBar">
              <span>TASK DOCUMENT</span>
              <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btnQuiet">
                Open in a new tab ↗
              </a>
            </div>
            <div className="pdfFrame">
              {/* #view=FitH fits the page width; the inner block only paints when
                  the browser refuses to render PDFs inline (iOS Safari, mostly) */}
              <object data={`${documentUrl}#view=FitH`} type="application/pdf" aria-label={`Task brief: ${task.title}`}>
                <div className="pdfFallback">
                  <div style={{ fontSize: 30 }}>📄</div>
                  <p style={{ margin: 0 }}>Your browser can&apos;t show the PDF inline.</p>
                  <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btn grad sm">
                    Open the brief <span>↗</span>
                  </a>
                </div>
              </object>
            </div>
          </section>
        )}

        <div style={{ background: "rgba(255,255,255,0.03)", padding: 20, borderRadius: 8, marginBottom: 28, border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 12.5, color: "#8d8091", letterSpacing: 1.5 }}>TASK BRIEF</h2>
            <span style={{ fontSize: 12.5, color: "#8d8091" }}>
              Accepts: {task.submissionType === "either" ? "GitHub or Google Drive" : task.submissionType === "github" ? "GitHub only" : "Google Drive only"}
            </span>
          </div>
          <div style={{ color: "#cfc3d2", lineHeight: 1.7, whiteSpace: "pre-wrap", fontSize: 15 }}>{task.brief}</div>

          {task.resources?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 12.5, color: "#8d8091", letterSpacing: 1.5, margin: "0 0 10px" }}>RESOURCES</h3>
              <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--pink)" }}>
                {task.resources.map((r, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {assignment.status === "reviewed" && (assignment.score != null || assignment.feedback) && (
          <div className="alert ok" style={{ marginBottom: 24 }}>
            Reviewed{assignment.score != null ? ` — ${assignment.score}/100` : ""}
            {assignment.feedback && <div style={{ marginTop: 6, color: "#cfc3d2" }}>{assignment.feedback}</div>}
          </div>
        )}

        {assignment.history?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 12.5, color: "#8d8091", letterSpacing: 1.5, marginBottom: 12 }}>YOUR SUBMISSIONS</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...assignment.history].reverse().map((sub, i) => (
                <div key={i} style={{ padding: "12px 15px", background: "rgba(0,0,0,0.25)", borderRadius: 7, border: "1px solid var(--line)", fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ color: "#f4eef6" }}>{sub.type === "github" ? "GitHub repository" : "Google Drive"}</span>
                    <span style={{ color: "#8d8091", fontSize: 13 }}>
                      {fmtDateTime(sub.submittedAt)}{sub.late ? " · late" : ""}
                    </span>
                  </div>
                  <a href={sub.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-soft)", wordBreak: "break-all" }}>{sub.url}</a>
                  {sub.notes && <div style={{ color: "#a99bad", marginTop: 8, fontStyle: "italic" }}>&ldquo;{sub.notes}&rdquo;</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="submitBlock" id="submit">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 12.5, color: "var(--red-soft)", letterSpacing: 1.5 }}>
              {assignment.submission ? "RESUBMIT YOUR WORK" : "SUBMIT YOUR WORK"}
            </h2>
            <span style={{ fontSize: 13, color: isOverdue ? "var(--red-soft)" : "#8d8091" }}>
              {isOverdue ? "Deadline passed — late submissions are flagged" : `Open until ${fmtDateTime(dueAt)}`}
            </span>
          </div>
          <p style={{ color: "#a99bad", fontSize: 14, margin: "10px 0 0", lineHeight: 1.6 }}>
            You can resubmit as many times as you like — we review the latest link.
          </p>

          <TaskSubmissionForm
            assignmentId={assignment._id.toString()}
            submissionType={task.submissionType ?? "either"}
          />
        </div>
      </div>
    </div>
  );
}
