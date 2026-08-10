"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AssignmentPill, fmtDateTime } from "./status";
import ExtendDeadlineModal from "./ExtendDeadlineModal";

function ReviewModal({ row, onClose }) {
  const router = useRouter();
  const [score, setScore] = useState(row.score ?? "");
  const [feedback, setFeedback] = useState(row.feedback ?? "");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setState("saving");
    try {
      const res = await fetch(`/api/admin/assignments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: score === "" ? null : Number(score),
          feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the review");
      setState("done");
      router.refresh();
      setTimeout(onClose, 700);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Review submission">
      <div className="formCard modalCard">
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modalTitle">Review submission</h2>
        <p style={{ color: "#a99bad", fontSize: 14, margin: "-10px 0 18px" }}>
          <strong style={{ color: "#f4eef6" }}>{row.candidate}</strong> — {row.taskTitle}
        </p>

        {row.url && (
          <a href={row.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", padding: 12, borderRadius: 8, border: "1px solid var(--line)", background: "rgba(0,0,0,.3)", marginBottom: 18, wordBreak: "break-all", fontSize: 14 }}>
            {row.url}
          </a>
        )}
        {row.notes && <p style={{ color: "#a99bad", fontStyle: "italic", fontSize: 14 }}>&ldquo;{row.notes}&rdquo;</p>}

        {error && <div className="alert err">⚠ {error}</div>}
        {state === "done" && <div className="alert ok">✓ Review saved.</div>}

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label htmlFor="review-score">Score (out of 100)</label>
            <input id="review-score" className="input" type="number" min="0" max="100" value={score}
              onChange={(e) => setScore(e.target.value)} placeholder="Leave blank to skip" />
          </div>
          <div>
            <label htmlFor="review-feedback">Feedback</label>
            <textarea id="review-feedback" className="input" rows={4} style={{ height: "auto" }}
              value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Internal notes for the panel…" />
          </div>
          <button type="submit" className="btn grad" disabled={state !== "idle"} style={{ width: "100%", justifyContent: "center" }}>
            {state === "saving" ? "Saving…" : "Save review"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SubmissionsList({ rows }) {
  const [active, setActive] = useState(null);
  const [extending, setExtending] = useState(null);

  return (
    <>
      <div className="tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Task</th>
              <th>Submission</th>
              <th>Deadline</th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/admin/applications/${row.applicationId}`} className="primary">{row.candidate}</Link>
                  <div className="sub">{row.email}</div>
                </td>
                <td>
                  <div style={{ color: "#cfc3d2" }}>{row.taskTitle}</div>
                  <div className="sub">{row.domainLabel}</div>
                </td>
                <td style={{ maxWidth: 250 }}>
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-soft)", wordBreak: "break-all", fontSize: 13 }}>
                      {row.url}
                    </a>
                  ) : <span className="sub">Not submitted</span>}
                </td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  <span style={{ color: row.overdue ? "var(--red-soft)" : "#cfc3d2" }}>
                    {fmtDateTime(row.dueAt)}
                  </span>
                  {row.overdue && <div className="sub" style={{ color: "var(--red-soft)" }}>overdue</div>}
                  {row.submittedLabel !== "—" && (
                    <div className="sub">
                      sent {row.submittedLabel}{row.late ? " · late" : ""}
                    </div>
                  )}
                </td>
                <td>
                  <AssignmentPill status={row.status} />
                  {row.score != null && <div className="sub">{row.score}/100</div>}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setExtending(row)}
                      style={{ background: "none", border: "none", color: "#a99bad", padding: 0, whiteSpace: "nowrap" }}>
                      Extend
                    </button>
                    <button type="button" onClick={() => setActive(row)} disabled={!row.url}
                      style={{ background: "none", border: "none", color: row.url ? "var(--red)" : "#4c4450", fontWeight: 600, padding: 0, whiteSpace: "nowrap" }}>
                      Review →
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="emptyRow">Nothing to review yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {active && <ReviewModal row={active} onClose={() => setActive(null)} />}
      {extending && <ExtendDeadlineModal assignment={extending} onClose={() => setExtending(null)} />}
    </>
  );
}
