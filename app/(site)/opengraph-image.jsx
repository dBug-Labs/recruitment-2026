import { ImageResponse } from "next/og";

/**
 * The share card for every link that does not override it — WhatsApp, LinkedIn,
 * Discord, X. Generated rather than shipped as a PNG so the dates and wording
 * stay in sync with the landing page.
 *
 * ImageResponse only supports flexbox and a subset of CSS: no grid, and every
 * container with more than one child needs an explicit `display: flex`.
 */
export const alt = "dBug Labs — Brand New Day | Recruitments '26";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #08050a 0%, #150a1c 55%, #1d0a16 100%)",
          color: "#f2eaf4",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand line */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#ff2d4f",
            }}
          />
          <div
            style={{
              fontSize: 26,
              letterSpacing: 8,
              fontWeight: 700,
              color: "#efe7f2",
            }}
          >
            dBUG LABS
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 24,
              letterSpacing: 10,
              color: "#b06bff",
              marginBottom: 18,
            }}
          >
            PROJECT:
          </div>
          <div
            style={{
              fontSize: 116,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: -2,
              background: "linear-gradient(90deg, #ff2d4f, #b06bff)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Brand New Day
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 34,
              color: "#cdc1d0",
              lineHeight: 1.35,
            }}
          >
            Every great developer starts with one decision.
          </div>
        </div>

        {/* Footer strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.14)",
            paddingTop: 30,
          }}
        >
          <div style={{ display: "flex", fontSize: 27, color: "#9a8d9e" }}>
            10 domains · tech &amp; corporate
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: 4,
              color: "#ff3a58",
            }}
          >
            RECRUITMENTS &apos;26 — NOW OPEN
          </div>
        </div>
      </div>
    ),
    size
  );
}
