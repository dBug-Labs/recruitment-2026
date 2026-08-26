import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { APPLICATION_STATUSES, DOMAIN_META, domainLabel } from "@/lib/schemas";
import { applicationScope, domainScope } from "../_components/scope";
import OutboxPanel from "../_components/OutboxPanel";
import { StatusPill, fmtDate, fmtDateTime } from "@/app/_components/status";
import { quotaSnapshot, outboxSummary } from "@/lib/email";
import { ROLES } from "@/lib/rbac";

export const metadata = { title: "Overview · Admin" };

/** Headline numbers, in the order a reviewer actually works through them. */
const HEADLINE = ["submitted", "under_review", "shortlisted", "task_assigned", "task_submitted", "interview_scheduled", "selected", "rejected"];

export default async function AdminOverviewPage() {
  const session = await auth();
  const user = requireStaff(session);

  const appsCol = await getCollection("applications");
  const interviewsCol = await getCollection("interviews");
  const assignmentsCol = await getCollection("assignments");

  const scope = applicationScope(user);

  const [statusRows, domainRows, total, recent, pendingReview, upcoming] = await Promise.all([
    appsCol.aggregate([{ $match: scope }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    appsCol.aggregate([
      { $match: scope },
      { $unwind: "$domainKeys" },
      { $group: { _id: "$domainKeys", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]).toArray(),
    appsCol.countDocuments(scope),
    appsCol.find(scope).sort({ createdAt: -1 }).limit(6).toArray(),
    assignmentsCol.countDocuments(domainScope(user, { status: "submitted" })),
    interviewsCol
      .find(domainScope(user, { slotAt: { $gte: new Date() } }))
      .sort({ slotAt: 1 })
      .limit(5)
      .toArray(),
  ]);

  const counts = Object.fromEntries(statusRows.map((r) => [r._id, r.n]));
  const domainCounts = Object.fromEntries(domainRows.map((r) => [r._id, r.n]));

  // Read here rather than fetched by the panel, so a queue that is quietly
  // backed up is visible the moment the page paints instead of one round-trip
  // later. Never fatal: the overview is not worth losing over a mail counter.
  let outboxState = null;
  try {
    const [quota, outbox] = await Promise.all([quotaSnapshot(), outboxSummary()]);
    outboxState = { quota, outbox };
  } catch (err) {
    console.error("[admin] could not read the email outbox:", err);
  }

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="display grit grit-ink" style={{ color: "var(--red)" }}>Overview</h1>
          <p>
            Recruitment drive {process.env.DRIVE_ID ?? "2026"} · {total} application{total === 1 ? "" : "s"}
            {user.role === "domain_lead" ? " in your domains" : ""}
          </p>
        </div>
        <div className="actions">
          <Link href="/admin/applications" className="btn grad sm">Review Applications <span>→</span></Link>
        </div>
      </div>

      <div className="statGrid">
        <Link href="/admin/applications" className="stat accent">
          <div className="k">Total</div>
          <div className="v">{total}</div>
        </Link>
        {HEADLINE.map((s) => (
          <Link key={s} href={`/admin/applications?status=${s}`} className="stat">
            <div className="k">{s.replace(/_/g, " ")}</div>
            <div className="v">{counts[s] ?? 0}</div>
          </Link>
        ))}
      </div>

      <div className="detailGrid">
        <section className="formCard" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, letterSpacing: 1.4, color: "#8d8091", margin: "0 0 16px", textTransform: "uppercase" }}>
            Latest applications
          </h2>
          <div className="tableWrap" style={{ border: "none", background: "none" }}>
            <table className="dataTable" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Domains</th>
                  <th>Status</th>
                  <th>Applied</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((app) => (
                  <tr key={app._id.toString()}>
                    <td>
                      <Link href={`/admin/applications/${app._id.toString()}`} className="primary">{app.name}</Link>
                      <div className="sub">{app.srmEmail}</div>
                    </td>
                    <td className="sub" style={{ marginTop: 0 }}>
                      {(app.domains ?? []).join(", ") || "—"}
                    </td>
                    <td><StatusPill status={app.status} /></td>
                    <td className="num">{fmtDate(app.createdAt)}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="emptyRow">
                      No applications yet. Seed the dev database or submit the form at <Link href="/apply">/apply</Link>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: "grid", gap: 22 }}>
          <section className="formCard" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 15, letterSpacing: 1.4, color: "#8d8091", margin: "0 0 8px", textTransform: "uppercase" }}>
              Needs your attention
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              <Link href="/admin/submissions?status=submitted" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text)" }}>
                <span>Task submissions to review</span>
                <span className={`pill ${pendingReview > 0 ? "warn" : "neutral"}`}>{pendingReview}</span>
              </Link>
              <Link href="/admin/applications?status=submitted" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text)" }}>
                <span>Applications not yet opened</span>
                <span className={`pill ${(counts.submitted ?? 0) > 0 ? "warn" : "neutral"}`}>{counts.submitted ?? 0}</span>
              </Link>
              <Link href="/admin/interviews" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text)" }}>
                <span>Upcoming interviews</span>
                <span className={`pill ${upcoming.length > 0 ? "info" : "neutral"}`}>{upcoming.length}</span>
              </Link>
            </div>

            {upcoming.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)", display: "grid", gap: 10 }}>
                {upcoming.map((iv) => (
                  <div key={iv._id.toString()} style={{ fontSize: 13.5, color: "#a99bad" }}>
                    <span style={{ color: "var(--purple-soft)" }}>{fmtDateTime(iv.slotAt)}</span>
                    {" · "}{domainLabel(iv.domain)}{" · "}{iv.mode}
                  </div>
                ))}
              </div>
            )}
          </section>

          {outboxState && (
            <OutboxPanel initial={outboxState} canFlush={user.role === ROLES.ADMIN} />
          )}

          <section className="formCard" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 15, letterSpacing: 1.4, color: "#8d8091", margin: "0 0 16px", textTransform: "uppercase" }}>
              By domain
            </h2>
            <div style={{ display: "grid", gap: 9 }}>
              {DOMAIN_META.filter((d) => user.role !== "domain_lead" || (user.domains ?? []).includes(d.key)).map((d) => {
                const n = domainCounts[d.key] ?? 0;
                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                return (
                  <Link key={d.key} href={`/admin/applications?domain=${d.key}`} style={{ display: "block", color: "var(--text)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
                      <span>{d.label}</span>
                      <span style={{ color: "#8d8091" }}>{n}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,.07)" }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: "var(--grad)" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* keeps the status list in sync with the schema if new states are added */}
      {APPLICATION_STATUSES.length !== HEADLINE.length && (
        <p style={{ marginTop: 20, fontSize: 13, color: "#6f6474" }}>
          Note: {APPLICATION_STATUSES.length - HEADLINE.length} status(es) are not shown above.
        </p>
      )}
    </div>
  );
}
