"use client";

import { useState } from "react";

/**
 * The mail queue, on the overview page.
 *
 * Anything the SMTP account could not take at the time — the daily budget was
 * spent, Gmail was throttling, the box was unreachable — stays in `emailOutbox`
 * as a pending row with a retry time. The app drains those whenever it next
 * sends something on its own, but a quiet evening means nothing triggers it and
 * the queue just sits there. This is the nudge, without needing a laptop with
 * the production connection string on it.
 *
 * The counts are rendered on the server so the panel is honest before anyone
 * touches it; pressing the button replaces them with what the run actually did.
 *
 * @param {{ initial: { quota: object, outbox: object }, canFlush: boolean }} props
 */
export default function OutboxPanel({ initial, canFlush }) {
  const [quota, setQuota] = useState(initial.quota);
  const [outbox, setOutbox] = useState(initial.outbox);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const pending = outbox.byStatus?.pending ?? 0;
  const failed = outbox.byStatus?.failed ?? 0;
  const sent = outbox.byStatus?.sent ?? 0;
  const pendingKinds = Object.entries(outbox.pendingByKind ?? {});

  async function flush() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/outbox", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not flush the outbox");
      setQuota(data.quota);
      setOutbox(data.outbox);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="formCard" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 15, letterSpacing: 1.4, color: "#8d8091", margin: "0 0 8px", textTransform: "uppercase" }}>
        Email queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Waiting to be delivered</span>
          <span className={`pill ${pending > 0 ? "warn" : "neutral"}`}>{pending}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Gave up permanently</span>
          <span className={`pill ${failed > 0 ? "bad" : "neutral"}`}>{failed}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Delivered so far</span>
          <span className="pill good">{sent}</span>
        </div>
      </div>

      {pendingKinds.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: "#8d8091", lineHeight: 1.7 }}>
          Undelivered: {pendingKinds.map(([kind, n]) => `${n} ${kind.replace(/-/g, " ")}`).join(" · ")}
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
          <span style={{ color: "#a99bad" }}>SMTP budget · {quota.day}</span>
          <span style={{ color: "#8d8091" }}>{quota.used}/{quota.limit}</span>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,.07)" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              width: `${Math.min(100, Math.round((quota.used / Math.max(1, quota.limit)) * 100))}%`,
              background: "var(--grad)",
            }}
          />
        </div>
        <div style={{ marginTop: 7, fontSize: 12.5, color: "#6f6474", lineHeight: 1.6 }}>
          {quota.remaining} left today · {quota.throttledRemaining} of those available to OTPs and
          announcements, the last {quota.reserve} are held back for confirmations.
        </div>
      </div>

      {error && <div className="alert err" style={{ marginTop: 16, marginBottom: 0 }}>⚠ {error}</div>}

      {result && (
        <div className={`alert ${result.failed > 0 ? "err" : "ok"}`} style={{ marginTop: 16, marginBottom: 0 }}>
          {result.sent === 0 && result.failed === 0 && result.deferred === 0
            ? "Nothing was due — the queue is clear."
            : `Sent ${result.sent} · failed ${result.failed} · deferred ${result.deferred}.`}
          {result.stopped === "deadline" && result.pending > 0 && (
            <> Stopped at the request limit with {result.pending} still queued — press it again.</>
          )}
          {result.stopped === "quota" && (
            <> Today&apos;s SMTP budget is spent; the rest is parked until IST midnight.</>
          )}
        </div>
      )}

      {canFlush ? (
        <button
          type="button"
          className="btn grad sm"
          onClick={flush}
          disabled={busy}
          style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
          title={pending === 0 ? "Nothing is queued right now" : `${pending} message(s) waiting`}
        >
          {busy ? "Delivering…" : pending > 0 ? `Send ${pending} queued email${pending === 1 ? "" : "s"}` : "Flush queue"}
        </button>
      ) : (
        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 12.5, color: "#6f6474" }}>
          Only an admin can drain the queue — it spends the shared SMTP budget.
        </p>
      )}

      {failed > 0 && (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12.5, color: "#6f6474", lineHeight: 1.6 }}>
          Failed rows hit a permanent error — a bad address, or a rejected sender. Flushing will not
          retry them; they need looking at in <code>emailOutbox</code>.
        </p>
      )}
    </section>
  );
}
