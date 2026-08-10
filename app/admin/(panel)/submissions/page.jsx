import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { domainLabel } from "@/lib/schemas";
import { domainScope } from "../../_components/scope";
import { fmtDateTime } from "../../_components/status";
import SubmissionsList from "../../_components/SubmissionsList";

export const metadata = { title: "Submissions | dBug Labs Admin" };

const TABS = [
  { key: "submitted", label: "Awaiting review" },
  { key: "reviewed",  label: "Reviewed"        },
  { key: "assigned",  label: "Not submitted"   },
  { key: "all",       label: "All"             },
];

export default async function AdminSubmissionsPage({ searchParams }) {
  const { status } = await searchParams;
  const session = await auth();
  const user = requireStaff(session);

  const active = TABS.some((t) => t.key === status) ? status : "submitted";

  const assignmentsCol = await getCollection("assignments");
  const query = domainScope(user, active === "all" ? {} : { status: active });

  const rows = await assignmentsCol
    .aggregate([
      { $match: query },
      { $sort: { updatedAt: -1 } },
      { $limit: 200 },
      { $lookup: { from: "applications", localField: "applicationId", foreignField: "_id", as: "application" } },
      { $lookup: { from: "tasks",        localField: "taskId",        foreignField: "_id", as: "task" } },
      { $unwind: { path: "$application", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$task",        preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  const now = new Date();
  const serialised = rows.map((r) => ({
    id: r._id.toString(),
    applicationId: r.applicationId?.toString() ?? "",
    candidate: r.application?.name ?? "Unknown candidate",
    email: r.application?.srmEmail ?? "—",
    taskTitle: r.task?.title ?? "Task removed",
    dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
    overdue: Boolean(r.dueAt && new Date(r.dueAt) < now && r.status === "assigned"),
    domainLabel: domainLabel(r.domain),
    url: r.submission?.url ?? "",
    notes: r.submission?.notes ?? "",
    late: Boolean(r.submission?.late),
    submittedLabel: r.submission?.submittedAt ? fmtDateTime(r.submission.submittedAt) : "—",
    status: r.status,
    score: r.score ?? null,
    feedback: r.feedback ?? "",
  }));

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="display grit grit-ink" style={{ color: "var(--red)" }}>Submissions</h1>
          <p>{serialised.length} record{serialised.length === 1 ? "" : "s"} · score task work and leave feedback.</p>
        </div>
      </div>

      <div className="filterBar">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/submissions?status=${t.key}`}
            className="btnQuiet"
            style={active === t.key ? { borderColor: "var(--red)", color: "var(--red)" } : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <SubmissionsList rows={serialised} />
    </div>
  );
}
