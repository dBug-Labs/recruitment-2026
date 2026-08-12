import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff, hasDomainAccess, ROLES } from "@/lib/rbac";
import { DOMAIN_META, domainKeys, domainLabel } from "@/lib/schemas";
import { allowedDomains, domainScope } from "../../../_components/scope";
import { StatusPill, fmtDate, fmtDateTime } from "@/app/_components/status";
import StatusControls from "../../../_components/StatusControls";
import AssignmentCards from "../../../_components/AssignmentCards";

export const metadata = { title: "Application · Admin" };

export default async function AdminApplicationDetail({ params }) {
  const { id } = await params;
  const session = await auth();
  const user = requireStaff(session);

  if (!ObjectId.isValid(id)) notFound();

  const col = await getCollection("applications");
  const application = await col.findOne({ _id: new ObjectId(id) });
  if (!application) notFound();

  const appDomainKeys = application.domainKeys ?? domainKeys(application.domains ?? []);

  if (!hasDomainAccess(user, appDomainKeys)) {
    return (
      <div className="formCard" style={{ padding: 32 }}>
        <h1 style={{ color: "var(--red)", fontSize: 22, margin: "0 0 10px" }}>Not your domain</h1>
        <p style={{ color: "#a99bad", margin: 0 }}>
          This candidate applied outside the domains you lead.{" "}
          <Link href="/admin/applications" style={{ color: "var(--purple-soft)" }}>Back to applications</Link>
        </p>
      </div>
    );
  }

  const [assignmentsCol, tasksCol, interviewsCol] = await Promise.all([
    getCollection("assignments"),
    getCollection("tasks"),
    getCollection("interviews"),
  ]);

  const [assignments, interviews, assignableTasks] = await Promise.all([
    assignmentsCol.find({ applicationId: application._id }).sort({ assignedAt: -1 }).toArray(),
    interviewsCol.find({ applicationId: application._id }).sort({ slotAt: 1 }).toArray(),
    // Only active tasks in a domain this candidate applied to, that the viewer owns
    tasksCol
      .find(domainScope(user, { active: true, domain: { $in: appDomainKeys } }))
      .sort({ createdAt: -1 })
      .toArray(),
  ]);

  const taskById = new Map(
    (await tasksCol.find({ _id: { $in: assignments.map((a) => a.taskId).filter(Boolean) } }).toArray())
      .map((t) => [t._id.toString(), t])
  );

  const nowTs = new Date();
  const assignmentRows = assignments.map((a) => {
    const task = taskById.get(a.taskId?.toString());
    return {
      id: a._id.toString(),
      taskTitle: task?.title ?? "Task removed",
      domainLabel: domainLabel(a.domain),
      status: a.status,
      dueAt: a.dueAt ? new Date(a.dueAt).toISOString() : null,
      overdue: Boolean(a.dueAt && new Date(a.dueAt) < nowTs && a.status === "assigned"),
      score: a.score ?? null,
      extensions: a.deadlineHistory?.length ?? 0,
      submissionUrl: a.submission?.url ?? null,
      submissionType: a.submission?.type ?? null,
      submittedAt: a.submission?.submittedAt ? new Date(a.submission.submittedAt).toISOString() : null,
      late: Boolean(a.submission?.late),
    };
  });

  // Plain objects only — these cross the server/client boundary
  const tasksForModal = assignableTasks.map((t) => ({
    id: t._id.toString(),
    title: t.title,
    domainLabel: domainLabel(t.domain),
    dueAt: new Date(t.dueAt).toISOString(),
  }));

  const domainOptions = DOMAIN_META
    .filter((d) => appDomainKeys.includes(d.key))
    .filter((d) => allowedDomains(user, DOMAIN_META.map((x) => x.key)).includes(d.key))
    .map((d) => ({ key: d.key, label: d.label }));

  const applicationForClient = {
    _id: application._id.toString(),
    name: application.name,
    status: application.status,
    domainOptions: domainOptions.length > 0 ? domainOptions : DOMAIN_META.map((d) => ({ key: d.key, label: d.label })),
  };

  return (
    <div>
      <Link href="/admin/applications" style={{ display: "inline-block", marginBottom: 18, color: "var(--red-soft)", fontSize: 14 }}>
        ← Back to applications
      </Link>

      <div className="detailGrid">
        <div style={{ display: "grid", gap: 22 }}>
          <section className="formCard" style={{ padding: 26 }}>
            <div className="pageHead" style={{ marginBottom: 22 }}>
              <div>
                <h1 className="display grit grit-ink" style={{ fontSize: 32, margin: "0 0 6px" }}>{application.name}</h1>
                <div style={{ color: "#a99bad", fontSize: 14.5, wordBreak: "break-all" }}>{application.personalEmail}</div>
                <div style={{ color: "var(--purple-soft)", fontSize: 14, wordBreak: "break-all" }}>{application.srmEmail}</div>
              </div>
              <div className="actions">
                <StatusPill status={application.status} />
                {application.resume?.fileId && (
                  <a href={`/api/resumes/${application._id.toString()}`} target="_blank" rel="noopener noreferrer" className="btn ghost sm">
                    Resume <span>📄</span>
                  </a>
                )}
              </div>
            </div>

            <div className="kvGrid" style={{ background: "rgba(255,255,255,.03)", padding: 20, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div className="kv">
                <div className="k">Applicant ID</div>
                <div className="v" style={{ fontFamily: "ui-monospace, monospace", color: "var(--purple-soft)" }}>
                  {application.applicantId ?? "—"}
                </div>
              </div>
              <div className="kv">
                <div className="k">Registration</div>
                <div className="v" style={{ fontFamily: "ui-monospace, monospace" }}>{application.registrationNumber}</div>
              </div>
              <div className="kv"><div className="k">Year</div><div className="v">{application.year}</div></div>
              <div className="kv"><div className="k">Branch</div><div className="v">{application.branch}</div></div>
              <div className="kv"><div className="k">Department</div><div className="v">{application.department}</div></div>
              <div className="kv"><div className="k">Applied on</div><div className="v">{fmtDateTime(application.createdAt)}</div></div>
              <div className="kv">
                <div className="k">Domains</div>
                <div className="v" style={{ color: "var(--pink)" }}>{(application.domains ?? []).join(", ") || "—"}</div>
              </div>
            </div>
          </section>

          <section className="formCard" style={{ padding: 26 }}>
            <h2 style={{ fontSize: 13, letterSpacing: 1.5, color: "#8d8091", margin: "0 0 12px", textTransform: "uppercase" }}>
              Why do you want to join dBug Labs?
            </h2>
            <div className="prose">{application.question1}</div>

            <h2 style={{ fontSize: 13, letterSpacing: 1.5, color: "#8d8091", margin: "24px 0 12px", textTransform: "uppercase" }}>
              What skills or experiences make you a good fit?
            </h2>
            <div className="prose">{application.question2}</div>
          </section>

          <section className="formCard" style={{ padding: 26 }}>
            <h2 style={{ fontSize: 13, letterSpacing: 1.5, color: "#8d8091", margin: "0 0 14px", textTransform: "uppercase" }}>
              Tasks ({assignments.length})
            </h2>
            <AssignmentCards candidateName={application.name} assignments={assignmentRows} />
          </section>

          <section className="formCard" style={{ padding: 26 }}>
            <h2 style={{ fontSize: 13, letterSpacing: 1.5, color: "#8d8091", margin: "0 0 14px", textTransform: "uppercase" }}>
              Interviews ({interviews.length})
            </h2>
            {interviews.length === 0 ? (
              <p style={{ color: "#8d8091", margin: 0, fontSize: 14.5 }}>Nothing scheduled yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {interviews.map((iv) => (
                  <div key={iv._id.toString()} style={{ padding: 16, borderRadius: 8, border: "1px solid var(--line)", background: "rgba(0,0,0,.25)" }}>
                    <div className="primary">{fmtDateTime(iv.slotAt)}</div>
                    <div className="sub" style={{ marginTop: 4 }}>
                      {domainLabel(iv.domain)} · {iv.mode === "online" ? "🌐 Online" : "📍 In person"} · {iv.location}
                    </div>
                    {iv.panel?.length > 0 && <div className="sub">Panel: {iv.panel.join(", ")}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <StatusControls
          application={applicationForClient}
          tasks={tasksForModal}
          canOverride={user.role === ROLES.ADMIN}
          hasOpenAssignment={assignments.some((a) => a.status === "assigned")}
        />
      </div>

      <p style={{ marginTop: 24, fontSize: 12.5, color: "#6f6474" }}>
        Application ID {application._id.toString()} · last updated {fmtDate(application.updatedAt)}
      </p>
    </div>
  );
}
