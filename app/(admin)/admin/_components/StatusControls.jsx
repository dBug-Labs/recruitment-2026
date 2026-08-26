"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUSES, STATUS_TRANSITIONS } from "@/lib/schemas";
import { statusMeta } from "@/app/_components/status";
import AssignTaskModal from "./AssignTaskModal";
import ScheduleInterviewModal from "./ScheduleInterviewModal";

/**
 * The action rail on an application. Only lifecycle-legal moves are offered;
 * admins can tick "override" to correct a mistake, which the API also enforces.
 */
export default function StatusControls({ application, tasks, canOverride, hasOpenAssignment }) {
  const router = useRouter();
  const [status, setStatus] = useState(application.status);
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [mailWarning, setMailWarning] = useState(null);
  const [modal, setModal] = useState(null); // 'task' | 'interview' | null

  const allowed = [...(STATUS_TRANSITIONS[status] ?? [])];
  const options = override ? APPLICATION_STATUSES.filter((s) => s !== status) : allowed;

  async function updateStatus(next) {
    setBusy(next);
    setError(null);
    setMailWarning(null);
    try {
      const res = await fetch(`/api/admin/applications/${application._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, force: override }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      // The status moved regardless; the mail is the part that can quietly fail.
      if (data.emailSent === false) {
        setMailWarning(data.emailError || "The candidate was not emailed.");
      }
      setStatus(next);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="formCard" style={{ padding: 22 }}>
        <h2 style={{ fontSize: 13, letterSpacing: 1.5, color: "#8d8091", margin: "0 0 12px", textTransform: "uppercase" }}>
          Current status
        </h2>
        <div className={`pill ${statusMeta(status).tone}`} style={{ fontSize: 13, padding: "6px 14px" }}>
          {statusMeta(status).label}
        </div>

        {error && <div className="alert err" style={{ marginTop: 14, marginBottom: 0 }}>⚠ {error}</div>}
        {mailWarning && (
          <div className="alert err" style={{ marginTop: 14, marginBottom: 0 }}>
            ⚠ Status updated, but the notification email did not go out: {mailWarning}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11.5, letterSpacing: 1.5, color: "#8d8091", marginBottom: 10, textTransform: "uppercase" }}>
            Move to
          </div>
          {options.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "#8d8091", margin: 0, lineHeight: 1.6 }}>
              This is a final state.{canOverride ? " Tick override below to change it anyway." : ""}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateStatus(s)}
                  disabled={busy !== null}
                  style={{
                    textAlign: "left",
                    padding: "9px 14px",
                    borderRadius: 7,
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid var(--line)",
                    color: "#cfc3d2",
                    fontSize: 14,
                    opacity: busy && busy !== s ? 0.5 : 1,
                  }}
                >
                  {busy === s ? "Updating…" : statusMeta(s).label}
                </button>
              ))}
            </div>
          )}
        </div>

        {canOverride && (
          <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16, marginBottom: 0, fontSize: 13, color: "#8d8091" }}>
            <input type="checkbox" className="check" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Override lifecycle order
          </label>
        )}
      </div>

      <div className="formCard" style={{ padding: 22 }}>
        <h2 style={{ fontSize: 13, letterSpacing: 1.5, color: "#8d8091", margin: "0 0 14px", textTransform: "uppercase" }}>
          Actions
        </h2>

        <button
          type="button"
          className="btn grad sm"
          style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
          onClick={() => setModal("task")}
          disabled={tasks.length === 0}
        >
          Assign a task
        </button>
        {tasks.length === 0 && (
          <p style={{ fontSize: 12.5, color: "#8d8091", margin: "0 0 12px" }}>
            No active tasks exist for this candidate&apos;s domains yet.
          </p>
        )}
        {hasOpenAssignment && (
          <p style={{ fontSize: 12.5, color: "#8d8091", margin: "0 0 12px" }}>
            This candidate already has a task in progress.
          </p>
        )}

        <button
          type="button"
          className="btn ghost sm"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => setModal("interview")}
        >
          Schedule an interview
        </button>
      </div>

      {modal === "task" && (
        <AssignTaskModal
          applicationId={application._id}
          candidateName={application.name}
          tasks={tasks}
          onClose={() => setModal(null)}
          onDone={() => { setStatus("task_assigned"); router.refresh(); }}
        />
      )}

      {modal === "interview" && (
        <ScheduleInterviewModal
          applicationId={application._id}
          candidateName={application.name}
          domains={application.domainOptions}
          onClose={() => setModal(null)}
          onDone={() => { setStatus("interview_scheduled"); router.refresh(); }}
        />
      )}
    </div>
  );
}
