/**
 * The canvas document.
 *
 * One board is a flat, ordered list of elements, which is what lets a drawing
 * be built up in any order and still erase, move and export predictably. Two
 * of those elements are structured rather than free-hand:
 *
 *   - a `node` is a shape with a label and four ports, the thing a flowchart
 *     is made of;
 *   - an `edge` joins two nodes and owns no coordinates of its own, so it
 *     re-routes itself whenever either end moves.
 *
 * Everything else — ink, free lines, text and pictures — carries its own
 * geometry and is never attached to anything. Keeping both in one list is the
 * whole point of the tool: you can scribble over a flowchart, and circle a
 * screenshot with an arrow that snaps to nothing.
 *
 * Shape outlines, port positions and connector routing come from
 * `@/lib/diagram`, which the work-breakdown chart shares, so a box drawn here
 * and a box drawn there are the same box.
 */
import {
  autoPorts,
  connectorGeometry,
  portPoint,
  type ConnectorGeometry,
  type LineStyle,
  type Port,
  type PortOrAuto,
  type Routing,
  type ShapeKind,
} from "@/lib/diagram/model";

export type { Port, PortOrAuto, Routing, ShapeKind };
export { autoPorts, portPoint };

/** The same three-way choice the diagram library calls a `LineStyle`. */
export type Dash = LineStyle;

export type ToolName =
  | "select"
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "text"
  | "laser";

/** Everything the left rail can be set to: a drawing tool, or a shape to place. */
export type Tool = ToolName | { node: ShapeKind };

export type Paper = "plain" | "grid" | "dots" | "lined";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Base {
  id: string;
}

export interface StrokeEl extends Base {
  type: "stroke";
  /** A highlighter is just ink that is wide, translucent and sits behind. */
  kind: "pen" | "highlighter";
  points: Point[];
  color: string;
  width: number;
}

/** A line or arrow that floats free — both ends are coordinates, not nodes. */
export interface LineEl extends Base {
  type: "line";
  from: Point;
  to: Point;
  color: string;
  width: number;
  dash: Dash;
  arrowStart: boolean;
  arrowEnd: boolean;
}

/** A shape with a label and four ports: what an edge can attach to. */
export interface NodeEl extends Base, Rect {
  type: "node";
  kind: ShapeKind;
  text: string;
  fill: string;
  /** "transparent" draws no outline at all. */
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  fontSize: number;
  textColor: string;
  bold: boolean;
}

/** A connector between two nodes. It owns no geometry; both ends are ids. */
export interface EdgeEl extends Base {
  type: "edge";
  from: string;
  to: string;
  fromPort: PortOrAuto;
  toPort: PortOrAuto;
  label: string;
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  routing: Routing;
  startArrow: boolean;
  endArrow: boolean;
}

/** Free text: no box, no wrapping, grows with what is typed. */
export interface TextEl extends Base, Rect {
  type: "text";
  text: string;
  color: string;
  size: number;
  bold: boolean;
}

export interface ImageEl extends Base, Rect {
  type: "image";
  /** A data URL. The picture is part of the document, not a link to one. */
  href: string;
  alt: string;
}

export type Element = StrokeEl | LineEl | NodeEl | EdgeEl | TextEl | ImageEl;

/** The elements that own a rectangle, and so can be resized and aligned to. */
export type BoxedEl = NodeEl | TextEl | ImageEl;

export interface Board {
  id: string;
  name: string;
  paper: Paper;
  paperColor: string;
  /** Pixels between grid stops for nodes. 0 switches snapping off. */
  grid: number;
  elements: Element[];
}

export interface Doc {
  name: string;
  boards: Board[];
}

export const MIN_SIZE = 8;
export const MIN_NODE = 24;
export const MAX_NODE = 4000;
export const MAX_COORD = 200000;

/** Sticky notes are the one node kind that reads as handwriting, not a label. */
export const NOTE_KIND: ShapeKind = "note";

/* --------------------------------- factories -------------------------------- */

/** ids only need to be unique inside one document, never across sessions. */
let counter = 0;
export function newId(prefix = "e"): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export const DEFAULT_NODE_SIZE: Partial<Record<ShapeKind, { w: number; h: number }>> = {
  ellipse: { w: 140, h: 70 },
  diamond: { w: 150, h: 90 },
  triangle: { w: 110, h: 90 },
  note: { w: 170, h: 150 },
  text: { w: 140, h: 40 },
  cylinder: { w: 130, h: 90 },
};

export function nodeSize(kind: ShapeKind): { w: number; h: number } {
  return DEFAULT_NODE_SIZE[kind] ?? { w: 150, h: 80 };
}

export function createNode(kind: ShapeKind, x: number, y: number, patch: Partial<NodeEl> = {}): NodeEl {
  const size = nodeSize(kind);
  return {
    id: patch.id ?? newId("n"),
    type: "node",
    kind,
    x,
    y,
    w: size.w,
    h: size.h,
    text: "",
    fill: kind === NOTE_KIND ? "#fff8dd" : "#e6f7fe",
    stroke: kind === "text" ? "transparent" : "#22b8f0",
    strokeWidth: 2,
    dash: "solid",
    fontSize: kind === NOTE_KIND ? 16 : 14,
    textColor: "#22303c",
    bold: false,
    ...patch,
  };
}

export function createEdge(from: string, to: string, patch: Partial<EdgeEl> = {}): EdgeEl {
  return {
    id: patch.id ?? newId("c"),
    type: "edge",
    from,
    to,
    fromPort: "auto",
    toPort: "auto",
    label: "",
    stroke: "#64757f",
    strokeWidth: 2,
    dash: "solid",
    routing: "orthogonal",
    startArrow: false,
    endArrow: true,
    ...patch,
  };
}

export function emptyBoard(name = "Board 1"): Board {
  return {
    id: newId("b"),
    name,
    paper: "plain",
    paperColor: "#ffffff",
    grid: 10,
    elements: [],
  };
}

export function emptyDoc(name = "Untitled canvas"): Doc {
  return { name, boards: [emptyBoard()] };
}

/* ---------------------------------- geometry -------------------------------- */

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function snap(value: number, grid: number): number {
  if (!grid || grid < 2) return Math.round(value);
  return Math.round(value / grid) * grid;
}

export function clampNode(value: number): number {
  return Math.min(MAX_NODE, Math.max(MIN_NODE, Math.round(value)));
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export function centerOf(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function pointsBounds(points: Point[], pad = 0): Rect {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Rough metrics for free text, shared by the canvas and the exporter. */
export const GLYPH_RATIO = 0.56;
export const TEXT_LINE_HEIGHT = 1.3;

export function textLines(text: string): string[] {
  return text.replace(/\r/g, "").split("\n");
}

export function measureText(text: string, size: number): { w: number; h: number } {
  const lines = textLines(text);
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    w: Math.max(size, longest * size * GLYPH_RATIO),
    h: Math.max(size, lines.length * size * TEXT_LINE_HEIGHT),
  };
}

/* ----------------------------- nodes and edges ----------------------------- */

export function isNode(el: Element): el is NodeEl {
  return el.type === "node";
}

export function isEdge(el: Element): el is EdgeEl {
  return el.type === "edge";
}

/** Only these carry a rectangle of their own. */
export function isBoxed(el: Element): el is BoxedEl {
  return el.type === "node" || el.type === "text" || el.type === "image";
}

export function nodeIndex(elements: Element[]): Map<string, NodeEl> {
  const index = new Map<string, NodeEl>();
  for (const el of elements) if (el.type === "node") index.set(el.id, el);
  return index;
}

/**
 * Where an edge actually runs.
 *
 * Returns null when either end has been deleted, which is the one case the
 * renderer has to skip rather than draw.
 */
export function edgeGeometry(
  edge: Pick<EdgeEl, "from" | "to" | "fromPort" | "toPort" | "routing">,
  index: Map<string, NodeEl>,
): ConnectorGeometry | null {
  const a = index.get(edge.from);
  const b = index.get(edge.to);
  if (!a || !b) return null;
  return connectorGeometry(edge, a, b);
}

/* ------------------------------ bounds and hits ----------------------------- */

export function elementBounds(el: Element, index: Map<string, NodeEl>): Rect {
  switch (el.type) {
    case "stroke":
      return pointsBounds(el.points, el.width / 2);
    case "line":
      return pointsBounds([el.from, el.to], el.width / 2);
    case "edge": {
      const geo = edgeGeometry(el, index);
      return geo ? pointsBounds(geo.points, el.strokeWidth / 2) : { x: 0, y: 0, w: 0, h: 0 };
    }
    case "text": {
      const m = measureText(el.text, el.size);
      return { x: el.x, y: el.y, w: Math.max(el.w, m.w), h: Math.max(el.h, m.h) };
    }
    default:
      return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}

export function unionBounds(
  elements: Element[],
  pad = 0,
  index: Map<string, NodeEl> = nodeIndex(elements),
): Rect | null {
  // An edge with a missing end contributes nothing, and a selection of only
  // those would otherwise report a box at the origin.
  const boxes = elements
    .filter((el) => el.type !== "edge" || edgeGeometry(el, index) !== null)
    .map((el) => elementBounds(el, index));
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x)) - pad;
  const y = Math.min(...boxes.map((b) => b.y)) - pad;
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) + pad - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) + pad - y,
  };
}

/** Distance from a point to a line segment — the basis of hitting ink. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  // How far along the segment the closest point lies, clamped to its ends.
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPolyline(p: Point, points: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, distanceToSegment(p, points[i - 1], points[i]));
  }
  return best;
}

function insideRect(p: Point, r: Rect, tolerance: number): boolean {
  return (
    p.x >= r.x - tolerance &&
    p.x <= r.x + r.w + tolerance &&
    p.y >= r.y - tolerance &&
    p.y <= r.y + r.h + tolerance
  );
}

function nearRectEdge(p: Point, r: Rect, tolerance: number): boolean {
  if (!insideRect(p, r, tolerance)) return false;
  const inner = tolerance * 2;
  return !(
    p.x > r.x + inner &&
    p.x < r.x + r.w - inner &&
    p.y > r.y + inner &&
    p.y < r.y + r.h - inner
  );
}

function hitNode(el: NodeEl, p: Point, tolerance: number): boolean {
  /**
   * An empty hollow shape is only hit near its outline, the way it looks —
   * clicking the middle of a circled annotation should reach what is behind
   * it. Give the same shape a fill or a label and it reads as solid, so the
   * whole of it becomes clickable.
   */
  const solid = el.fill !== "transparent" && el.fill !== "none";
  const grabbable = solid || el.text.trim().length > 0;

  if (el.kind === "ellipse") {
    const rx = el.w / 2 + tolerance;
    const ry = el.h / 2 + tolerance;
    if (rx <= 0 || ry <= 0) return false;
    const nx = (p.x - (el.x + el.w / 2)) / rx;
    const ny = (p.y - (el.y + el.h / 2)) / ry;
    if (nx * nx + ny * ny > 1) return false;
    if (grabbable) return true;
    // Hollow and unlabelled: only the ring counts.
    const irx = Math.max(0, el.w / 2 - tolerance);
    const iry = Math.max(0, el.h / 2 - tolerance);
    if (irx === 0 || iry === 0) return true;
    const ix = (p.x - (el.x + el.w / 2)) / irx;
    const iy = (p.y - (el.y + el.h / 2)) / iry;
    return ix * ix + iy * iy >= 1;
  }

  // Every other kind is hit through its bounding box: a diamond's corners are
  // easier to grab than its exact outline.
  return grabbable ? insideRect(p, el, tolerance) : nearRectEdge(p, el, tolerance);
}

export function hitElement(
  el: Element,
  p: Point,
  index: Map<string, NodeEl>,
  tolerance = 6,
): boolean {
  switch (el.type) {
    case "stroke": {
      const reach = el.width / 2 + tolerance;
      if (el.points.length === 1) {
        return Math.hypot(p.x - el.points[0].x, p.y - el.points[0].y) <= reach;
      }
      return distanceToPolyline(p, el.points) <= reach;
    }
    case "line":
      return distanceToSegment(p, el.from, el.to) <= el.width / 2 + tolerance;
    case "edge": {
      const geo = edgeGeometry(el, index);
      if (!geo) return false;
      // A curve is hit against the straight hull of its control points, which
      // is close enough for a line a couple of pixels wide.
      return distanceToPolyline(p, geo.points) <= el.strokeWidth / 2 + tolerance + 2;
    }
    case "node":
      return hitNode(el, p, tolerance);
    default:
      return insideRect(p, elementBounds(el, index), tolerance);
  }
}

/**
 * Topmost first: the last element drawn is the one the pointer lands on.
 *
 * Edges are searched only once nothing else matches, because they pass under
 * the nodes they join and a click near a box should pick the box.
 */
export function hitTest(
  elements: Element[],
  p: Point,
  tolerance = 6,
  index: Map<string, NodeEl> = nodeIndex(elements),
): Element | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i];
    if (el.type !== "edge" && hitElement(el, p, index, tolerance)) return el;
  }
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i];
    if (el.type === "edge" && hitElement(el, p, index, tolerance)) return el;
  }
  return null;
}

export function elementsInRect(
  elements: Element[],
  box: Rect,
  index: Map<string, NodeEl> = nodeIndex(elements),
): Element[] {
  const inside = elements.filter((el) => {
    if (el.type === "edge") return false;
    const b = elementBounds(el, index);
    return b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h;
  });

  // An edge comes along when both of its nodes were caught, so rubber-banding
  // a flowchart picks up the arrows inside it rather than stripping them.
  const caught = new Set(inside.map((el) => el.id));
  const edges = elements.filter(
    (el) => el.type === "edge" && caught.has(el.from) && caught.has(el.to),
  );
  return [...inside, ...edges];
}

/* -------------------------------- transforms -------------------------------- */

export function translateElement(el: Element, dx: number, dy: number): Element {
  switch (el.type) {
    case "stroke":
      return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case "line":
      return {
        ...el,
        from: { x: el.from.x + dx, y: el.from.y + dy },
        to: { x: el.to.x + dx, y: el.to.y + dy },
      };
    // An edge follows the nodes it joins; moving it on its own is meaningless.
    case "edge":
      return el;
    default:
      return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

/**
 * Re-fits an element from one bounding box into another.
 *
 * Doing it through the bounding box means one routine scales ink, shapes,
 * text and images alike, so a mixed selection resizes as one object.
 */
export function scaleElement(el: Element, from: Rect, to: Rect): Element {
  if (el.type === "edge") return el;

  const sx = from.w === 0 ? 1 : to.w / from.w;
  const sy = from.h === 0 ? 1 : to.h / from.h;
  const mapX = (x: number) => to.x + (x - from.x) * sx;
  const mapY = (y: number) => to.y + (y - from.y) * sy;
  // Strokes and text keep their proportions: a line that thickens twice as
  // much horizontally as vertically looks broken.
  const uniform = Math.min(Math.abs(sx), Math.abs(sy));

  switch (el.type) {
    case "stroke":
      return {
        ...el,
        points: el.points.map((p) => ({ x: mapX(p.x), y: mapY(p.y) })),
        width: Math.max(0.5, el.width * uniform),
      };
    case "line":
      return {
        ...el,
        from: { x: mapX(el.from.x), y: mapY(el.from.y) },
        to: { x: mapX(el.to.x), y: mapY(el.to.y) },
        width: Math.max(0.5, el.width * uniform),
      };
    case "text":
      return {
        ...el,
        x: mapX(el.x),
        y: mapY(el.y),
        w: Math.max(MIN_SIZE, el.w * sx),
        h: Math.max(MIN_SIZE, el.h * sy),
        size: Math.max(6, el.size * uniform),
      };
    case "node":
      return {
        ...el,
        x: mapX(el.x),
        y: mapY(el.y),
        w: Math.max(MIN_NODE, el.w * sx),
        h: Math.max(MIN_NODE, el.h * sy),
      };
    default:
      return {
        ...el,
        x: mapX(el.x),
        y: mapY(el.y),
        w: Math.max(MIN_SIZE, el.w * sx),
        h: Math.max(MIN_SIZE, el.h * sy),
      };
  }
}

/* --------------------------------- board ops -------------------------------- */

export function updateBoard(doc: Doc, boardId: string, change: (board: Board) => Board): Doc {
  return { ...doc, boards: doc.boards.map((b) => (b.id === boardId ? change(b) : b)) };
}

export function addElements(board: Board, elements: Element[]): Board {
  return { ...board, elements: [...board.elements, ...elements] };
}

/** Removing a node takes its edges with it, or they would dangle invisibly. */
export function removeElements(board: Board, ids: string[]): Board {
  const gone = new Set(ids);
  const nodesGone = new Set(
    board.elements.filter((el) => el.type === "node" && gone.has(el.id)).map((el) => el.id),
  );
  return {
    ...board,
    elements: board.elements.filter((el) => {
      if (gone.has(el.id)) return false;
      if (el.type === "edge" && (nodesGone.has(el.from) || nodesGone.has(el.to))) return false;
      return true;
    }),
  };
}

export function patchElements(
  board: Board,
  ids: string[],
  change: (el: Element) => Element,
): Board {
  const wanted = new Set(ids);
  return {
    ...board,
    elements: board.elements.map((el) =>
      wanted.has(el.id) ? ({ ...change(el), id: el.id, type: el.type } as Element) : el,
    ),
  };
}

export function reorderElements(
  board: Board,
  ids: string[],
  to: "front" | "back" | "forward" | "backward",
): Board {
  const wanted = new Set(ids);
  if (to === "front" || to === "back") {
    const moving = board.elements.filter((el) => wanted.has(el.id));
    const rest = board.elements.filter((el) => !wanted.has(el.id));
    return { ...board, elements: to === "front" ? [...rest, ...moving] : [...moving, ...rest] };
  }

  // One step at a time, walking from the end the elements are heading towards
  // so that a block of them keeps its internal order.
  const elements = [...board.elements];
  const order = to === "forward" ? [...elements.keys()].reverse() : [...elements.keys()];
  for (const i of order) {
    if (!wanted.has(elements[i].id)) continue;
    const target = to === "forward" ? i + 1 : i - 1;
    if (target < 0 || target >= elements.length || wanted.has(elements[target].id)) continue;
    [elements[i], elements[target]] = [elements[target], elements[i]];
  }
  return { ...board, elements };
}

/**
 * Copies elements, re-pointing any edge that ran between two of them.
 *
 * Shared by duplicate and paste, so a two-box-and-an-arrow group keeps its
 * arrow either way, while an edge to something left behind is dropped.
 */
export function cloneElements(elements: Element[], dx: number, dy: number): Element[] {
  const remap = new Map<string, string>();
  const copies: Element[] = [];

  for (const el of elements) {
    if (el.type === "edge") continue;
    const id = newId(el.type === "node" ? "n" : "e");
    remap.set(el.id, id);
    copies.push({ ...translateElement(el, dx, dy), id } as Element);
  }

  for (const el of elements) {
    if (el.type !== "edge") continue;
    const from = remap.get(el.from);
    const to = remap.get(el.to);
    if (!from || !to) continue;
    copies.push({ ...el, id: newId("c"), from, to });
  }

  return copies;
}

export function duplicateElements(
  board: Board,
  ids: string[],
  offset = 24,
): { board: Board; ids: string[] } {
  const wanted = new Set(ids);
  const copies = cloneElements(
    board.elements.filter((el) => wanted.has(el.id)),
    offset,
    offset,
  );
  return { board: addElements(board, copies), ids: copies.map((c) => c.id) };
}

/**
 * The order things are painted in.
 *
 * Highlighter ink sits at the very back so marking up a drawing cannot bury
 * it, and edges sit under every node, the way a connector is drawn in any
 * diagram tool. Everything else keeps the order it was added in.
 */
export function drawOrder(elements: Element[]): Element[] {
  const behind: Element[] = [];
  const edges: Element[] = [];
  const front: Element[] = [];

  for (const el of elements) {
    if (el.type === "stroke" && el.kind === "highlighter") behind.push(el);
    else if (el.type === "edge") edges.push(el);
    else front.push(el);
  }

  if (!behind.length && !edges.length) return elements;
  return [...behind, ...edges, ...front];
}

/* ------------------------------ growing a flow ------------------------------ */

export type Direction = "up" | "right" | "down" | "left";

export const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

export const DIRECTION_PORT: Record<Direction, Port> = {
  up: "top",
  right: "right",
  down: "bottom",
  left: "left",
};

/**
 * Where a node spawned in a given direction should sit: centred on the
 * source and separated by a gap, which is what makes click-to-add build a
 * tidy row or column without any dragging.
 */
export function spawnPosition(
  from: Rect,
  direction: Direction,
  size: { w: number; h: number },
  gap = 70,
): Point {
  const center = centerOf(from);
  switch (direction) {
    case "up":
      return { x: center.x - size.w / 2, y: from.y - gap - size.h };
    case "down":
      return { x: center.x - size.w / 2, y: from.y + from.h + gap };
    case "left":
      return { x: from.x - gap - size.w, y: center.y - size.h / 2 };
    case "right":
      return { x: from.x + from.w + gap, y: center.y - size.h / 2 };
  }
}

/** The look a new node inherits from the one it grew out of. */
export function inheritedStyle(source: NodeEl): Partial<NodeEl> {
  return {
    fill: source.fill,
    stroke: source.stroke,
    strokeWidth: source.strokeWidth,
    dash: source.dash,
    fontSize: source.fontSize,
    textColor: source.textColor,
    bold: source.bold,
  };
}

/**
 * Adds a node next to an existing one and joins the two.
 *
 * The new node inherits the source's look, so a diagram keeps one visual
 * language as it is built out by clicking arrows. A decision is followed by a
 * process rather than by another decision, which is what you almost always
 * want after a yes/no branch.
 */
export function spawnConnected(
  board: Board,
  fromId: string,
  direction: Direction,
  kind?: ShapeKind,
): { board: Board; id: string } | null {
  const source = nodeIndex(board.elements).get(fromId);
  if (!source) return null;

  const nextKind = kind ?? (source.kind === "diamond" ? "rounded" : source.kind);
  const size = nodeSize(nextKind);
  const at = spawnPosition(source, direction, size);

  const node = createNode(nextKind, snap(at.x, board.grid), snap(at.y, board.grid), {
    ...inheritedStyle(source),
  });
  node.w = size.w;
  node.h = size.h;

  const edge = createEdge(source.id, node.id, { fromPort: DIRECTION_PORT[direction] });
  return { board: addElements(board, [node, edge]), id: node.id };
}
