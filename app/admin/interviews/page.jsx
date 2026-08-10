import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireAuth, ROLES } from "@/lib/rbac";

export default async function AdminInterviewsPage() {
  const session = await auth();
  const user = requireAuth(session);

  const interviewsCol = await getCollection("interviews");

  // TODO: Add Domain Lead filtering for interviews as well
  const query = { driveId: process.env.DRIVE_ID ?? "2026" };

  const interviews = await interviewsCol.aggregate([
    { $match: query },
    { $lookup: {
        from: "applications",
        localField: "applicationId",
        foreignField: "_id",
        as: "application"
    }},
    { $unwind: "$application" },
    { $sort: { "slot.start": 1 } }
  ]).toArray();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="display grit grit-ink" style={{ fontSize: 42, marginBottom: 8, letterSpacing: 1, color: "var(--red)" }}>Interviews</h1>
          <p style={{ color: "var(--red-soft)", fontSize: 18, margin: 0 }}>Schedule and manage candidate interviews.</p>
        </div>
        <div>
          <button className="btn grad">Schedule Interview</button>
        </div>
      </div>

      <div className="formCard" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid var(--line)", textAlign: "left", color: "#a99bad" }}>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Candidate</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Date & Time</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Mode / Location</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map(inv => (
              <tr key={inv._id.toString()} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ color: "#f4eef6", fontWeight: 500 }}>{inv.application.name}</div>
                  <div style={{ color: "#8d8091", fontSize: 13, marginTop: 4 }}>{inv.application.email}</div>
                </td>
                <td style={{ padding: "16px 24px", color: "#cfc3d2" }}>
                  {new Date(inv.slot.start).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  <div style={{ color: "#8d8091", fontSize: 13, marginTop: 4 }}>
                    To: {new Date(inv.slot.end).toLocaleTimeString("en-IN", { timeStyle: "short" })}
                  </div>
                </td>
                <td style={{ padding: "16px 24px", color: "#a99bad" }}>
                  {inv.mode === "online" ? "🌐 Online" : "📍 In-Person"}
                  <div style={{ color: "#8d8091", fontSize: 13, marginTop: 4 }}>{inv.location}</div>
                </td>
                <td style={{ padding: "16px 24px", color: inv.status === "scheduled" ? "var(--purple-soft)" : "var(--red-soft)" }}>
                  {inv.status}
                </td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr>
                <td colSpan="4" style={{ padding: "40px", textAlign: "center", color: "#8d8091" }}>No interviews scheduled yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
