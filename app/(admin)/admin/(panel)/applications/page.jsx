import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { DOMAIN_META, APPLICATION_STATUSES } from "@/lib/schemas";
import { applicationScope, allowedDomains } from "../../_components/scope";
import { StatusPill, fmtDate } from "@/app/_components/status";
import ApplicationFilters from "../../_components/ApplicationFilters";

export const metadata = { title: "Applications · Admin" };

const PAGE_SIZE = 40;

/** Escapes a user string so it can go into a Mongo $regex literally. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function AdminApplicationsPage({ searchParams }) {
  // Next.js 16: searchParams is a Promise
  const { status, domain, q, page } = await searchParams;
  const session = await auth();
  const user = requireStaff(session);

  const query = applicationScope(user);

  if (status && APPLICATION_STATUSES.includes(status)) {
    query.status = status;
  }

  if (domain) {
    const permitted = allowedDomains(user, DOMAIN_META.map((d) => d.key));
    if (!permitted.includes(domain)) {
      return (
        <div className="formCard" style={{ padding: 32 }}>
          <h1 style={{ color: "var(--red)", fontSize: 22, margin: "0 0 10px" }}>Domain not permitted</h1>
          <p style={{ color: "#a99bad", margin: 0 }}>
            You do not have access to that domain.{" "}
            <Link href="/admin/applications" style={{ color: "var(--purple-soft)" }}>Back to all applications</Link>
          </p>
        </div>
      );
    }
    // domainKeys may already be constrained for leads — intersect, don't overwrite
    query.$and = [...(query.$and ?? []), { domainKeys: domain }];
  }

  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    query.$and = [
      ...(query.$and ?? []),
      { $or: [{ name: rx }, { srmEmail: rx }, { personalEmail: rx }, { registrationNumber: rx }, { applicantId: rx }] },
    ];
  }

  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const col = await getCollection("applications");

  const [applications, total] = await Promise.all([
    col.find(query).sort({ createdAt: -1 }).skip((currentPage - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    col.countDocuments(query),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (domain) p.set("domain", domain);
    if (q) p.set("q", q);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return qs ? `/admin/applications?${qs}` : "/admin/applications";
  };

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="display grit grit-ink" style={{ color: "var(--red)" }}>Applications</h1>
          <p>{total} result{total === 1 ? "" : "s"} · review and move candidates through the pipeline.</p>
        </div>
      </div>

      <ApplicationFilters domains={DOMAIN_META.filter((d) => allowedDomains(user, DOMAIN_META.map((x) => x.key)).includes(d.key))} />

      <div className="tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Applicant ID</th>
              <th>Registration</th>
              <th>Year / Branch</th>
              <th>Domains</th>
              <th>Status</th>
              <th>Applied</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app._id.toString()}>
                <td>
                  <div className="primary">{app.name}</div>
                  <div className="sub">{app.srmEmail}</div>
                </td>
                <td className="num" style={{ color: "var(--purple-soft)" }}>{app.applicantId ?? "—"}</td>
                <td className="num">{app.registrationNumber}</td>
                <td>
                  <div style={{ color: "#cfc3d2" }}>{app.year}</div>
                  <div className="sub">{app.branch} · {app.department}</div>
                </td>
                <td style={{ color: "#cfc3d2", minWidth: 150 }}>{(app.domains ?? []).join(", ") || "—"}</td>
                <td><StatusPill status={app.status} /></td>
                <td className="num">{fmtDate(app.createdAt)}</td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/admin/applications/${app._id.toString()}`} style={{ color: "var(--red)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={8} className="emptyRow">No applications match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 22, fontSize: 14 }}>
          {currentPage > 1
            ? <Link href={pageHref(currentPage - 1)} className="btnQuiet">← Previous</Link>
            : <span className="btnQuiet" style={{ opacity: .4 }}>← Previous</span>}
          <span style={{ color: "#8d8091" }}>Page {currentPage} of {pageCount}</span>
          {currentPage < pageCount
            ? <Link href={pageHref(currentPage + 1)} className="btnQuiet">Next →</Link>
            : <span className="btnQuiet" style={{ opacity: .4 }}>Next →</span>}
        </div>
      )}
    </div>
  );
}
