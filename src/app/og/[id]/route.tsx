import { ImageResponse } from "next/og";
import { TOOLS, getTool } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type Tool } from "@/lib/tools/types";
import { SITE } from "@/lib/site";

/**
 * A preview image for every tool, generated once at build time.
 *
 * Shared links, search results and AI answers that show a thumbnail used to
 * get the same site-wide card for all 130-odd tools, so a link to the PDF
 * merger looked identical to a link to the weather page. Each one now carries
 * its own name and promise.
 *
 * Built statically: generateStaticParams renders every image during the build,
 * so serving one costs nothing and needs no server work at request time.
 */

const ACCENTS: Record<Tool["accent"], { solid: string; soft: string }> = {
  grass: { solid: "#4cc93f", soft: "#eefbe9" },
  sky: { solid: "#22b8f0", soft: "#e6f7fe" },
  grape: { solid: "#b45cff", soft: "#f6ecff" },
  fire: { solid: "#ff8a00", soft: "#fff3e3" },
  sun: { solid: "#e0a800", soft: "#fff8dd" },
  cherry: { solid: "#ff4b4b", soft: "#ffecec" },
};

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ id: tool.id }));
}

/**
 * The default image font covers Latin text. Symbols such as ⇄ are not in it,
 * and a missing glyph makes the renderer reach out to the network for a font
 * mid-build, so they are swapped for plain equivalents first.
 */
function printable(text: string): string {
  return text
    .replace(/⇄|↔/g, "/")
    .replace(/[^ -ɏ–—’“”]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tool = getTool(id);
  if (!tool) return new Response("Not found", { status: 404 });

  const accent = ACCENTS[tool.accent];
  const name = printable(tool.name);
  const short = printable(tool.short);
  const category = CATEGORY_META[tool.category].label;

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
          background: "#ffffff",
          fontFamily: "sans-serif",
          borderTop: `18px solid ${accent.solid}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#4CC93F",
              color: "#fff",
              fontSize: 30,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            DO
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#22303c" }}>DO101</div>
          <div
            style={{
              marginLeft: 12,
              padding: "8px 20px",
              borderRadius: 999,
              background: accent.soft,
              color: "#22303c",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {category}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: name.length > 34 ? 60 : 76,
              fontWeight: 800,
              color: "#22303c",
              lineHeight: 1.08,
              maxWidth: 1040,
            }}
          >
            {name}
          </div>
          <div style={{ marginTop: 22, fontSize: 34, color: "#64757f", maxWidth: 1000, lineHeight: 1.3 }}>
            {short}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28, fontWeight: 700 }}>
          <span style={{ color: accent.solid }}>Free</span>
          <span style={{ color: "#cfd8dd" }}>·</span>
          <span style={{ color: "#64757f" }}>{tool.browserOnly ? "Runs in your browser" : "No account"}</span>
          <span style={{ color: "#cfd8dd" }}>·</span>
          <span style={{ color: "#64757f" }}>{SITE.url.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
