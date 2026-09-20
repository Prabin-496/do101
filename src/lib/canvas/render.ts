/**
 * How every element is drawn.
 *
 * The live canvas and the SVG exporter both read their geometry from here, so
 * what you see on screen is exactly what lands in the downloaded file. Shape
 * outlines and label wrapping come from `@/lib/diagram/shapes`, which the
 * work-breakdown chart shares.
 */
import { labelLineOffsets, shapeDetailPath, shapePath, wrapLabel } from "@/lib/diagram/shapes";
import {
  NOTE_KIND,
  TEXT_LINE_HEIGHT,
  round,
  textLines,
  type Dash,
  type Element,
  type LineEl,
  type NodeEl,
  type Paper,
  type Point,
  type Rect,
} from "./model";
import { strokePath } from "./stroke";

export { labelLineOffsets, shapeDetailPath, wrapLabel };

export const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Handwriting-ish face for sticky notes, falling back to the UI stack. */
export const NOTE_FONT_STACK = `'Comic Sans MS', 'Segoe Print', 'Bradley Hand', ${FONT_STACK}`;

export const NOTE_PADDING = 14;

export function fontFor(kind: NodeEl["kind"]): string {
  return kind === NOTE_KIND ? NOTE_FONT_STACK : FONT_STACK;
}

/**
 * Dashes scale with the line they are on.
 *
 * A fixed pattern looks like dots on a thick border and like a solid line on
 * a hairline, so the gaps are expressed as multiples of the width instead.
 */
export function dashArray(dash: Dash, width: number): string | undefined {
  switch (dash) {
    case "dashed":
      return `${round(width * 3)} ${round(width * 2.2)}`;
    case "dotted":
      return `${round(width * 0.1)} ${round(width * 2)}`;
    default:
      return undefined;
  }
}

/** The highlighter is translucent so what it covers still reads through it. */
export function strokeOpacity(el: Element): number {
  return el.type === "stroke" && el.kind === "highlighter" ? 0.38 : 1;
}

export function inkPath(el: { points: Point[] }): string {
  return strokePath(el.points);
}

export function linePath(el: Pick<LineEl, "from" | "to">): string {
  return `M ${round(el.from.x)} ${round(el.from.y)} L ${round(el.to.x)} ${round(el.to.y)}`;
}

/** The folded corner that makes a sticky note read as a sticky note. */
export function notePath(r: Rect): { body: string; fold: string } {
  const fold = Math.min(24, r.w * 0.25, r.h * 0.25);
  const { x, y, w, h } = r;
  return {
    body: [
      `M ${round(x)} ${round(y)}`,
      `H ${round(x + w)}`,
      `V ${round(y + h - fold)}`,
      `L ${round(x + w - fold)} ${round(y + h)}`,
      `H ${round(x)}`,
      "Z",
    ].join(" "),
    fold: [
      `M ${round(x + w)} ${round(y + h - fold)}`,
      `L ${round(x + w - fold)} ${round(y + h - fold)}`,
      `V ${round(y + h)}`,
    ].join(" "),
  };
}

/**
 * The outline of a node.
 *
 * Every kind but the sticky note comes straight from the shared shape
 * library; a note gets its folded corner instead of a plain rounded box.
 */
export function nodePath(node: Pick<NodeEl, "kind"> & Rect): string {
  if (node.kind === NOTE_KIND) return notePath(node).body;
  return shapePath(node);
}

export function nodeDetailPath(node: Pick<NodeEl, "kind"> & Rect): string | null {
  if (node.kind === NOTE_KIND) return notePath(node).fold;
  return shapeDetailPath(node);
}

/** A note is written on from the top-left; every other label is centred. */
export function isNoteLike(kind: NodeEl["kind"]): boolean {
  return kind === NOTE_KIND;
}

export interface LabelRow {
  line: string;
  x: number;
  /** Absolute y for the first row, then a per-row delta, as SVG tspans want. */
  dy: number;
}

/**
 * Where each line of a node's label goes.
 *
 * Centred labels wrap to the usable width of the shape; a sticky note is laid
 * out from its top-left corner like something actually written on paper.
 */
export function labelRows(node: NodeEl): { rows: LabelRow[]; x: number; y: number } | null {
  if (!node.text.trim()) return null;

  if (isNoteLike(node.kind)) {
    const x = node.x + NOTE_PADDING;
    const lines = wrapLabel(node.text, {
      ...node,
      // The fold eats the bottom-right corner, so wrap a little narrower.
      w: node.w - NOTE_PADDING * 2 + node.w * 0.16,
      kind: "rectangle",
    });
    return {
      x,
      y: node.y + NOTE_PADDING,
      rows: lines.map((line, i) => ({
        line,
        x,
        dy: round(i === 0 ? node.fontSize * 0.85 : node.fontSize * TEXT_LINE_HEIGHT),
      })),
    };
  }

  const lines = wrapLabel(node.text, node);
  if (!lines.length) return null;
  const x = node.x + node.w / 2;
  // Pointed shapes hold their text low of centre, where there is room.
  const bias = node.kind === "triangle" ? node.h * 0.15 : 0;
  const offsets = labelLineOffsets(lines.length, node.fontSize);
  return {
    x,
    y: node.y + node.h / 2 + bias,
    rows: lines.map((line, i) => ({
      line,
      x,
      dy: round(i === 0 ? offsets[0] : offsets[i] - offsets[i - 1]),
    })),
  };
}

export function arrowHead(tip: Point, from: Point, size: number): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const spread = 0.42;
  const a = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const b = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  return `M ${round(a.x)} ${round(a.y)} L ${round(tip.x)} ${round(tip.y)} L ${round(b.x)} ${round(b.y)}`;
}

export function arrowSize(width: number): number {
  return Math.max(8, width * 3.2);
}

/** Free text is laid out from the top, one line at a time. */
export function textRows(text: string, size: number): { line: string; dy: number }[] {
  return textLines(text).map((line, i) => ({
    line,
    dy: round(i === 0 ? size * 0.85 : size * TEXT_LINE_HEIGHT),
  }));
}

/** How wide the backing plate behind an edge label needs to be. */
export function edgeLabelWidth(label: string): number {
  return label.length * 7 + 14;
}

/**
 * One arrow marker per colour actually used.
 *
 * SVG2's `fill="context-stroke"` would avoid this, but it is not honoured
 * when a browser rasterises an SVG through an <img> for the PNG export, which
 * would leave every arrowhead black. Concrete fills work everywhere.
 */
export function markerId(color: string, prefix: string): string {
  return `${prefix}-${color.replace(/[^a-zA-Z0-9]/g, "") || "default"}`;
}

export function arrowColors(elements: Element[]): string[] {
  const colors = elements
    .filter((el) => el.type === "edge" && (el.startArrow || el.endArrow))
    .map((el) => (el as { stroke: string }).stroke);
  return [...new Set(colors)];
}

/* --------------------------------- the paper -------------------------------- */

export interface PaperPattern {
  size: number;
  path?: string;
  dot?: number;
}

/** The repeat used for each ruling, shared by the live canvas and the export. */
export const PAPER_PATTERN: Record<Exclude<Paper, "plain">, PaperPattern> = {
  grid: { size: 24, path: "M 24 0 L 0 0 0 24" },
  dots: { size: 24, dot: 1.4 },
  lined: { size: 32, path: "M 0 31.5 L 32 31.5" },
};

export const PAPER_INK = "rgba(0,0,0,0.13)";
