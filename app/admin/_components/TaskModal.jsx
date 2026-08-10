"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUBMISSION_TYPES } from "@/lib/schemas";
import { toIsoOrEmpty, toLocalInputValue } from "./datetime";

const SUBMISSION_LABELS = { github: "GitHub only", drive: "Google Drive only", either: "Either" };

/**
 * Create or edit a task.
 *
 * Creating posts multipart/form-data because a PDF brief is required; editing
 * PATCHes JSON, since the document is not re-uploaded.
 */
export default function TaskModal({ domains, task, onClose }) {
  const router = useRouter();
  const isEdit = Boolean(task);

  const [form, setForm] = useState({
    domain: task?.domain ?? domains[0]?.key ?? "",
    title: task?.title ?? "",
    brief: task?.brief ?? "",
    submissionType: task?.submissionType ?? "either",
    dueAt: toLocalInputValue(task?.dueAt) ?? "",
    active: task?.active ?? true,
  });
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!isEdit && !file) {
      setError("A PDF brief is required when creating a task.");
      return;
    }
    setState("saving");

    try {
      let res;
      if (isEdit) {
        res = await fetch(`/api/admin/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            brief: form.brief,
            submissionType: form.submissionType,
            active: form.active,
            dueAt: toIsoOrEmpty(form.dueAt),
          }),
        });
      } else {
        const fd = new FormData();
        fd.set("domain", form.domain);
        fd.set("title", form.title);
        fd.set("brief", form.brief);
        fd.set("submissionType", form.submissionType);
        fd.set("dueAt", toIsoOrEmpty(form.dueAt));
        fd.set("active", String(form.active));
        fd.set("resources", "[]");
        fd.set("document", file);
        res = await fetch("/api/admin/tasks", { method: "POST", body: fd });
      }

      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.fields ?? {});
        throw new Error(data.error || "Could not save the task");
      }

      setState("done");
      router.refresh();
      setTimeout(onClose, 700);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  const err = (k) => fieldErrors[k] && (
    <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{fieldErrors[k]}</span>
  );

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit task" : "Create task"}>
      <div className="formCard modalCard">
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modalTitle">{isEdit ? "Edit task" : "Create a task"}</h2>

        {error && <div className="alert err">⚠ {error}</div>}
        {state === "done" && <div className="alert ok">✓ Saved.</div>}

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div className="two" style={{ gap: 16 }}>
            <div>
              <label htmlFor="task-domain">Domain</label>
              <select id="task-domain" className="input" value={form.domain} onChange={set("domain")} disabled={isEdit} required>
                {domains.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              {isEdit && <div style={{ fontSize: 12, color: "#8d8091", marginTop: 5 }}>Domain cannot be changed after creation.</div>}
              {err("domain")}
            </div>
            <div>
              <label htmlFor="task-submission">Accepted submission</label>
              <select id="task-submission" className="input" value={form.submissionType} onChange={set("submissionType")}>
                {SUBMISSION_TYPES.map((t) => <option key={t} value={t}>{SUBMISSION_LABELS[t]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="task-title">Title</label>
            <input id="task-title" className="input" value={form.title} onChange={set("title")} required placeholder="Build a responsive landing page" />
            {err("title")}
          </div>

          <div>
            <label htmlFor="task-brief">Brief</label>
            <textarea id="task-brief" className="input" rows={4} style={{ height: "auto" }} value={form.brief} onChange={set("brief")} required placeholder="What the candidate has to build, and how it will be judged…" />
            {err("brief")}
          </div>

          <div>
            <label htmlFor="task-due">Deadline</label>
            <input id="task-due" className="input" type="datetime-local" value={form.dueAt} onChange={set("dueAt")} required />
            {err("dueAt")}
          </div>

          {!isEdit && (
            <div>
              <label>Task document (PDF)</label>
              <div className="drop" style={{ marginTop: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: "#f2ebf4", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {file ? file.name : "No file chosen"}
                  </div>
                  <div style={{ fontSize: 13, color: "#9a8d9e", marginTop: 3 }}>PDF only · max 4 MB</div>
                </div>
                <label className="chooseFile" style={{ margin: 0 }}>
                  {file ? "Change" : "Choose file"}
                  <input type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              {err("document")}
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <input
              type="checkbox"
              className="check"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active — available to assign
          </label>

          <button type="submit" className="btn grad" disabled={state !== "idle"} style={{ width: "100%", justifyContent: "center" }}>
            {state === "saving" ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </button>
        </form>
      </div>
    </div>
  );
}
