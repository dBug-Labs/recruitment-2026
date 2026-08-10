"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StatusControls({ application }) {
  const router = useRouter();
  const [status, setStatus] = useState(application.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const statuses = [
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
    { value: "shortlisted", label: "Shortlisted" },
    { value: "task_assigned", label: "Task Assigned" },
    { value: "task_submitted", label: "Task Submitted" },
    { value: "interview_scheduled", label: "Interview Scheduled" },
    { value: "selected", label: "Selected" },
    { value: "rejected", label: "Rejected" },
  ];

  async function updateStatus(newStatus) {
    if (newStatus === status) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/applications/${application._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      setStatus(newStatus);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="formCard" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 16, margin: "0 0 16px", color: "var(--red-soft)", letterSpacing: 1 }}>STATUS & ACTIONS</h3>
      
      {error && (
        <div style={{ background: "rgba(255,45,79,.12)", border: "1px solid rgba(255,45,79,.4)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, color: "#ff6b85", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {statuses.map(s => {
          const isActive = status === s.value;
          return (
            <button
              key={s.value}
              onClick={() => updateStatus(s.value)}
              disabled={loading}
              style={{
                textAlign: "left",
                padding: "10px 16px",
                borderRadius: 6,
                background: isActive ? "rgba(255,45,79,.2)" : "rgba(255,255,255,.05)",
                border: isActive ? "1px solid var(--red-soft)" : "1px solid transparent",
                color: isActive ? "var(--red)" : "#a99bad",
                fontWeight: isActive ? 600 : 400,
                cursor: loading ? "wait" : "pointer",
                transition: "all 0.2s"
              }}
            >
              {isActive ? "✓ " : ""}{s.label}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 8 }}>ASSIGN TASK</div>
          <p style={{ fontSize: 13, color: "#a99bad", marginBottom: 12 }}>Candidate must be in 'Shortlisted' status to receive tasks.</p>
          <button className="btn grad sm" style={{ width: "100%" }} disabled={status !== "shortlisted"}>
             Assign Task...
          </button>
      </div>
    </div>
  );
}
