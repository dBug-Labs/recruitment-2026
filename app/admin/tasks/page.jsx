import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireAuth, ROLES } from "@/lib/rbac";
import NewTaskButton from "./NewTaskButton";

export default async function AdminTasksPage() {
  const session = await auth();
  const user = requireAuth(session);

  const tasksCol = await getCollection("tasks");

  const query = { driveId: process.env.DRIVE_ID ?? "2026" };
  // Domain Leads can only see tasks for their domains
  if (user.role === ROLES.DOMAIN_LEAD) {
    query.domain = { $in: user.domains || [] };
  }

  const tasks = await tasksCol.find(query).sort({ createdAt: -1 }).toArray();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="display grit grit-ink" style={{ fontSize: 42, marginBottom: 8, letterSpacing: 1, color: "var(--red)" }}>Tasks</h1>
          <p style={{ color: "var(--red-soft)", fontSize: 18, margin: 0 }}>Manage evaluation tasks for candidates.</p>
        </div>
        <div>
          <NewTaskButton />
        </div>
      </div>

      <div className="formCard" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid var(--line)", textAlign: "left", color: "#a99bad" }}>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Task Title</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Domain</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Default Deadline</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Created</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task._id.toString()} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ color: "#f4eef6", fontWeight: 500, fontSize: 16 }}>{task.title}</div>
                </td>
                <td style={{ padding: "16px 24px", color: "var(--red-soft)", textTransform: "uppercase" }}>
                  {task.domain}
                </td>
                <td style={{ padding: "16px 24px", color: "#cfc3d2" }}>
                  {new Date(task.dueAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td style={{ padding: "16px 24px", color: "#a99bad" }}>
                  {new Date(task.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td style={{ padding: "16px 24px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    {task.documentFileId && (
                      <a href={`/api/admin/tasks/${task._id.toString()}/document`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-soft)", fontWeight: 600, textDecoration: "none" }}>Doc</a>
                    )}
                    <button style={{ color: "var(--red)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: "40px", textAlign: "center", color: "#8d8091" }}>No tasks created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
