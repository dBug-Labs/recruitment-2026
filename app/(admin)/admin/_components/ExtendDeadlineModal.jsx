"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toIsoOrEmpty, toLocalInputValue } from "./datetime";
import { fmtDateTime } from "@/app/_components/status";

const PRESETS = [
  { label: "+1 day", days: 1 },
  { label: "+2 days", days: 2 },
  { label: "+3 days", days: 3 },
  { label: "+1 week", days: 7 },
];

/**
 * Pushes a single candidate's task deadline back.
 *
 * The presets count from whichever is later — the current deadline or now — so
 * "+2 days" on an already-overdue task actually gives two days, not none.
 */
export default function ExtendDeadlineModal({ assignment, onClose }) {
  const router = useRouter();
  const current = assignment.dueAt ? new Date(assignment.dueAt) : null;
  const overdue = current ? current < new Date() : false;

  const [dueAt, setDueAt] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  function applyPreset(days) {
    const base = current && current > new Date() ? current : new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    setDueAt(toLocalInputValue(next));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!dueAt) {
      setError("Pick a new deadline, or use one of the presets.");
      return;
    }
    setState("saving");
    try {
      const res = await fetch(`/api/admin/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: toIsoOrEmpty(dueAt), reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fields?.dueAt || data.error || "Could not extend the deadline");
      setState("done");
      router.refresh();
      setTimeout(onClose, 700);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Extend deadline"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="formCard modalCard" style={{ maxWidth: 500 }}>
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modalTitle">Extend deadline</h2>
        <p style={{ color: "#a99bad", fontSize: 14, margin: "-10px 0 18px", lineHeight: 1.6 }}>
          For <strong style={{ color: "#f4eef6" }}>{assignment.candidate}</strong> on{" "}
          <strong style={{ color: "#f4eef6" }}>{assignment.taskTitle}</strong>. They get an email
          with the new date.
        </p>

        <div style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--line)",
          background: "rgba(0,0,0,.25)", marginBottom: 18, fontSize: 14 }}>
          <span style={{ color: "#8d8091" }}>Current deadline: </span>
          <span style={{ color: overdue ? "var(--red-soft)" : "#cfc3d2" }}>
            {fmtDateTime(assignment.dueAt)}{overdue ? " · overdue" : ""}
          </span>
        </div>

        {error && <div className="alert err">⚠ {error}</div>}
        {state === "done" && <div className="alert ok">✓ Deadline extended.</div>}

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label>Quick options</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btnQuiet" onClick={() => applyPreset(p.days)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="extend-due">New deadline</label>
            <input id="extend-due" className="input" type="datetime-local"
              value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
          </div>

          <div>
            <label htmlFor="extend-reason">Reason (optional, shown to the candidate)</label>
            <input id="extend-reason" className="input" value={reason} maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Task brief went out late" />
          </div>

          <button type="submit" className="btn grad" disabled={state !== "idle"}
            style={{ width: "100%", justifyContent: "center" }}>
            {state === "saving" ? "Extending…" : "Extend deadline"}
          </button>
        </form>
      </div>
    </div>
  );
}
