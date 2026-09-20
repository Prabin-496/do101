/**
 * Reading a saved diagram back in.
 *
 * A .do101 file is just JSON the visitor keeps on their own disk, so it can be
 * hand-edited, truncated or simply be some other file that was dragged in by
 * mistake. Everything is therefore validated and clamped rather than trusted,
 * and anything unrecognised falls back to a sane default instead of throwing.
 */
import {
  MAX_SHAPE,
  MIN_SHAPE,
  clampSize,
  createConnector,
  createShape,
  emptyDiagram,
  type Connector,
  type Diagram,
  type LineStyle,
  type PortOrAuto,
  type Routing,
  type Shape,
  type ShapeKind,
} from "./model";

export class DiagramParseError extends Error {}

const SHAPE_KINDS: ShapeKind[] = [
  "rectangle", "rounded", "ellipse", "diamond", "parallelogram",
  "hexagon", "cylinder", "triangle", "document", "note", "text",
];
const PORTS: PortOrAuto[] = ["auto", "top", "right", "bottom", "left"];
const STYLES: LineStyle[] = ["solid", "dashed", "dotted"];
const ROUTINGS: Routing[] = ["straight", "orthogonal", "curved"];

const MAX_SHAPES = 500;
const MAX_TEXT = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min = -100000, max = 100000): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value: unknown, fallback: string, maxLength = 200): string {
  if (typeof value !== "string") return fallback;
  return value.slice(0, maxLength);
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Colours are written straight into SVG attributes, so only plain hex, rgb(),
 * hsl(), `none` and `transparent` are allowed through. Anything else — a
 * `url(...)` reference, say — becomes the default rather than reaching markup.
 */
const COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent|none)$/i;

export function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return COLOR_PATTERN.test(trimmed) ? trimmed : fallback;
}

function parseShape(raw: unknown): Shape | null {
  if (!isRecord(raw)) return null;
  const kind = oneOf(raw.kind, SHAPE_KINDS, "rectangle");
  const base = createShape(kind, 0, 0, { id: str(raw.id, "", 64) || undefined });
  return {
    ...base,
    kind,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: clampSize(num(raw.w, base.w, MIN_SHAPE, MAX_SHAPE)),
    h: clampSize(num(raw.h, base.h, MIN_SHAPE, MAX_SHAPE)),
    text: str(raw.text, "", MAX_TEXT),
    fill: safeColor(raw.fill, base.fill),
    stroke: safeColor(raw.stroke, base.stroke),
    strokeWidth: num(raw.strokeWidth, base.strokeWidth, 0, 24),
    fontSize: num(raw.fontSize, base.fontSize, 8, 96),
    textColor: safeColor(raw.textColor, base.textColor),
    bold: raw.bold === true,
  };
}

function parseConnector(raw: unknown, shapeIds: Set<string>): Connector | null {
  if (!isRecord(raw)) return null;
  const from = str(raw.from, "", 64);
  const to = str(raw.to, "", 64);
  // A connector with no shape at either end would be invisible and undeletable.
  if (!shapeIds.has(from) || !shapeIds.has(to) || from === to) return null;

  const base = createConnector(from, to, { id: str(raw.id, "", 64) || undefined });
  return {
    ...base,
    fromPort: oneOf(raw.fromPort, PORTS, "auto"),
    toPort: oneOf(raw.toPort, PORTS, "auto"),
    label: str(raw.label, "", 120),
    stroke: safeColor(raw.stroke, base.stroke),
    strokeWidth: num(raw.strokeWidth, base.strokeWidth, 0.5, 16),
    style: oneOf(raw.style, STYLES, "solid"),
    routing: oneOf(raw.routing, ROUTINGS, "orthogonal"),
    startArrow: raw.startArrow === true,
    endArrow: raw.endArrow !== false,
  };
}

export function parseDiagram(raw: unknown): Diagram {
  if (!isRecord(raw)) throw new DiagramParseError("That file does not contain a diagram.");

  const fallback = emptyDiagram();
  const shapes: Shape[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw.shapes)) {
    for (const item of raw.shapes.slice(0, MAX_SHAPES)) {
      const shape = parseShape(item);
      // Duplicate ids would make selection and deletion ambiguous.
      if (!shape || seen.has(shape.id)) continue;
      seen.add(shape.id);
      shapes.push(shape);
    }
  }

  const connectors: Connector[] = [];
  const connectorIds = new Set<string>();
  if (Array.isArray(raw.connectors)) {
    for (const item of raw.connectors.slice(0, MAX_SHAPES * 2)) {
      const connector = parseConnector(item, seen);
      if (!connector || connectorIds.has(connector.id)) continue;
      connectorIds.add(connector.id);
      connectors.push(connector);
    }
  }

  return {
    name: str(raw.name, fallback.name, 120),
    background: safeColor(raw.background, fallback.background),
    grid: num(raw.grid, fallback.grid, 0, 100),
    shapes,
    connectors,
  };
}

/** Accepts both a whole .do101 file and a bare diagram object. */
export function parseDiagramFile(text: string): Diagram {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DiagramParseError("That file is not valid JSON, so it cannot be a saved diagram.");
  }
  if (isRecord(data) && isRecord(data.diagram)) return parseDiagram(data.diagram);
  return parseDiagram(data);
}
