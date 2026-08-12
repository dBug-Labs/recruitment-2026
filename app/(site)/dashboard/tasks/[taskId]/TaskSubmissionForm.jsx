"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const TYPE_LABELS = { github: "GitHub repository", drive: "Google Drive link" };

export default function TaskSubmissionForm({ assignmentId, submissionType = "either" }) {
  // The task decides which link types are accepted; the API enforces the same.
  const allowedTypes = submissionType === "either" ? ["github", "drive"] : [submissionType];
  const [formState, setFormState] = useState("idle");
  const [errors, setErrors] = useState({});
  const router = useRouter();
  const formRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setFormState("submitting");

    const fd = new FormData(formRef.current);
    const data = {
      assignmentId,
      type: fd.get("type"),
      url: fd.get("url"),
      notes: fd.get("notes"),
    };

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.fields) setErrors(json.fields);
        throw new Error(json.error ?? "Failed to submit task");
      }

      setFormState("success");
      router.refresh(); // Refresh the page data to show the new submission
    } catch (err) {
      setErrors((prev) => ({ ...prev, _general: err.message }));
      setFormState("error");
    }
  }

  if (formState === "success") {
    return (
      <div style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.3)", borderRadius: 8, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
        <h4 style={{ color: "#00e676", margin: "0 0 8px" }}>Task Submitted Successfully</h4>
        <p style={{ color: "#cfc3d2", fontSize: 14 }}>Your submission has been recorded. You can resubmit if needed before the deadline.</p>
        <button className="btn grad sm" onClick={() => setFormState("idle")} style={{ marginTop: 16 }}>Submit Another Version</button>
      </div>
    );
  }

  // The heading lives on the page, so the form starts straight at the fields.
  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{ marginTop: 20 }}>
      {errors._general && (
        <div style={{ background: "rgba(255,45,79,.12)", border: "1px solid rgba(255,45,79,.4)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: "#ff6b85", fontSize: 14 }}>
          ⚠ {errors._general}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label>Submission Type <span className="req">*</span></label>
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          {allowedTypes.map((t, i) => (
            <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, color: "#cfc3d2", fontSize: 15 }}>
              <input type="radio" name="type" value={t} defaultChecked={i === 0} /> {TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        {errors.type && <div style={{ color: "var(--pink)", fontSize: 12, marginTop: 4 }}>{errors.type}</div>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Deliverable URL <span className="req">*</span></label>
        <input className="input" name="url" placeholder="https://github.com/... or https://drive.google.com/..." required style={errors.url ? { borderColor: "var(--pink)" } : {}} />
        {errors.url && <div style={{ color: "var(--pink)", fontSize: 12, marginTop: 4 }}>{errors.url}</div>}
        <div style={{ fontSize: 12, color: "#8d8091", marginTop: 4 }}>Make sure the link is public or accessible to anyone with the link.</div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label>Submission Notes (Optional)</label>
        <textarea className="input" name="notes" placeholder="Any instructions on how to run your code, or things to note..." rows={3} maxLength={300} style={errors.notes ? { borderColor: "var(--pink)" } : {}}></textarea>
        {errors.notes && <div style={{ color: "var(--pink)", fontSize: 12, marginTop: 4 }}>{errors.notes}</div>}
      </div>

      <button type="submit" className="btn grad" disabled={formState === "submitting"}>
        {formState === "submitting" ? "Submitting..." : "Submit Task"}
      </button>
    </form>
  );
}
