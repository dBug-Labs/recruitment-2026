"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TaskModal from "./TaskModal";

/**
 * The tasks screen. The server page does the Mongo work and hands down plain
 * serialisable rows; this owns the create/edit modal and the row actions.
 */
export default function TaskManager({ domains, tasks }) {
  const router = useRouter();
  const [modal, setModal] = useState(null); // null | { task } | { }
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function toggleActive(task) {
    setBusyId(task.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !task.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the task");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setBusyId(task.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete the task");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <h1 className="display grit grit-ink" style={{ color: "var(--red)" }}>Tasks</h1>
          <p>{tasks.length} task{tasks.length === 1 ? "" : "s"} · briefs candidates get after shortlisting.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn grad sm" onClick={() => setModal({})} disabled={domains.length === 0}>
            Create task
          </button>
        </div>
      </div>

      {error && <div className="alert err">⚠ {error}</div>}
      {domains.length === 0 && (
        <div className="alert err">You have no domains assigned, so you cannot create tasks.</div>
      )}

      <div className="tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Task</th>
              <th>Domain</th>
              <th>Deadline</th>
              <th>Assigned</th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <div className="primary">{task.title}</div>
                  <div className="sub">{task.brief.slice(0, 90)}{task.brief.length > 90 ? "…" : ""}</div>
                </td>
                <td style={{ color: "var(--red-soft)", whiteSpace: "nowrap" }}>{task.domainLabel}</td>
                <td className="num">{task.dueLabel}</td>
                <td className="num">{task.assignedCount}</td>
                <td>
                  <span className={`pill ${task.active ? "good" : "neutral"}`}>{task.active ? "Active" : "Inactive"}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {task.hasDocument && (
                      <a href={`/api/admin/tasks/${task.id}/document`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-soft)" }}>
                        PDF
                      </a>
                    )}
                    <button type="button" className="linkBtn" onClick={() => setModal({ task })} disabled={busyId === task.id}
                      style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 600, padding: 0 }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => toggleActive(task)} disabled={busyId === task.id}
                      style={{ background: "none", border: "none", color: "#a99bad", padding: 0 }}>
                      {task.active ? "Deactivate" : "Activate"}
                    </button>
                    {task.assignedCount === 0 && (
                      <button type="button" onClick={() => remove(task)} disabled={busyId === task.id}
                        style={{ background: "none", border: "none", color: "#6f6474", padding: 0 }}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={6} className="emptyRow">No tasks yet — create the first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <TaskModal
          domains={domains}
          task={modal.task}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
