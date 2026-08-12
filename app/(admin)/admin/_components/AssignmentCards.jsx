"use client";

import { useState } from "react";
import { AssignmentPill, fmtDateTime } from "@/app/_components/status";
import ExtendDeadlineModal from "./ExtendDeadlineModal";

/**
 * The assignment list on an application's page, with the extend-deadline action.
 * The server page does the Mongo work and passes plain rows down.
 */
export default function AssignmentCards({ assignments, candidateName }) {
  const [extending, setExtending] = useState(null);

  if (assignments.length === 0) {
    return <p style={{ color: "#8d8091", margin: 0, fontSize: 14.5 }}>No task has been assigned yet.</p>;
  }

  return (
    <>
      <div style={{ display: "grid", gap: 12 }}>
        {assignments.map((a) => (
          <div key={a.id} style={{ padding: 16, borderRadius: 8, border: "1px solid var(--line)", background: "rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div className="primary">{a.taskTitle}</div>
              <AssignmentPill status={a.status} />
            </div>

            <div className="sub" style={{ marginTop: 0 }}>
              {a.domainLabel} · due{" "}
              <span style={{ color: a.overdue ? "var(--red-soft)" : "#8d8091" }}>
                {fmtDateTime(a.dueAt)}{a.overdue ? " · overdue" : ""}
              </span>
              {a.score != null && ` · scored ${a.score}/100`}
              {a.extensions > 0 && ` · extended ${a.extensions}×`}
            </div>

            {a.submissionUrl && (
              <div style={{ marginTop: 10, fontSize: 14 }}>
                <a href={a.submissionUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--purple-soft)", wordBreak: "break-all" }}>
                  {a.submissionUrl}
                </a>
                <div className="sub">
                  {a.submissionType} · {fmtDateTime(a.submittedAt)}
                  {a.late && <span style={{ color: "var(--red-soft)" }}> · late</span>}
                </div>
              </div>
            )}

            <button type="button" className="btnQuiet" style={{ marginTop: 12 }}
              onClick={() => setExtending({ ...a, candidate: candidateName })}>
              Extend deadline
            </button>
          </div>
        ))}
      </div>

      {extending && <ExtendDeadlineModal assignment={extending} onClose={() => setExtending(null)} />}
    </>
  );
}
