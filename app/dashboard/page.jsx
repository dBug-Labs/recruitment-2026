import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";

function StatusBadge({ status }) {
  const map = {
    submitted: { color: "#cfc3d2", bg: "rgba(255,255,255,0.1)", label: "Application Received" },
    under_review: { color: "#cfc3d2", bg: "rgba(255,255,255,0.1)", label: "Under Review" },
    shortlisted: { color: "var(--purple-soft)", bg: "rgba(176,107,255,0.15)", label: "Shortlisted" },
    task_assigned: { color: "var(--pink)", bg: "rgba(224,71,154,0.15)", label: "Task Assigned" },
    task_submitted: { color: "#cfc3d2", bg: "rgba(255,255,255,0.1)", label: "Task Under Review" },
    interview_scheduled: { color: "var(--pink)", bg: "rgba(224,71,154,0.15)", label: "Interview Scheduled" },
    selected: { color: "#00e676", bg: "rgba(0,230,118,0.15)", label: "Selected" },
    rejected: { color: "#ff2d4f", bg: "rgba(255,45,79,0.15)", label: "Not Selected" },
  };

  const s = map[status] ?? map.submitted;

  return (
    <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session.user.applicationId) {
    return (
      <div className="formCard" style={{ padding: 40, textAlign: "center" }}>
        <h2 style={{ color: "var(--pink)", marginBottom: 16 }}>Application Not Found</h2>
        <p style={{ color: "#a99bad", lineHeight: 1.6 }}>
          We could not find an application linked to <strong>{session.user.email}</strong>.<br />
          If you haven't applied yet, please submit your application first.<br />
          If you used a different email, please sign out and sign in with the correct one.
        </p>
      </div>
    );
  }

  const applications = await getCollection("applications");
  const application = await applications.findOne({ _id: new ObjectId(session.user.applicationId) });

  if (!application) {
    return <div>Error loading application data.</div>;
  }

  return (
    <div>
      <h1 className="display grit grit-ink" style={{ fontSize: 42, marginBottom: 8, letterSpacing: 1 }}>Welcome back, {application.name.split(" ")[0]}</h1>
      <p style={{ color: "#cfc3d2", fontSize: 18, marginBottom: 40 }}>Here is the current status of your application.</p>

      <div className="formCard" style={{ padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 6 }}>CURRENT STATUS</div>
            <StatusBadge status={application.status} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 6 }}>REG NUMBER</div>
            <div style={{ fontFamily: "monospace", fontSize: 16, color: "var(--purple-soft)" }}>{application.registrationNumber}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 6 }}>DOMAINS</div>
            <div style={{ color: "#f4eef6" }}>{application.domains.join(", ")}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 6 }}>APPLIED ON</div>
            <div style={{ color: "#f4eef6" }}>{new Date(application.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 6 }}>BRANCH / YEAR</div>
            <div style={{ color: "#f4eef6" }}>{application.branch} — {application.year}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
