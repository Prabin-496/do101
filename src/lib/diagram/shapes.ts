/**
 * Shape outlines and text layout.
 *
 * Both the live canvas and the SVG export draw from these functions, so what
 * you see on screen is exactly what lands in the downloaded file.
 */
import { round, type Rect, type Shape, type ShapeKind } from "./model";

/** The corner radius used by the rounded-rectangle and note shapes. */
const RADIUS = 12;

function rect(r: Rect, radius = 0): string {
  const { x, y, w, h } = r;
  if (radius <= 0) {
    return `M ${round(x)} ${round(y)} H ${round(x + w)} V ${round(y + h)} H ${round(x)} Z`;
  }
  const rad = Math.min(radius, w / 2, h / 2);
  return [
    `M ${round(x + rad)} ${round(y)}`,
    `H ${round(x + w - rad)}`,
    `A ${round(rad)} ${round(rad)} 0 0 1 ${round(x + w)} ${round(y + rad)}`,
    `V ${round(y + h - rad)}`,
    `A ${round(rad)} ${round(rad)} 0 0 1 ${round(x + w - rad)} ${round(y + h)}`,
    `H ${round(x + rad)}`,
    `A ${round(rad)} ${round(rad)} 0 0 1 ${round(x)} ${round(y + h - rad)}`,
    `V ${round(y + rad)}`,
    `A ${round(rad)} ${round(rad)} 0 0 1 ${round(x + rad)} ${round(y)}`,
    "Z",
  ].join(" ");
}

function polygon(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${round(x)} ${round(y)}`).join(" ") + " Z";
}

/**
 * The outline of a shape as an SVG path.
 *
 * Ellipses and cylinders are approximated with arcs rather than <ellipse>
 * elements so that every shape is a single <path> with one uniform styling
 * code path in both the editor and the exporter.
 */
export function shapePath(shape: Pick<Shape, "kind"> & Rect): string {
  const { x, y, w, h, kind } = shape;
  const inset = Math.min(w, h) * 0.22;

  switch (kind) {
    case "rectangle":
    case "text":
      return rect(shape);
    case "rounded":
    case "note":
      return rect(shape, RADIUS);
    case "ellipse": {
      const rx = w / 2;
      const ry = h / 2;
      // Two half-arcs, because a single arc command cannot close a full ellipse.
      return [
        `M ${round(x)} ${round(y + ry)}`,
        `A ${round(rx)} ${round(ry)} 0 0 1 ${round(x + w)} ${round(y + ry)}`,
        `A ${round(rx)} ${round(ry)} 0 0 1 ${round(x)} ${round(y + ry)}`,
        "Z",
      ].join(" ");
    }
    case "diamond":
      return polygon([
        [x + w / 2, y],
        [x + w, y + h / 2],
        [x + w / 2, y + h],
        [x, y + h / 2],
      ]);
    case "parallelogram":
      return polygon([
        [x + inset, y],
        [x + w, y],
        [x + w - inset, y + h],
        [x, y + h],
      ]);
    case "hexagon":
      return polygon([
        [x + inset, y],
        [x + w - inset, y],
        [x + w, y + h / 2],
        [x + w - inset, y + h],
        [x + inset, y + h],
        [x, y + h / 2],
      ]);
    case "triangle":
      return polygon([
        [x + w / 2, y],
        [x + w, y + h],
        [x, y + h],
      ]);
    case "document": {
      const wave = h * 0.16;
      return [
        `M ${round(x)} ${round(y)}`,
        `H ${round(x + w)}`,
        `V ${round(y + h - wave)}`,
        `C ${round(x + w * 0.75)} ${round(y + h)}, ${round(x + w * 0.25)} ${round(y + h - wave * 2)}, ${round(x)} ${round(y + h - wave)}`,
        "Z",
      ].join(" ");
    }
    case "cylinder": {
      const ry = Math.min(h * 0.18, 22);
      return [
        `M ${round(x)} ${round(y + ry)}`,
        `A ${round(w / 2)} ${round(ry)} 0 0 1 ${round(x + w)} ${round(y + ry)}`,
        `V ${round(y + h - ry)}`,
        `A ${round(w / 2)} ${round(ry)} 0 0 1 ${round(x)} ${round(y + h - ry)}`,
        "Z",
      ].join(" ");
    }
  }
}

/**
 * The lid of a cylinder and the fold of a note are drawn as a second,
 * unfilled path on top of the body.
 */
export function shapeDetailPath(shape: Pick<Shape, "kind"> & Rect): string | null {
  const { x, y, w, h, kind } = shape;
  if (kind === "cylinder") {
    const ry = Math.min(h * 0.18, 22);
    return [
      `M ${round(x)} ${round(y + ry)}`,
      `A ${round(w / 2)} ${round(ry)} 0 0 0 ${round(x + w)} ${round(y + ry)}`,
    ].join(" ");
  }
  return null;
}

/** Text is inset so it never touches the outline of a pointed shape. */
export function textInset(kind: ShapeKind): number {
  switch (kind) {
    case "diamond":
    case "triangle":
      return 0.3;
    case "hexagon":
    case "parallelogram":
      return 0.18;
    default:
      return 0.08;
  }
}

const AVERAGE_GLYPH_RATIO = 0.58;

/**
 * Wraps label text to the usable width of a shape.
 *
 * Measured with an average glyph ratio rather than a canvas metric: the
 * exporter has to wrap identically on a server render where no canvas exists,
 * and being a hair conservative is better than clipping.
 */
export function wrapLabel(text: string, shape: Rect & Pick<Shape, "kind" | "fontSize">): string[] {
  const clean = text.replace(/\r/g, "");
  if (!clean.trim()) return [];

  const usable = shape.w * (1 - textInset(shape.kind) * 2);
  const perLine = Math.max(1, Math.floor(usable / (shape.fontSize * AVERAGE_GLYPH_RATIO)));
  const lines: string[] = [];

  for (const paragraph of clean.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= perLine) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // A single word longer than the line gets hard-broken rather than clipped.
      if (word.length > perLine) {
        let rest = word;
        while (rest.length > perLine) {
          lines.push(rest.slice(0, perLine));
          rest = rest.slice(perLine);
        }
        current = rest;
      } else {
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export const LINE_HEIGHT = 1.35;

/** The y baseline of each wrapped line, vertically centred in the shape. */
export function labelLineOffsets(lineCount: number, fontSize: number): number[] {
  const step = fontSize * LINE_HEIGHT;
  const first = -((lineCount - 1) * step) / 2;
  return Array.from({ length: lineCount }, (_, i) => round(first + i * step));
}

export const DASH_ARRAY: Record<string, string | undefined> = {
  solid: undefined,
  dashed: "10 6",
  dotted: "2 6",
};
