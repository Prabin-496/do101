/**
 * Turning a board into something you can take away.
 *
 * `toSvg` is the single source of truth for the exported picture: the PNG
 * path rasterises this very string, so the two downloads can never drift.
 */
import {
  drawOrder,
  edgeGeometry,
  nodeIndex,
  round,
  unionBounds,
  type Board,
  type Doc,
  type EdgeEl,
  type Element,
  type NodeEl,
  type Rect,
} from "./model";
import {
  FONT_STACK,
  PAPER_INK,
  PAPER_PATTERN,
  arrowColors,
  arrowHead,
  arrowSize,
  dashArray,
  edgeLabelWidth,
  fontFor,
  inkPath,
  labelRows,
  linePath,
  markerId,
  nodeDetailPath,
  nodePath,
  strokeOpacity,
  textRows,
} from "./render";

/** Escapes the five XML entities. Labels are user text and go into markup. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const MARKER_PREFIX = "do101-arrow";

function nodeMarkup(node: NodeEl): string {
  const parts: string[] = [];
  const stroke = node.stroke === "transparent" ? "none" : node.stroke;
  const dash = stroke === "none" ? undefined : dashArray(node.dash, Math.max(1, node.strokeWidth));

  parts.push(
    `<path d="${nodePath(node)}" fill="${escapeXml(node.fill)}" stroke="${escapeXml(stroke)}" stroke-width="${node.strokeWidth}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""} />`,
  );

  const detail = nodeDetailPath(node);
  if (detail) {
    parts.push(
      `<path d="${detail}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${node.strokeWidth}" />`,
    );
  }

  const label = labelRows(node);
  if (label) {
    const anchor = label.rows[0]?.x ?? node.x;
    const spans = label.rows
      .map((row) => `<tspan x="${round(row.x)}" dy="${row.dy}">${escapeXml(row.line) || " "}</tspan>`)
      .join("");
    const centred = node.kind !== "note";
    parts.push(
      `<text x="${round(anchor)}" y="${round(label.y)}" font-family="${fontFor(node.kind)}" font-size="${node.fontSize}" font-weight="${node.bold ? 700 : 500}" fill="${escapeXml(node.textColor)}"${centred ? ' text-anchor="middle" dominant-baseline="middle"' : ""} xml:space="preserve">${spans}</text>`,
    );
  }

  return parts.join("");
}

function edgeMarkup(edge: EdgeEl, index: Map<string, NodeEl>): string {
  const geo = edgeGeometry(edge, index);
  if (!geo) return "";

  const dash = dashArray(edge.dash, edge.strokeWidth);
  const attrs = [
    `d="${geo.path}"`,
    `fill="none"`,
    `stroke="${escapeXml(edge.stroke)}"`,
    `stroke-width="${edge.strokeWidth}"`,
    `stroke-linecap="round"`,
    `stroke-linejoin="round"`,
    dash ? `stroke-dasharray="${dash}"` : "",
    edge.endArrow ? `marker-end="url(#${markerId(edge.stroke, MARKER_PREFIX)})"` : "",
    edge.startArrow ? `marker-start="url(#${markerId(edge.stroke, MARKER_PREFIX)})"` : "",
  ].filter(Boolean);

  let markup = `<path ${attrs.join(" ")} />`;

  if (edge.label.trim()) {
    // A padded backing plate keeps the label readable where it crosses the line.
    const width = edgeLabelWidth(edge.label);
    markup +=
      `<rect x="${round(geo.mid.x - width / 2)}" y="${round(geo.mid.y - 11)}" width="${round(width)}" height="22" rx="6" fill="#ffffff" fill-opacity="0.88" />` +
      `<text x="${round(geo.mid.x)}" y="${round(geo.mid.y)}" font-family="${FONT_STACK}" font-size="12" font-weight="600" fill="${escapeXml(edge.stroke)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(edge.label)}</text>`;
  }

  return markup;
}

function elementMarkup(el: Element, index: Map<string, NodeEl>): string {
  switch (el.type) {
    case "stroke":
      return `<path d="${inkPath(el)}" fill="none" stroke="${escapeXml(el.color)}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${strokeOpacity(el)}" />`;

    case "line": {
      const dash = dashArray(el.dash, el.width);
      const parts = [
        `<path d="${linePath(el)}" fill="none" stroke="${escapeXml(el.color)}" stroke-width="${el.width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ""} />`,
      ];
      // Heads are drawn as their own solid strokes so a dashed shaft still
      // ends in a clean arrow.
      const size = arrowSize(el.width);
      if (el.arrowEnd) {
        parts.push(
          `<path d="${arrowHead(el.to, el.from, size)}" fill="none" stroke="${escapeXml(el.color)}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round" />`,
        );
      }
      if (el.arrowStart) {
        parts.push(
          `<path d="${arrowHead(el.from, el.to, size)}" fill="none" stroke="${escapeXml(el.color)}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round" />`,
        );
      }
      return parts.join("");
    }

    case "node":
      return nodeMarkup(el);

    case "edge":
      return edgeMarkup(el, index);

    case "text": {
      const rows = textRows(el.text, el.size);
      if (!rows.length) return "";
      const spans = rows
        .map((row) => `<tspan x="${round(el.x)}" dy="${row.dy}">${escapeXml(row.line) || " "}</tspan>`)
        .join("");
      return `<text x="${round(el.x)}" y="${round(el.y)}" font-family="${FONT_STACK}" font-size="${el.size}" font-weight="${el.bold ? 700 : 500}" fill="${escapeXml(el.color)}" xml:space="preserve">${spans}</text>`;
    }

    case "image":
      return `<image x="${round(el.x)}" y="${round(el.y)}" width="${round(el.w)}" height="${round(el.h)}" href="${escapeXml(el.href)}" preserveAspectRatio="none"><title>${escapeXml(el.alt)}</title></image>`;
  }
}

/** One marker per arrow colour in use, and nothing when there are no arrows. */
function arrowDefs(elements: Element[]): string {
  const colors = arrowColors(elements);
  if (!colors.length) return "";
  const markers = colors
    .map(
      (color) =>
        `<marker id="${markerId(color, MARKER_PREFIX)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(color)}" /></marker>`,
    )
    .join("");
  return `<defs>${markers}</defs>`;
}

/** The paper, which is part of the picture people expect to get. */
function paperMarkup(board: Board, box: Rect): string {
  const base = `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${escapeXml(board.paperColor)}" />`;
  if (board.paper === "plain") return base;

  const spec = PAPER_PATTERN[board.paper];
  const id = `do101-paper-${board.paper}`;
  const inner = spec.path
    ? `<path d="${spec.path}" fill="none" stroke="${PAPER_INK}" stroke-width="1" />`
    : `<circle cx="2" cy="2" r="${spec.dot}" fill="${PAPER_INK}" />`;

  return (
    base +
    `<defs><pattern id="${id}" width="${spec.size}" height="${spec.size}" patternUnits="userSpaceOnUse">${inner}</pattern></defs>` +
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${id})" />`
  );
}

export interface SvgOptions {
  /** Leaves the paper out, for pasting onto a slide. */
  transparent?: boolean;
  padding?: number;
  scale?: number;
  /** Exports this area instead of whatever the drawing happens to occupy. */
  area?: Rect;
}

export function boardBounds(board: Board, padding = 48): Rect {
  const box = unionBounds(board.elements, padding);
  if (!box) return { x: 0, y: 0, w: 960, h: 600 };
  return {
    x: round(box.x),
    y: round(box.y),
    w: round(Math.max(120, box.w)),
    h: round(Math.max(120, box.h)),
  };
}

export function toSvg(board: Board, options: SvgOptions = {}): string {
  const { transparent = false, padding = 48, scale = 1, area } = options;
  const box = area ?? boardBounds(board, padding);
  const index = nodeIndex(board.elements);

  const body = drawOrder(board.elements)
    .map((el) => elementMarkup(el, index))
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${round(box.w * scale)}" height="${round(box.h * scale)}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">`,
    `<title>${escapeXml(board.name)}</title>`,
    arrowDefs(board.elements),
    transparent ? "" : paperMarkup(board, box),
    body,
    `</svg>`,
  ].join("");
}

/** Where a group of elements sits, used when framing an export on a selection. */
export function selectionArea(elements: Element[], padding = 24): Rect | null {
  return unionBounds(elements, padding);
}

/* ------------------------------- the save file ------------------------------ */

export const FILE_VERSION = 1;
export const FILE_FORMAT = "do101-canvas";

export interface CanvasFile {
  format: typeof FILE_FORMAT;
  version: number;
  savedAt: string;
  doc: Doc;
}

export function toFile(doc: Doc): string {
  const file: CanvasFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    doc,
  };
  return JSON.stringify(file, null, 2);
}
