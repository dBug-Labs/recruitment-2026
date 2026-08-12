import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { domainLabel } from "@/lib/schemas";
import { domainScope } from "../../_components/scope";
import { fmtDateTime } from "@/app/_components/status";

export const metadata = { title: "Interviews · Admin" };

export default async function AdminInterviewsPage({ searchParams }) {
  const { show } = await searchParams;
  const session = await auth();
  const user = requireStaff(session);

  const past = show === "past";
  const now = new Date();

  const interviewsCol = await getCollection("interviews");
  const query = domainScope(user, { slotAt: past ? { $lt: now } : { $gte: now } });

  const interviews = await interviewsCol
    .aggregate([
      { $match: query },
      { $sort: { slotAt: past ? -1 : 1 } },
      { $limit: 200 },
      { $lookup: { from: "applications", localField: "applicationId", foreignField: "_id", as: "application" } },
      { $unwind: { path: "$application", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="display grit grit-ink" style={{ color: "var(--red)" }}>Interviews</h1>
          <p>
            {interviews.length} {past ? "past" : "upcoming"} interview{interviews.length === 1 ? "" : "s"} · schedule new ones
            from a candidate&apos;s page.
          </p>
        </div>
      </div>

      <div className="filterBar">
        <Link href="/admin/interviews" className="btnQuiet" style={!past ? { borderColor: "var(--red)", color: "var(--red)" } : undefined}>
          Upcoming
        </Link>
        <Link href="/admin/interviews?show=past" className="btnQuiet" style={past ? { borderColor: "var(--red)", color: "var(--red)" } : undefined}>
          Past
        </Link>
      </div>

      <div className="tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Date &amp; time</th>
              <th>Domain</th>
              <th>Mode / where</th>
              <th>Panel</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {interviews.map((iv) => (
              <tr key={iv._id.toString()}>
                <td>
                  <div className="primary">{iv.application?.name ?? "Unknown candidate"}</div>
                  <div className="sub">{iv.application?.srmEmail ?? "—"}</div>
                </td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(iv.slotAt)}</td>
                <td style={{ color: "var(--red-soft)", whiteSpace: "nowrap" }}>{domainLabel(iv.domain)}</td>
                <td>
                  <div style={{ color: "#cfc3d2" }}>{iv.mode === "online" ? "🌐 Online" : "📍 In person"}</div>
                  <div className="sub">{iv.location}</div>
                </td>
                <td className="sub" style={{ marginTop: 0 }}>{(iv.panel ?? []).join(", ") || "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {iv.applicationId && (
                    <Link href={`/admin/applications/${iv.applicationId.toString()}`} style={{ color: "var(--red)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      Open →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr>
                <td colSpan={6} className="emptyRow">
                  No {past ? "past" : "upcoming"} interviews.{" "}
                  {!past && <Link href="/admin/applications?status=task_submitted" style={{ color: "var(--purple-soft)" }}>Find candidates to schedule →</Link>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
