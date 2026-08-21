"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXTEND_WINDOWS, DEFAULT_WINDOW, windowByKey } from "./extendWindows";

const PRESETS = [1, 2, 3, 5, 7];

/**
 * Gives the candidates who are running out of time the same amount of extra
 * time each.
 *
 * Two deliberate choices:
 *
 *  • **Who** is picked by time *remaining*, defaulting to under 24 hours.
 *    Extending someone with four days left does not help them; it just tells
 *    them the deadline is soft. See extendWindows.js.
 *
 *  • **How much** is a number of days, not a date. Each candidate is counted
 *    from whichever is later — their own deadline or right now — so an overdue
 *    candidate gets the full extension instead of nothing, and nobody who was
 *    already ahead has their deadline pulled backwards by a shared date.
 *
 * `pending` is the not-yet-submitted set the server page counted, bucketed per
 * window and per task, so switching either filter re-counts instantly rather
 * than going back to the server.
 */
export default function BulkExtendModal({ pending, onClose }) {
  const router = useRouter();

  const [days, setDays] = useState(2);
  const [taskId, setTaskId] = useState("");
  const [windowKey, setWindowKey] = useState(DEFAULT_WINDOW);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const chosen = windowByKey(windowKey);

  /** How many of one task's candidates the current window catches. */
  const inWindow = (t) => (windowKey === "all" ? t.count : (t.windows[windowKey] ?? 0));

  /** The same for every task at once — what "All tasks" is worth right now. */
  const affectedAcrossTasks = windowKey === "all" ? pending.total : (pending.windows[windowKey] ?? 0);

  // The same filtering the route does, so the count on the button matches what
  // the request will actually touch.
  const affected = taskId
    ? pending.tasks.filter((t) => t.id === taskId).reduce((n, t) => n + inWindow(t), 0)
    : affectedAcrossTasks;

  // Counted from the server's clock, not the browser's: reading Date.now()
  // during render is impure, and this is the same instant the counts above were
  // taken at, so the preview and the numbers can never disagree.
  const overdueLanding = useMemo(() => {
    const d = Number(days);
    const from = Date.parse(pending.now);
    if (!Number.isFinite(d) || d < 1 || Number.isNaN(from)) return null;
    return new Date(from + d * 86_400_000).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
    });
  }, [days, pending.now]);

  const plural = (n) => (Number(n) === 1 ? "" : "s");

  async function submit(e) {
    e.preventDefault();
    setError("");

    const d = Number(days);
    if (!Number.isInteger(d) || d < 1) {
      setError("Enter a whole number of days, at least 1.");
      return;
    }
    if (affected === 0) {
      setError("Nobody matches those filters — there is nothing to extend.");
      return;
    }

    // The window is spelled out, so a filter left on the wrong setting gets
    // caught here rather than after two hundred emails have gone out.
    const confirmed = window.confirm(
      [
        `Give ${affected} candidate${plural(affected)} ${d} more day${plural(d)}?`,
        `Who: ${chosen?.label ?? windowKey}`,
        notify ? "They will each be emailed the new date." : "",
      ].filter(Boolean).join("\n\n")
    );
    if (!confirmed) return;

    setState("saving");
    try {
      const res = await fetch("/api/admin/extensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: d,
          taskId: taskId || undefined,
          withinHours: windowByKey(windowKey)?.hours ?? undefined,
          notify,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fields?.days || data.error || "Could not extend the deadlines");
      setResult(data);
      setState("done");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Extend deadlines in bulk"
      onClick={(e) => e.target === e.currentTarget && state !== "saving" && onClose()}>
      <div className="formCard modalCard" style={{ maxWidth: 540 }}>
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modalTitle">Extend the ones running out of time</h2>
        <p style={{ color: "#a99bad", fontSize: 14, margin: "-10px 0 18px", lineHeight: 1.6 }}>
          Only candidates who haven&apos;t submitted and are near the wire. Each is counted from
          their own deadline, or from now if it has already passed — so someone overdue gets the
          full extension too.
        </p>

        {state === "done" && result ? (
          <>
            <div className="alert ok">
              ✓ Extended {result.extended} candidate{plural(result.extended)} by {days} day{plural(days)}.
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)",
              background: "rgba(0,0,0,.25)", fontSize: 14, lineHeight: 1.7, color: "#a99bad" }}>
              <div>Emails sent: <strong style={{ color: "#f4eef6" }}>{result.sent}</strong></div>
              {result.queued > 0 && (
                <div style={{ marginTop: 6 }}>
                  Queued for later: <strong style={{ color: "#f4eef6" }}>{result.queued}</strong>
                  <div className="sub">
                    The send ran out of time. Run <code>npm run flush-outbox</code> to push the rest out.
                  </div>
                </div>
              )}
              {result.failed?.length > 0 && (
                <div style={{ marginTop: 6, color: "var(--red-soft)" }}>
                  Failed: {result.failed.length} — {result.failed.slice(0, 3).join(", ")}
                  {result.failed.length > 3 ? "…" : ""}
                </div>
              )}
            </div>
            <button type="button" className="btn grad" onClick={onClose}
              style={{ width: "100%", justifyContent: "center", marginTop: 18 }}>
              Done
            </button>
          </>
        ) : (
          <>
            {error && <div className="alert err">⚠ {error}</div>}

            <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
              <div>
                <label htmlFor="bulk-window">Who gets it</label>
                <select id="bulk-window" className="input" value={windowKey}
                  onChange={(e) => setWindowKey(e.target.value)}>
                  {EXTEND_WINDOWS.map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.label} — {w.key === "all" ? pending.total : (pending.windows[w.key] ?? 0)}
                    </option>
                  ))}
                </select>
                <div className="sub" style={{ marginTop: 6 }}>
                  Anyone with more time than this is left alone — moving a deadline nobody is
                  close to just tells the rest of the drive it is negotiable.
                </div>
              </div>

              <div>
                <label htmlFor="bulk-task">Which task</label>
                <select id="bulk-task" className="input" value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}>
                  <option value="">All tasks — {affectedAcrossTasks}</option>
                  {pending.tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} — {inWindow(t)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bulk-days">How many days</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 10px" }}>
                  {PRESETS.map((d) => (
                    <button key={d} type="button" className="btnQuiet" onClick={() => setDays(d)}
                      style={Number(days) === d ? { borderColor: "var(--red)", color: "var(--red)" } : undefined}>
                      +{d} day{plural(d)}
                    </button>
                  ))}
                </div>
                <input id="bulk-days" className="input" type="number" min="1" max="60" step="1"
                  value={days} onChange={(e) => setDays(e.target.value)} required />
                {overdueLanding && (
                  <div className="sub" style={{ marginTop: 6 }}>
                    Overdue candidates land on {overdueLanding} IST. Everyone else moves {days} day{plural(days)} past
                    their own deadline.
                  </div>
                )}
              </div>

              <label style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: 0, cursor: "pointer" }}>
                <input type="checkbox" className="check" checked={notify}
                  onChange={(e) => setNotify(e.target.checked)} />
                <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                  Email everyone the new date
                  <span className="sub">
                    {affected} message{plural(affected)} against the day&apos;s SMTP budget. Turn it off and the new
                    deadline still shows on their dashboard.
                  </span>
                </span>
              </label>

              <div>
                <label htmlFor="bulk-reason">Reason (optional, shown to the candidates)</label>
                <input id="bulk-reason" className="input" value={reason} maxLength={200}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Task briefs went out late" />
              </div>

              <button type="submit" className="btn grad" disabled={state !== "idle" || affected === 0}
                style={{ width: "100%", justifyContent: "center" }}>
                {state === "saving"
                  ? "Extending…"
                  : affected === 0
                    ? "Nobody matches these filters"
                    : `Extend ${affected} candidate${plural(affected)} by ${days} day${plural(days)}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
