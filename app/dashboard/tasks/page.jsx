import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import Link from "next/link";

export default async function TasksPage() {
  const session = await auth();
  
  if (!session.user.applicationId) {
    return <div>Please complete your application first.</div>;
  }

  const assignmentsCol = await getCollection("assignments");
  const tasksCol = await getCollection("tasks");

  const assignments = await assignmentsCol.find({ applicationId: session.user.applicationId }).toArray();
  
  const tasksWithAssignments = await Promise.all(assignments.map(async (a) => {
    const task = await tasksCol.findOne({ _id: new ObjectId(a.taskId) });
    return { assignment: a, task };
  }));

  if (tasksWithAssignments.length === 0) {
    return (
      <div className="formCard" style={{ padding: 40, textAlign: "center" }}>
        <h2 style={{ color: "var(--lilac)", marginBottom: 16 }}>No Tasks Yet</h2>
        <p style={{ color: "#a99bad", lineHeight: 1.6 }}>
          You do not have any tasks assigned at the moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display grit grit-ink" style={{ fontSize: 42, marginBottom: 8, letterSpacing: 1 }}>My Tasks</h1>
      <p style={{ color: "#cfc3d2", fontSize: 18, marginBottom: 40 }}>Tasks assigned to you for the recruitment process.</p>

      <div style={{ display: "grid", gap: 20 }}>
        {tasksWithAssignments.map(({ assignment, task }) => (
          <div key={assignment._id.toString()} className="formCard" style={{ padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--purple-soft)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{task?.domain} DOMAIN</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#f4eef6" }}>{task?.title}</h3>
              <div style={{ fontSize: 14, color: "#a99bad" }}>
                Due: {new Date(assignment.dueAt ?? task?.dueAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}
              </div>
            </div>
            <div>
              <Link href={`/dashboard/tasks/${task._id.toString()}`} className="btn grad sm">
                View Task <span>→</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
