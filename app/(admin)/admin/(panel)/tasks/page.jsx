import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { DOMAIN_META, domainLabel } from "@/lib/schemas";
import { domainScope, allowedDomains } from "../../_components/scope";
import { fmtDateTime } from "@/app/_components/status";
import TaskManager from "../../_components/TaskManager";

export const metadata = { title: "Tasks · Admin" };

export default async function AdminTasksPage() {
  const session = await auth();
  const user = requireStaff(session);

  const tasksCol = await getCollection("tasks");
  const assignmentsCol = await getCollection("assignments");

  const tasks = await tasksCol.find(domainScope(user)).sort({ createdAt: -1 }).toArray();

  // One grouped count instead of a query per row
  const counts = await assignmentsCol
    .aggregate([
      { $match: { taskId: { $in: tasks.map((t) => t._id) } } },
      { $group: { _id: "$taskId", n: { $sum: 1 } } },
    ])
    .toArray();
  const countByTask = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]));

  const permitted = allowedDomains(user, DOMAIN_META.map((d) => d.key));
  const domains = DOMAIN_META.filter((d) => permitted.includes(d.key)).map((d) => ({ key: d.key, label: d.label }));

  const rows = tasks.map((t) => ({
    id: t._id.toString(),
    title: t.title,
    brief: t.brief ?? "",
    domain: t.domain,
    domainLabel: domainLabel(t.domain),
    dueAt: new Date(t.dueAt).toISOString(),
    dueLabel: fmtDateTime(t.dueAt),
    submissionType: t.submissionType,
    active: t.active !== false,
    hasDocument: Boolean(t.documentFileId),
    assignedCount: countByTask[t._id.toString()] ?? 0,
  }));

  return <TaskManager domains={domains} tasks={rows} />;
}
