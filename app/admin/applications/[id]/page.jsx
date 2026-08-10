import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import Link from "next/link";
import StatusControls from "./StatusControls";

export default async function AdminApplicationDetail({ params }) {
  const { id } = await params;
  const session = await auth();

  const col = await getCollection("applications");
  const application = await col.findOne({ _id: new ObjectId(id) });

  if (!application) return <div>Application not found.</div>;

  return (
    <div>
      <Link href="/admin" style={{ display: "inline-block", marginBottom: 24, color: "var(--red-soft)", fontSize: 14 }}>
        ← Back to Applications
      </Link>
      
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        
        {/* Left Column: Application Details */}
        <div className="formCard" style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <h1 className="display grit grit-ink" style={{ fontSize: 36, margin: "0 0 4px", letterSpacing: 1, color: "var(--text)" }}>{application.name}</h1>
              <div style={{ color: "#a99bad", fontSize: 15 }}>{application.personalEmail}</div>
              <div style={{ color: "var(--purple-soft)", fontSize: 14 }}>{application.srmEmail}</div>
            </div>
            {application.resume?.fileId && (
              <a href={`/api/resumes/${application._id.toString()}`} target="_blank" rel="noopener noreferrer" className="btn grad sm" style={{ background: "var(--red)" }}>
                View Resume <span>📄</span>
              </a>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 16px", background: "rgba(255,255,255,0.03)", padding: 24, borderRadius: 8, border: "1px solid var(--line)", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 4 }}>REGISTRATION NUMBER</div>
              <div style={{ color: "#cfc3d2" }}>{application.registrationNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 4 }}>YEAR OF STUDY</div>
              <div style={{ color: "#cfc3d2" }}>{application.year}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 4 }}>BRANCH</div>
              <div style={{ color: "#cfc3d2" }}>{application.branch}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 4 }}>DEPARTMENT</div>
              <div style={{ color: "#cfc3d2" }}>{application.department}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 4 }}>DOMAINS</div>
              <div style={{ color: "var(--pink)" }}>{application.domains.join(", ")}</div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 12 }}>WHY DO YOU WANT TO JOIN DBUG LABS?</div>
            <div style={{ color: "#cfc3d2", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.4)", padding: 20, borderRadius: 8, border: "1px solid var(--line)" }}>
              {application.question1}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 13, color: "#8d8091", letterSpacing: 1, marginBottom: 12 }}>WHAT SKILLS OR EXPERIENCES MAKE YOU A GOOD FIT?</div>
            <div style={{ color: "#cfc3d2", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.4)", padding: 20, borderRadius: 8, border: "1px solid var(--line)" }}>
              {application.question2}
            </div>
          </div>
        </div>

        {/* Right Column: Status Controls */}
        <StatusControls application={application} />
        
      </div>
    </div>
  );
}
