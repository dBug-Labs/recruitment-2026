import Link from "next/link";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { StatusPill, fmtDate, fmtDateTime } from "@/app/_components/status";

/**
 * The applicants' WhatsApp group.
 *
 * Read server-side, so the link never ships to anyone who is not signed in —
 * an invite URL is a join token, and this page is already behind auth. Leave
 * WHATSAPP_GROUP_URL unset and the card simply does not render.
 */
const WHATSAPP_URL = process.env.WHATSAPP_GROUP_URL;

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

      {WHATSAPP_URL && (
        <section className="joinCard">
          <svg className="joinMark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
          </svg>
          <div className="joinBody">
            <h2>Join the applicants&apos; WhatsApp group</h2>
            <p>
              Every announcement, deadline nudge and answer to a question someone else already
              asked lands there first. Worth joining now rather than after you&apos;ve missed one.
            </p>
          </div>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn grad sm joinBtn">
            Join group <span>→</span>
          </a>
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
