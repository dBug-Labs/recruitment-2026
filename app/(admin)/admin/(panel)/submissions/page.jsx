import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { domainLabel } from "@/lib/schemas";
import { domainScope } from "../../_components/scope";
import { fmtDateTime } from "@/app/_components/status";
import SubmissionsList from "../../_components/SubmissionsList";
import BulkExtendButton from "../../_components/BulkExtendButton";
import { TIMED_WINDOWS } from "../../_components/extendWindows";

export const metadata = { title: "Submissions · Admin" };

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

  const now = new Date();

  // One counter per time-remaining window, so the modal can switch between them
  // without another round trip. A missing dueAt counts towards none of them:
  // the aggregation $lt would call it overdue, because null sorts below dates
  // in BSON, so it is excluded explicitly here.
  const windowCounters = Object.fromEntries(
    TIMED_WINDOWS.map((w) => [
      w.key,
      { $sum: { $cond: [{ $and: [
        { $ne: ["$dueAt", null] },
        { $lt: ["$dueAt", new Date(now.getTime() + w.hours * 3_600_000)] },
      ] }, 1, 0] } },
    ])
  );

  // Everyone still owing work, grouped by task. This is what the bulk-extend
  // button counts, so it is not limited to the tab currently on screen — an
  // admin sitting on "Reviewed" still sees the real number of stragglers.
  const pendingByTask = await assignmentsCol
    .aggregate([
      { $match: domainScope(user, { status: "assigned" }) },
      { $group: { _id: "$taskId", count: { $sum: 1 }, ...windowCounters } },
      { $lookup: { from: "tasks", localField: "_id", foreignField: "_id", as: "task" } },
      { $unwind: { path: "$task", preserveNullAndEmptyArrays: true } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  const sumOver = (pick) => pendingByTask.reduce((n, t) => n + pick(t), 0);

  const pending = {
    // The instant the counts were taken — the modal previews dates from this
    // rather than the browser clock, so the two always agree.
    now:     now.toISOString(),
    total:   sumOver((t) => t.count),
    // Drive-wide totals per window, for the button label.
    windows: Object.fromEntries(TIMED_WINDOWS.map((w) => [w.key, sumOver((t) => t[w.key] ?? 0)])),
    tasks: pendingByTask.map((t) => ({
      id:      t._id?.toString() ?? "",
      title:   t.task?.title ?? "Task removed",
      count:   t.count,
      windows: Object.fromEntries(TIMED_WINDOWS.map((w) => [w.key, t[w.key] ?? 0])),
    })),
  };

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
        <div className="actions">
          <BulkExtendButton pending={pending} />
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
