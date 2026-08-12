"use client";

import { useState } from "react";
import { toIsoOrEmpty } from "./datetime";

export default function AssignTaskModal({ applicationId, candidateName, tasks, onClose, onDone }) {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | done
  const [error, setError] = useState("");

  const selected = tasks.find((t) => t.id === taskId);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setState("saving");
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          taskId,
          // blank means "use the task's own deadline"
          ...(dueAt ? { dueAt: toIsoOrEmpty(dueAt) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not assign the task");
      setState("done");
      onDone?.();
      setTimeout(onClose, 700);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Assign a task">
      <div className="formCard modalCard">
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modalTitle">Assign a task</h2>
        <p style={{ color: "#a99bad", fontSize: 14, margin: "-10px 0 20px" }}>
          To <strong style={{ color: "#f4eef6" }}>{candidateName}</strong>. They will get an email with the brief and deadline.
        </p>

        {error && <div className="alert err">⚠ {error}</div>}
        {state === "done" && <div className="alert ok">✓ Task assigned.</div>}

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label htmlFor="assign-task">Task</label>
            <select id="assign-task" className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)} required>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.domainLabel} — {t.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assign-due">Deadline override (optional)</label>
            <input
              id="assign-due"
              className="input"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
            <div style={{ fontSize: 12.5, color: "#8d8091", marginTop: 6 }}>
              Leave blank to use the task deadline{selected ? ` (${new Date(selected.dueAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })})` : ""}.
            </div>
          </div>

          <button type="submit" className="btn grad" disabled={state !== "idle" || !taskId} style={{ width: "100%", justifyContent: "center" }}>
            {state === "saving" ? "Assigning…" : "Assign task"}
          </button>
        </form>
      </div>
    </div>
  );
}
