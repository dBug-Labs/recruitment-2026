import Link from "next/link";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { domainLabel } from "@/lib/schemas";
import { AssignmentPill, fmtDateTime } from "../../admin/_components/status";

export const metadata = { title: "My Tasks | dBug Labs" };

export default async function TasksPage() {
  const session = await auth();

  if (!session.user.applicationId || !ObjectId.isValid(session.user.applicationId)) {
    return (
      <div className="formCard" style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "#a99bad", margin: 0 }}>
          Please complete your <Link href="/apply" style={{ color: "var(--purple-soft)" }}>application</Link> first.
        </p>
      </div>
    );
  }

  const applicationId = new ObjectId(session.user.applicationId);
  const assignmentsCol = await getCollection("assignments");
  const tasksCol = await getCollection("tasks");

  const assignments = await assignmentsCol.find({ applicationId }).sort({ dueAt: 1 }).toArray();
  const tasks = await tasksCol
    .find({ _id: { $in: assignments.map((a) => a.taskId).filter(Boolean) } })
    .toArray();
  const taskById = new Map(tasks.map((t) => [t._id.toString(), t]));

  if (assignments.length === 0) {
    return (
      <div className="formCard" style={{ padding: 40, textAlign: "center" }}>
        <h1 style={{ color: "var(--lilac)", marginBottom: 14, fontSize: 24 }}>No tasks yet</h1>
        <p style={{ color: "#a99bad", lineHeight: 1.7, margin: 0 }}>
          Tasks are handed out after shortlisting. We&apos;ll email you the moment yours is ready.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="display grit grit-ink">My Tasks</h1>
          <p>Everything assigned to you this cycle.</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {assignments.map((a) => {
          const task = taskById.get(a.taskId?.toString());
          const overdue = a.status === "assigned" && new Date(a.dueAt) < new Date();
          return (
            <div key={a._id.toString()} className="formCard"
              style={{ padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: "var(--purple-soft)", letterSpacing: 1.4, marginBottom: 6, textTransform: "uppercase" }}>
                  {domainLabel(a.domain)}
                </div>
                <h2 style={{ margin: "0 0 8px", fontSize: 19, color: "#f4eef6" }}>{task?.title ?? "Task"}</h2>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14, color: "#a99bad" }}>
                  <AssignmentPill status={a.status} />
                  <span style={overdue ? { color: "var(--red-soft)" } : undefined}>
                    Due {fmtDateTime(a.dueAt)}{overdue ? " · overdue" : ""}
                  </span>
                </div>
              </div>
              {task && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href={`/dashboard/tasks/${task._id.toString()}`} className="btn ghost sm">
                    View task
                  </Link>
                  <Link href={`/dashboard/tasks/${task._id.toString()}#submit`} className="btn grad sm">
                    {a.submission ? "Resubmit" : "Submit work"} <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
