import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4CC93F",
          color: "white",
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: -4,
          // Apple applies its own mask, so the square is drawn edge to edge.
        }}
      >
        DO
      </div>
    ),
    size,
  );
}
