import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import Link from "next/link";
import { ROLES } from "@/lib/rbac";

export default async function AdminApplicationsPage({ searchParams }) {
  const { status, domain } = await searchParams; // Next.js 16 Promise
  const session = await auth();

  const col = await getCollection("applications");
  
  const query = { driveId: process.env.DRIVE_ID ?? "2026" };
  if (status) query.status = status;
  if (domain) query.domains = domain;

  // Domain leads can only see applicants for their domains, unless they filter by their specific domains
  if (session.user.role === ROLES.DOMAIN_LEAD) {
    const userDomains = session.user.domains || [];
    if (domain && !userDomains.includes(domain)) {
      return <div>You don't have permission to view this domain.</div>;
    }
    if (!domain) {
      query.domains = { $in: userDomains };
    }
  }

  const applications = await col.find(query).sort({ createdAt: -1 }).toArray();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="display grit grit-ink" style={{ fontSize: 42, marginBottom: 8, letterSpacing: 1, color: "var(--red)" }}>Applications</h1>
          <p style={{ color: "var(--red-soft)", fontSize: 18, margin: 0 }}>Review and manage candidates.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {/* Status Filter */}
          <form method="GET" style={{ display: "flex", gap: 12 }}>
             {domain && <input type="hidden" name="domain" value={domain} />}
             <select name="status" className="input" defaultValue={status ?? ""} onChange="this.form.submit()" style={{ padding: "8px 12px", width: "auto" }}>
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="task_assigned">Task Assigned</option>
                <option value="task_submitted">Task Submitted</option>
                <option value="interview_scheduled">Interview Scheduled</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
             </select>
          </form>
        </div>
      </div>

      <div className="formCard" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid var(--line)", textAlign: "left", color: "#a99bad" }}>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Name / Email</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Reg No. / Section</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Domains</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Status</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}>Date</th>
              <th style={{ padding: "16px 24px", fontWeight: 500 }}></th>
            </tr>
          </thead>
          <tbody>
            {applications.map(app => (
              <tr key={app._id.toString()} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ color: "#f4eef6", fontWeight: 500 }}>{app.name}</div>
                  <div style={{ color: "#8d8091", fontSize: 13, marginTop: 4 }}>{app.email}</div>
                </td>
                <td style={{ padding: "16px 24px", color: "#cfc3d2" }}>
                  <div>{app.registrationNumber}</div>
                  <div style={{ color: "#8d8091", fontSize: 13, marginTop: 4 }}>{app.section}</div>
                </td>
                <td style={{ padding: "16px 24px", color: "#cfc3d2" }}>
                  {app.domains.join(", ")}
                </td>
                <td style={{ padding: "16px 24px", color: "var(--red-soft)" }}>
                  {app.status.replace("_", " ")}
                </td>
                <td style={{ padding: "16px 24px", color: "#a99bad" }}>
                  {new Date(app.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td style={{ padding: "16px 24px", textAlign: "right" }}>
                  <Link href={`/admin/applications/${app._id.toString()}`} style={{ color: "var(--red)", fontWeight: 600 }}>Review →</Link>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: "40px", textAlign: "center", color: "#8d8091" }}>No applications found matching the criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
