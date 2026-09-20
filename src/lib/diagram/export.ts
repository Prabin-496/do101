/**
 * Turning a diagram into something you can take away.
 *
 * `toSvg` is the single source of truth for the exported picture: the PNG
 * path rasterises this very string, so the two downloads can never drift.
 */
import {
  connectorGeometry,
  diagramBounds,
  round,
  shapeIndex,
  type Connector,
  type Diagram,
  type Shape,
} from "./model";
import { DASH_ARRAY, labelLineOffsets, shapeDetailPath, shapePath, wrapLabel } from "./shapes";

export const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Escapes the five XML entities. Labels are user text and go into markup. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shapeMarkup(shape: Shape): string {
  const parts: string[] = [];
  const stroke = shape.stroke === "transparent" ? "none" : shape.stroke;

  parts.push(
    `<path d="${shapePath(shape)}" fill="${escapeXml(shape.fill)}" stroke="${escapeXml(stroke)}" stroke-width="${shape.strokeWidth}" stroke-linejoin="round" />`,
  );

  const detail = shapeDetailPath(shape);
  if (detail) {
    parts.push(
      `<path d="${detail}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${shape.strokeWidth}" />`,
    );
  }

  const lines = wrapLabel(shape.text, shape);
  if (lines.length) {
    const cx = round(shape.x + shape.w / 2);
    // Pointed shapes hold their text low of centre, where there is room.
    const bias = shape.kind === "triangle" ? shape.h * 0.15 : 0;
    const cy = round(shape.y + shape.h / 2 + bias);
    const offsets = labelLineOffsets(lines.length, shape.fontSize);
    const tspans = lines
      .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? offsets[0] : round(offsets[i] - offsets[i - 1])}">${escapeXml(line) || " "}</tspan>`)
      .join("");
    parts.push(
      `<text x="${cx}" y="${cy}" font-family="${FONT_STACK}" font-size="${shape.fontSize}" font-weight="${shape.bold ? 700 : 500}" fill="${escapeXml(shape.textColor)}" text-anchor="middle" dominant-baseline="middle">${tspans}</text>`,
    );
  }

  return parts.join("");
}

function connectorMarkup(
  connector: Connector,
  byId: Map<string, Shape>,
  markerId: (color: string, end: "start" | "end") => string,
): string {
  const a = byId.get(connector.from);
  const b = byId.get(connector.to);
  if (!a || !b) return "";

  const geo = connectorGeometry(connector, a, b);
  const dash = DASH_ARRAY[connector.style];
  const attrs = [
    `d="${geo.path}"`,
    `fill="none"`,
    `stroke="${escapeXml(connector.stroke)}"`,
    `stroke-width="${connector.strokeWidth}"`,
    `stroke-linecap="round"`,
    `stroke-linejoin="round"`,
    dash ? `stroke-dasharray="${dash}"` : "",
    connector.endArrow ? `marker-end="url(#${markerId(connector.stroke, "end")})"` : "",
    connector.startArrow ? `marker-start="url(#${markerId(connector.stroke, "start")})"` : "",
  ].filter(Boolean);

  let markup = `<path ${attrs.join(" ")} />`;

  if (connector.label.trim()) {
    const text = escapeXml(connector.label);
    // A padded backing rect keeps the label readable where it crosses the line.
    const width = connector.label.length * 7 + 12;
    markup +=
      `<rect x="${round(geo.mid.x - width / 2)}" y="${round(geo.mid.y - 11)}" width="${round(width)}" height="22" rx="6" fill="#ffffff" fill-opacity="0.88" />` +
      `<text x="${round(geo.mid.x)}" y="${round(geo.mid.y)}" font-family="${FONT_STACK}" font-size="12" font-weight="600" fill="${escapeXml(connector.stroke)}" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
  }

  return markup;
}

/**
 * One arrow marker per colour actually used.
 *
 * SVG2's `fill="context-stroke"` would avoid this, but it is not honoured when
 * a browser rasterises an SVG through an <img> for the PNG export, which would
 * leave every arrowhead black. Concrete fills work everywhere.
 */
function markerIdFor(color: string, end: "start" | "end"): string {
  const safe = color.replace(/[^a-zA-Z0-9]/g, "") || "default";
  return `do101-arrow-${end}-${safe}`;
}

function arrowDefs(connectors: Connector[]): string {
  const wanted = new Map<string, string>();
  for (const connector of connectors) {
    if (connector.endArrow) wanted.set(markerIdFor(connector.stroke, "end"), connector.stroke);
    if (connector.startArrow) wanted.set(markerIdFor(connector.stroke, "start"), connector.stroke);
  }
  if (wanted.size === 0) return "";

  const markers = [...wanted]
    .map(
      ([id, color]) =>
        `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(color)}" /></marker>`,
    )
    .join("");
  return `<defs>${markers}</defs>`;
}

export interface SvgOptions {
  /** Transparent PNG/SVG for pasting onto a slide. */
  transparent?: boolean;
  padding?: number;
  scale?: number;
}

export function toSvg(diagram: Diagram, options: SvgOptions = {}): string {
  const { transparent = false, padding = 40, scale = 1 } = options;
  const box = diagramBounds(diagram, padding);
  const byId = shapeIndex(diagram.shapes);

  const background = transparent
    ? ""
    : `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${escapeXml(diagram.background)}" />`;

  // Connectors first so they pass behind the shapes they join.
  const body =
    diagram.connectors.map((c) => connectorMarkup(c, byId, markerIdFor)).join("") +
    diagram.shapes.map(shapeMarkup).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(box.w * scale)}" height="${round(box.h * scale)}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">`,
    `<title>${escapeXml(diagram.name)}</title>`,
    arrowDefs(diagram.connectors),
    background,
    body,
    `</svg>`,
  ].join("");
}

/* ------------------------------- the .do101 file ------------------------------ */

export const FILE_VERSION = 1;

export interface DiagramFile {
  format: "do101-diagram";
  version: number;
  savedAt: string;
  diagram: Diagram;
}

export function toFile(diagram: Diagram): string {
  const file: DiagramFile = {
    format: "do101-diagram",
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    diagram,
  };
  return JSON.stringify(file, null, 2);
}
