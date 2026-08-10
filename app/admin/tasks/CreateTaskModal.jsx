"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ALL_DOMAIN_KEYS } from "@/lib/schemas";

export default function CreateTaskModal({ onClose }) {
  const [formState, setFormState] = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [file, setFile] = useState(null);
  const router = useRouter();
  const formRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!file) {
      setErrorMsg("Please upload a task document (PDF).");
      return;
    }
    setFormState("submitting");

    const fd = new FormData(formRef.current);
    fd.set("document", file);

    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create task");
      
      setFormState("success");
      setTimeout(() => {
        router.refresh();
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message);
      setFormState("error");
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="formCard" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", position: "relative", padding: 32 }}>
        <button onClick={onClose} style={{ position: "absolute", top: 24, right: 24, background: "none", border: "none", color: "#a99bad", fontSize: 24, cursor: "pointer" }}>×</button>
        
        <h2 style={{ fontSize: 24, margin: "0 0 24px", color: "var(--red)" }}>Create New Task</h2>
        
        {errorMsg && <div style={{ background: "rgba(255,45,79,.12)", border: "1px solid rgba(255,45,79,.4)", borderRadius: 8, padding: "12px 16px", marginBottom: 24, color: "#ff6b85", fontSize: 14 }}>⚠ {errorMsg}</div>}
        {formState === "success" && <div style={{ background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 24, color: "#00e676", fontSize: 14 }}>✓ Task created successfully.</div>}

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="two" style={{ gap: 20 }}>
            <div>
              <label>Domain</label>
              <select className="input" name="domain" required>
                <option value="" disabled selected>Select Domain</option>
                {ALL_DOMAIN_KEYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label>Submission Type</label>
              <select className="input" name="submissionType" defaultValue="either" required>
                <option value="github">GitHub Only</option>
                <option value="drive">Drive Only</option>
                <option value="either">Either</option>
              </select>
            </div>
          </div>

          <div>
            <label>Task Title</label>
            <input className="input" name="title" required placeholder="e.g. Build a landing page" />
          </div>

          <div>
            <label>Brief Description</label>
            <textarea className="input" name="brief" required placeholder="Short context about the task..." rows={3} />
          </div>

          <div>
            <label>Task Document (PDF)</label>
            <div className="drop" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: "#f2ebf4" }}>{file ? file.name : "Upload Document"}</div>
                <div style={{ fontSize: 14, color: "#9a8d9e", marginTop: 3 }}>PDF only</div>
              </div>
              <label className="chooseFile" style={{ margin: 0 }}>
                {file ? "Change" : "Choose File"}
                <input type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>

          <div className="two" style={{ gap: 20 }}>
            <div>
              <label>Due Date & Time</label>
              <input type="datetime-local" className="input" name="dueAt" required />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 34 }}>
              <input type="checkbox" name="active" value="true" defaultChecked style={{ width: 18, height: 18 }} />
              <label style={{ margin: 0 }}>Active (Visible to candidates)</label>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="submit" className="btn grad" disabled={formState === "submitting"} style={{ width: "100%" }}>
              {formState === "submitting" ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
