/**
 * Reading a saved canvas back in.
 *
 * A .do101 file is JSON the visitor keeps on their own disk, so it can be
 * hand-edited, truncated, or simply be some other file dragged in by mistake.
 * Everything is validated and clamped rather than trusted, and anything
 * unrecognised falls back to a sane default instead of throwing.
 *
 * Three shapes of file are accepted: a canvas document, and the whiteboard
 * and diagram files the two tools this one replaced used to write. Nobody
 * should lose work to a merge.
 */
import { parseDiagram } from "@/lib/diagram/parse";
import { boardFromDiagram } from "./convert";
import {
  MIN_NODE,
  MIN_SIZE,
  createNode,
  emptyBoard,
  emptyDoc,
  newId,
  nodeSize,
  type Board,
  type Dash,
  type Doc,
  type Element,
  type NodeEl,
  type Paper,
  type Point,
  type PortOrAuto,
  type Routing,
  type ShapeKind,
} from "./model";

export class CanvasParseError extends Error {}

const DASHES: Dash[] = ["solid", "dashed", "dotted"];
const PAPERS: Paper[] = ["plain", "grid", "dots", "lined"];
const PORTS: PortOrAuto[] = ["auto", "top", "right", "bottom", "left"];
const ROUTINGS: Routing[] = ["straight", "orthogonal", "curved"];
const NODE_KINDS: ShapeKind[] = [
  "rectangle", "rounded", "ellipse", "diamond", "parallelogram",
  "hexagon", "cylinder", "triangle", "document", "note", "text",
];

const MAX_BOARDS = 60;
const MAX_ELEMENTS = 4000;
const MAX_POINTS = 8000;
const MAX_TEXT = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min = -200000, max = 200000): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value: unknown, fallback: string, maxLength = 200): string {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
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

/**
 * Pictures must be self-contained data URLs.
 *
 * An `http(s)` or `javascript:` href in a saved file would make the browser
 * fetch — or run — someone else's URL the moment the board was opened or
 * exported, which would quietly break the promise that nothing leaves the
 * device. Only inline image data is accepted.
 */
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i;

export function safeImageHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATA_IMAGE.test(trimmed) ? trimmed : null;
}

function points(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  const out: Point[] = [];
  for (const raw of value.slice(0, MAX_POINTS)) {
    if (!isRecord(raw)) continue;
    const x = num(raw.x, NaN);
    const y = num(raw.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}

function parseNode(raw: Record<string, unknown>, id: string, kind: ShapeKind): NodeEl {
  const base = createNode(kind, 0, 0, { id });
  const size = nodeSize(kind);
  return {
    ...base,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: Math.max(MIN_NODE, num(raw.w, size.w, 0, 200000)),
    h: Math.max(MIN_NODE, num(raw.h, size.h, 0, 200000)),
    text: str(raw.text, "", MAX_TEXT),
    fill: safeColor(raw.fill, base.fill),
    stroke: safeColor(raw.stroke ?? raw.color, base.stroke),
    strokeWidth: num(raw.strokeWidth ?? raw.width, base.strokeWidth, 0, 24),
    dash: oneOf(raw.dash, DASHES, "solid"),
    fontSize: num(raw.fontSize ?? raw.size, base.fontSize, 6, 200),
    textColor: safeColor(raw.textColor, base.textColor),
    bold: raw.bold === true,
  };
}

function parseElement(raw: unknown): Element | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id, "", 64) || newId();
  const color = safeColor(raw.color, "#22303c");
  const width = num(raw.width, 3, 0.5, 200);

  switch (raw.type) {
    case "stroke": {
      const p = points(raw.points);
      // A stroke with nothing in it would be invisible and unselectable.
      if (!p.length) return null;
      return {
        id,
        type: "stroke",
        kind: raw.kind === "highlighter" ? "highlighter" : "pen",
        points: p,
        color,
        width,
      };
    }

    case "line": {
      const from = isRecord(raw.from) ? { x: num(raw.from.x, 0), y: num(raw.from.y, 0) } : null;
      const to = isRecord(raw.to) ? { x: num(raw.to.x, 0), y: num(raw.to.y, 0) } : null;
      if (!from || !to) return null;
      return {
        id,
        type: "line",
        from,
        to,
        color,
        width,
        dash: oneOf(raw.dash, DASHES, "solid"),
        arrowStart: raw.arrowStart === true,
        arrowEnd: raw.arrowEnd === true,
      };
    }

    case "node":
      return parseNode(raw, id, oneOf(raw.kind, NODE_KINDS, "rectangle"));

    // A whiteboard file's plain boxes become nodes, which can do everything
    // they could and can also be labelled and joined up.
    case "rect":
      return parseNode({ ...raw, fill: raw.fill ?? "transparent" }, id, "rectangle");
    case "ellipse":
      return parseNode({ ...raw, fill: raw.fill ?? "transparent" }, id, "ellipse");
    case "note":
      return parseNode(
        { ...raw, textColor: raw.textColor ?? raw.color, stroke: "transparent", strokeWidth: 0 },
        id,
        "note",
      );

    case "edge": {
      const from = str(raw.from, "", 64);
      const to = str(raw.to, "", 64);
      // Endpoints are checked against the board's nodes by the caller; an
      // edge with no ids at all can be dropped straight away.
      if (!from || !to || from === to) return null;
      return {
        id,
        type: "edge",
        from,
        to,
        fromPort: oneOf(raw.fromPort, PORTS, "auto"),
        toPort: oneOf(raw.toPort, PORTS, "auto"),
        label: str(raw.label, "", 120),
        stroke: safeColor(raw.stroke, "#64757f"),
        strokeWidth: num(raw.strokeWidth, 2, 0.5, 16),
        dash: oneOf(raw.dash ?? raw.style, DASHES, "solid"),
        routing: oneOf(raw.routing, ROUTINGS, "orthogonal"),
        startArrow: raw.startArrow === true,
        endArrow: raw.endArrow !== false,
      };
    }

    case "text":
      return {
        id,
        type: "text",
        x: num(raw.x, 0),
        y: num(raw.y, 0),
        w: Math.max(MIN_SIZE, num(raw.w, 200, 0, 200000)),
        h: Math.max(MIN_SIZE, num(raw.h, 40, 0, 200000)),
        text: str(raw.text, "", MAX_TEXT),
        color,
        size: num(raw.size, 24, 6, 400),
        bold: raw.bold === true,
      };

    case "image": {
      const href = safeImageHref(raw.href);
      if (!href) return null;
      return {
        id,
        type: "image",
        x: num(raw.x, 0),
        y: num(raw.y, 0),
        w: Math.max(MIN_SIZE, num(raw.w, 200, 0, 200000)),
        h: Math.max(MIN_SIZE, num(raw.h, 200, 0, 200000)),
        href,
        alt: str(raw.alt, "Pasted image", 200),
      };
    }

    default:
      return null;
  }
}

function parseBoard(raw: unknown, index: number): Board {
  const fallback = emptyBoard(`Board ${index + 1}`);
  if (!isRecord(raw)) return fallback;

  const elements: Element[] = [];
  const seen = new Set<string>();
  const nodes = new Set<string>();

  if (Array.isArray(raw.elements)) {
    for (const item of raw.elements.slice(0, MAX_ELEMENTS)) {
      const el = parseElement(item);
      // Duplicate ids would make selection and deletion ambiguous.
      if (!el || seen.has(el.id)) continue;
      seen.add(el.id);
      if (el.type === "node") nodes.add(el.id);
      elements.push(el);
    }
  }

  return {
    id: str(raw.id, "", 64) || fallback.id,
    name: str(raw.name, fallback.name, 80),
    paper: oneOf(raw.paper ?? raw.background, PAPERS, "plain"),
    paperColor: safeColor(raw.paperColor ?? raw.backgroundColor, "#ffffff"),
    grid: num(raw.grid, 10, 0, 100),
    // An edge pointing at a node that is not here would be invisible and
    // undeletable, so it goes rather than dangling.
    elements: elements.filter(
      (el) => el.type !== "edge" || (nodes.has(el.from) && nodes.has(el.to)),
    ),
  };
}

export function parseDoc(raw: unknown): Doc {
  if (!isRecord(raw)) throw new CanvasParseError("That file does not contain a canvas.");

  const boards = Array.isArray(raw.boards) ? raw.boards.slice(0, MAX_BOARDS).map(parseBoard) : [];

  return {
    name: str(raw.name, emptyDoc().name, 120),
    // A document with no boards at all would leave nothing to draw on.
    boards: boards.length ? boards : [emptyBoard()],
  };
}

/** True for the `{ shapes, connectors }` shape the diagram editor saved. */
function looksLikeDiagram(value: Record<string, unknown>): boolean {
  return Array.isArray(value.shapes) || Array.isArray(value.connectors);
}

/**
 * Accepts a canvas file, a bare canvas document, and both of the file formats
 * this tool replaced.
 */
export function parseCanvasFile(text: string): Doc {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CanvasParseError("That file is not valid JSON, so it cannot be a saved canvas.");
  }
  if (!isRecord(data)) throw new CanvasParseError("That file does not contain a canvas.");

  // A wrapped file names what is inside it; take that and carry on.
  const inner = isRecord(data.doc)
    ? data.doc
    : isRecord(data.diagram)
      ? data.diagram
      : data;
  if (!isRecord(inner)) throw new CanvasParseError("That file does not contain a canvas.");

  if (looksLikeDiagram(inner)) {
    const diagram = parseDiagram(inner);
    return { name: diagram.name, boards: [boardFromDiagram(diagram)] };
  }

  return parseDoc(inner);
}
