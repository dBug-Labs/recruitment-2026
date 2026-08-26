"use client";

import { useState } from "react";
import { toIsoOrEmpty } from "./datetime";

export default function ScheduleInterviewModal({ applicationId, candidateName, domains, onClose, onDone }) {
  const [form, setForm] = useState({
    domain: domains[0]?.key ?? "",
    slotAt: "",
    mode: "online",
    location: "",
    panel: "",
    notes: "",
  });
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [mail, setMail] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setState("saving");
    try {
      const res = await fetch("/api/admin/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          domain: form.domain,
          slotAt: toIsoOrEmpty(form.slotAt),
          mode: form.mode,
          location: form.location.trim(),
          panel: form.panel.split(",").map((p) => p.trim()).filter(Boolean),
          notes: form.notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.fields ?? {});
        throw new Error(data.error || "Could not schedule the interview");
      }
      setState("done");
      setMail({ sent: data.emailSent !== false, error: data.emailError });
      onDone?.();
      // Hold the modal open when the invite did not go out — the interview is
      // saved either way, but the admin needs to know the candidate wasn't told.
      if (data.emailSent !== false) setTimeout(onClose, 700);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  const err = (k) => fieldErrors[k] && (
    <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{fieldErrors[k]}</span>
  );

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Schedule an interview">
      <div className="formCard modalCard">
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modalTitle">Schedule an interview</h2>
        <p style={{ color: "#a99bad", fontSize: 14, margin: "-10px 0 20px" }}>
          For <strong style={{ color: "#f4eef6" }}>{candidateName}</strong>. The slot is emailed to them straight away.
        </p>

        {error && <div className="alert err">⚠ {error}</div>}
        {state === "done" && mail?.sent && (
          <div className="alert ok">✓ Interview scheduled and the invite has been emailed.</div>
        )}
        {state === "done" && mail && !mail.sent && (
          <div className="alert err">
            ⚠ Interview saved, but the invite email did not go out{mail.error ? `: ${mail.error}` : "."}
            {" "}It is queued — run <code>npm run flush-outbox</code> or tell the candidate directly.
          </div>
        )}

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div className="two" style={{ gap: 16 }}>
            <div>
              <label htmlFor="iv-domain">Domain</label>
              <select id="iv-domain" className="input" value={form.domain} onChange={set("domain")} required>
                {domains.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              {err("domain")}
            </div>
            <div>
              <label htmlFor="iv-mode">Mode</label>
              <select id="iv-mode" className="input" value={form.mode} onChange={set("mode")}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="iv-slot">Date &amp; time</label>
            <input id="iv-slot" className="input" type="datetime-local" value={form.slotAt} onChange={set("slotAt")} required />
            {err("slotAt")}
          </div>

          <div>
            <label htmlFor="iv-location">{form.mode === "online" ? "Meeting link" : "Venue"}</label>
            <input
              id="iv-location"
              className="input"
              value={form.location}
              onChange={set("location")}
              placeholder={form.mode === "online" ? "https://meet.google.com/…" : "Tech Park, Seminar Hall 2"}
              required
            />
            {err("location")}
          </div>

          <div>
            <label htmlFor="iv-panel">Panel (comma separated)</label>
            <input id="iv-panel" className="input" value={form.panel} onChange={set("panel")} placeholder="Aditi, Rahul" required />
            {err("panel")}
          </div>

          <div>
            <label htmlFor="iv-notes">Internal notes (optional)</label>
            <textarea id="iv-notes" className="input" rows={2} value={form.notes} onChange={set("notes")} style={{ height: "auto" }} />
          </div>

          <button type="submit" className="btn grad" disabled={state !== "idle"} style={{ width: "100%", justifyContent: "center" }}>
            {state === "saving" ? "Scheduling…" : "Schedule interview"}
          </button>
        </form>
      </div>
    </div>
  );
}
