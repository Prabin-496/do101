import { ImageResponse } from "next/og";

export const alt = "DO101 — Do more. Simply. Free online tools, calculators and games.";
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
          justifyContent: "center",
          padding: "80px",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 26,
              background: "#4CC93F",
              color: "#fff",
              fontSize: 40,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            DO
          </div>
          <div style={{ fontSize: 62, fontWeight: 800, color: "#22303c" }}>DO101</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 84, fontWeight: 800, color: "#22303c" }}>
          Do more. Simply.
        </div>
        <div style={{ marginTop: 24, fontSize: 36, color: "#64757f", maxWidth: 900 }}>
          Free online tools, fast answers and fun challenges — most of them running right in your
          browser.
        </div>
        <div style={{ marginTop: 46, display: "flex", gap: 16, fontSize: 28, color: "#4CC93F", fontWeight: 700 }}>
          <span>do101.online</span>
        </div>
      </div>
    ),
    size,
  );
}
