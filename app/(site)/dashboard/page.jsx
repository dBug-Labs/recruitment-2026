import Link from "next/link";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { StatusPill, fmtDate, fmtDateTime } from "@/app/_components/status";

/** What the candidate should do next, per status. */
const NEXT_STEP = {
  submitted: "We have your application. Reviews start once applications close — watch your inbox.",
  under_review: "A reviewer is reading your application right now. Nothing to do yet.",
  shortlisted: "You're through the first cut. A task will land here shortly.",
  task_assigned: "You have a task waiting. Open My Tasks and submit before the deadline.",
  task_submitted: "Your submission is in and being reviewed. Hang tight.",
  interview_scheduled: "You're through to interviews — check the slot below and be on time.",
  selected: "Welcome to dBug Labs! Onboarding details are on their way.",
  rejected: "We couldn't move ahead this cycle. Keep building — we'd love to see you apply again.",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session.user.applicationId || !ObjectId.isValid(session.user.applicationId)) {
    return (
      <div className="formCard" style={{ padding: 32, textAlign: "center" }}>
        <h1 style={{ color: "var(--pink)", marginBottom: 14, fontSize: 24 }}>Application not found</h1>
        <p style={{ color: "#a99bad", lineHeight: 1.7, margin: 0 }}>
          We could not find an application linked to <strong>{session.user.email}</strong>.<br />
          If you haven&apos;t applied yet, <Link href="/apply" style={{ color: "var(--purple-soft)" }}>submit your application</Link> first.
        </p>
      </div>
    );
  }

  const applicationId = new ObjectId(session.user.applicationId);
  const [applications, assignmentsCol, interviewsCol, tasksCol] = await Promise.all([
    getCollection("applications"),
    getCollection("assignments"),
    getCollection("interviews"),
    getCollection("tasks"),
  ]);

  const application = await applications.findOne({ _id: applicationId });
  if (!application) {
    return <div className="formCard" style={{ padding: 32 }}>We could not load your application data.</div>;
  }

  const [assignments, interviews] = await Promise.all([
    assignmentsCol.find({ applicationId }).sort({ dueAt: 1 }).toArray(),
    interviewsCol.find({ applicationId, slotAt: { $gte: new Date() } }).sort({ slotAt: 1 }).toArray(),
  ]);

  const tasks = await tasksCol
    .find({ _id: { $in: assignments.map((a) => a.taskId).filter(Boolean) } })
    .toArray();
  const taskById = new Map(tasks.map((t) => [t._id.toString(), t]));

  const openAssignments = assignments.filter((a) => a.status === "assigned");

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="display grit grit-ink">Welcome back, {application.name.split(" ")[0]}</h1>
          <p>Here&apos;s where your application stands.</p>
        </div>
      </div>

      <section className="formCard" style={{ padding: 26, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", paddingBottom: 20, marginBottom: 20, borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontSize: 11.5, color: "#8d8091", letterSpacing: 1.5, marginBottom: 8 }}>CURRENT STATUS</div>
            <StatusPill status={application.status} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#8d8091", letterSpacing: 1.5, marginBottom: 8 }}>APPLICANT ID</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, color: "var(--purple-soft)", letterSpacing: 1.5 }}>
              {application.applicantId ?? "—"}
            </div>
          </div>
        </div>

        <p style={{ color: "#cfc3d2", fontSize: 15.5, lineHeight: 1.7, margin: "0 0 22px" }}>
          {NEXT_STEP[application.status] ?? "We'll be in touch with the next step."}
        </p>

        <div className="kvGrid">
          <div className="kv">
            <div className="k">Domains</div>
            <div className="v">{(application.domains ?? []).join(", ") || "—"}</div>
          </div>
          <div className="kv">
            <div className="k">Applied on</div>
            <div className="v">{fmtDate(application.createdAt)}</div>
          </div>
          <div className="kv">
            <div className="k">Branch / year</div>
            <div className="v">{application.branch} — {application.year}</div>
          </div>
          <div className="kv">
            <div className="k">Resume</div>
            <div className="v">
              {application.resume?.fileId
                ? <a href={`/api/resumes/${application._id.toString()}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-soft)" }}>View PDF</a>
                : "Not uploaded"}
            </div>
          </div>
        </div>
      </section>

      {openAssignments.length > 0 && (
        <section className="formCard" style={{ padding: 22, marginBottom: 20, borderColor: "rgba(255,45,79,.35)" }}>
          <div style={{ fontSize: 11.5, color: "var(--red-soft)", letterSpacing: 1.5, marginBottom: 10 }}>ACTION NEEDED</div>
          {openAssignments.map((a) => (
            <div key={a._id.toString()} style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ color: "#f4eef6", fontSize: 17, marginBottom: 4 }}>
                  {taskById.get(a.taskId?.toString())?.title ?? "Your task"}
                </div>
                <div style={{ color: "#a99bad", fontSize: 14 }}>Due {fmtDateTime(a.dueAt)}</div>
              </div>
              <Link href={`/dashboard/tasks/${a.taskId?.toString()}`} className="btn grad sm">
                Open task <span>→</span>
              </Link>
            </div>
          ))}
        </section>
      )}

      {interviews.length > 0 && (
        <section className="formCard" style={{ padding: 22 }}>
          <div style={{ fontSize: 11.5, color: "var(--purple-soft)", letterSpacing: 1.5, marginBottom: 12 }}>UPCOMING INTERVIEW</div>
          {interviews.map((iv) => (
            <div key={iv._id.toString()} style={{ marginBottom: 10 }}>
              <div style={{ color: "#f4eef6", fontSize: 17 }}>{fmtDateTime(iv.slotAt)}</div>
              <div style={{ color: "#a99bad", fontSize: 14, marginTop: 4 }}>
                {iv.mode === "online" ? "🌐 Online" : "📍 In person"} ·{" "}
                {iv.mode === "online"
                  ? <a href={iv.location} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-soft)", wordBreak: "break-all" }}>{iv.location}</a>
                  : iv.location}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
