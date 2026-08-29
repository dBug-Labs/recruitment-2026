"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppPrompt() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone || phone.trim().length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/applications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber: phone.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save WhatsApp number");
      }

      router.refresh(); // Refresh the page to dismiss the prompt since layout re-fetches
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }}>
      <div className="formCard" style={{ padding: 32, maxWidth: 400, width: "100%" }}>
        <h2 style={{ fontSize: 24, margin: "0 0 16px", color: "var(--pink)" }}>One more thing</h2>
        <p style={{ color: "#a99bad", lineHeight: 1.6, margin: "0 0 24px" }}>
          We use WhatsApp for important announcements and quick updates during the recruitment process. Please provide your WhatsApp number to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div className="field">
            <label htmlFor="whatsappNumber">WhatsApp Number</label>
            <input
              id="whatsappNumber"
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              autoComplete="tel"
            />
          </div>

          {error && <div style={{ color: "var(--red)", fontSize: 14 }}>{error}</div>}

          <button type="submit" className="btn grad" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
