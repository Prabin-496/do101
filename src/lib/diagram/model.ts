/**
 * The diagram document model.
 *
 * Everything here is pure and free of browser APIs so the geometry can be
 * unit-tested and reused by the SVG exporter, which has to produce the exact
 * same picture the canvas shows.
 */

export type ShapeKind =
  | "rectangle"
  | "rounded"
  | "ellipse"
  | "diamond"
  | "parallelogram"
  | "hexagon"
  | "cylinder"
  | "triangle"
  | "document"
  | "note"
  | "text";

export type Port = "top" | "right" | "bottom" | "left";
export type PortOrAuto = Port | "auto";
export type LineStyle = "solid" | "dashed" | "dotted";
export type Routing = "straight" | "orthogonal" | "curved";

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

export interface Shape extends Rect {
  id: string;
  kind: ShapeKind;
  text: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  textColor: string;
  bold: boolean;
}

export interface Connector {
  id: string;
  from: string;
  to: string;
  fromPort: PortOrAuto;
  toPort: PortOrAuto;
  label: string;
  stroke: string;
  strokeWidth: number;
  style: LineStyle;
  routing: Routing;
  startArrow: boolean;
  endArrow: boolean;
}

export interface Diagram {
  name: string;
  background: string;
  grid: number;
  shapes: Shape[];
  connectors: Connector[];
}

export const MIN_SHAPE = 24;
export const MAX_SHAPE = 4000;
export const PORTS: Port[] = ["top", "right", "bottom", "left"];

export const SHAPE_LIBRARY: { kind: ShapeKind; label: string; hint: string }[] = [
  { kind: "rounded", label: "Process", hint: "A step in a flow" },
  { kind: "rectangle", label: "Box", hint: "Plain rectangle" },
  { kind: "diamond", label: "Decision", hint: "A yes / no branch" },
  { kind: "ellipse", label: "Start / End", hint: "Terminator" },
  { kind: "parallelogram", label: "Input", hint: "Data in or out" },
  { kind: "hexagon", label: "Preparation", hint: "Setup step" },
  { kind: "cylinder", label: "Database", hint: "Stored data" },
  { kind: "document", label: "Document", hint: "A printed result" },
  { kind: "triangle", label: "Merge", hint: "Junction" },
  { kind: "note", label: "Note", hint: "A sticky comment" },
  { kind: "text", label: "Label", hint: "Text with no outline" },
];

export const DEFAULT_SHAPE_SIZE: Partial<Record<ShapeKind, { w: number; h: number }>> = {
  ellipse: { w: 140, h: 70 },
  diamond: { w: 150, h: 90 },
  triangle: { w: 110, h: 90 },
  note: { w: 140, h: 100 },
  text: { w: 140, h: 40 },
  cylinder: { w: 130, h: 90 },
};

/** ids only need to be unique inside one document, never across sessions. */
let counter = 0;
export function newId(prefix = "n"): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createShape(kind: ShapeKind, x: number, y: number, patch: Partial<Shape> = {}): Shape {
  const size = DEFAULT_SHAPE_SIZE[kind] ?? { w: 150, h: 80 };
  return {
    id: patch.id ?? newId("s"),
    kind,
    x,
    y,
    w: size.w,
    h: size.h,
    text: kind === "text" ? "Label" : "",
    fill: kind === "note" ? "#fff8dd" : "#e6f7fe",
    stroke: kind === "text" ? "transparent" : "#22b8f0",
    strokeWidth: 2,
    fontSize: 14,
    textColor: "#22303c",
    bold: false,
    ...patch,
  };
}

export function createConnector(from: string, to: string, patch: Partial<Connector> = {}): Connector {
  return {
    id: patch.id ?? newId("c"),
    from,
    to,
    fromPort: "auto",
    toPort: "auto",
    label: "",
    stroke: "#64757f",
    strokeWidth: 2,
    style: "solid",
    routing: "orthogonal",
    startArrow: false,
    endArrow: true,
    ...patch,
  };
}

export function emptyDiagram(name = "Untitled diagram"): Diagram {
  return { name, background: "#ffffff", grid: 10, shapes: [], connectors: [] };
}

/* --------------------------------- geometry -------------------------------- */

export function centerOf(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function portPoint(rect: Rect, port: Port): Point {
  switch (port) {
    case "top":
      return { x: rect.x + rect.w / 2, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case "left":
      return { x: rect.x, y: rect.y + rect.h / 2 };
    case "right":
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  }
}

/**
 * Picks the pair of ports that gives the shortest, least crossed line.
 * Whichever axis separates the two shapes more wins, which is what makes a
 * dragged box re-route sensibly instead of threading a line through itself.
 */
export function autoPorts(a: Rect, b: Rect): { from: Port; to: Port } {
  const ca = centerOf(a);
  const cb = centerOf(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: "right", to: "left" } : { from: "left", to: "right" };
  }
  return dy >= 0 ? { from: "bottom", to: "top" } : { from: "top", to: "bottom" };
}

export function resolvePorts(
  connector: Pick<Connector, "fromPort" | "toPort">,
  a: Rect,
  b: Rect,
): { from: Port; to: Port } {
  const auto = autoPorts(a, b);
  return {
    from: connector.fromPort === "auto" ? auto.from : connector.fromPort,
    to: connector.toPort === "auto" ? auto.to : connector.toPort,
  };
}

function normal(port: Port, distance: number): Point {
  switch (port) {
    case "top":
      return { x: 0, y: -distance };
    case "bottom":
      return { x: 0, y: distance };
    case "left":
      return { x: -distance, y: 0 };
    case "right":
      return { x: distance, y: 0 };
  }
}

function orthogonalPoints(start: Point, end: Point, from: Port, to: Port): Point[] {
  const horizontalStart = from === "left" || from === "right";
  const horizontalEnd = to === "left" || to === "right";

  if (horizontalStart && horizontalEnd) {
    const midX = (start.x + end.x) / 2;
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }
  if (!horizontalStart && !horizontalEnd) {
    const midY = (start.y + end.y) / 2;
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
  }
  // One horizontal, one vertical: a single elbow is enough.
  return horizontalStart
    ? [start, { x: end.x, y: start.y }, end]
    : [start, { x: start.x, y: end.y }, end];
}

export interface ConnectorGeometry {
  path: string;
  start: Point;
  end: Point;
  /** Where a label sits, and where the mid-point handle is drawn. */
  mid: Point;
  points: Point[];
}

export function connectorGeometry(
  connector: Pick<Connector, "fromPort" | "toPort" | "routing">,
  a: Rect,
  b: Rect,
): ConnectorGeometry {
  const ports = resolvePorts(connector, a, b);
  const start = portPoint(a, ports.from);
  const end = portPoint(b, ports.to);

  if (connector.routing === "straight") {
    return {
      path: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`,
      start,
      end,
      mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      points: [start, end],
    };
  }

  if (connector.routing === "curved") {
    const reach = Math.max(40, Math.hypot(end.x - start.x, end.y - start.y) / 2.5);
    const c1 = offset(start, normal(ports.from, reach));
    const c2 = offset(end, normal(ports.to, reach));
    return {
      path: `M ${round(start.x)} ${round(start.y)} C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(end.x)} ${round(end.y)}`,
      start,
      end,
      // The t=0.5 point of a cubic bezier.
      mid: {
        x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
        y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
      },
      points: [start, c1, c2, end],
    };
  }

  const points = orthogonalPoints(start, end, ports.from, ports.to);
  return {
    path: points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`)
      .join(" "),
    start,
    end,
    mid: midpointAlong(points),
    points,
  };
}

function offset(point: Point, delta: Point): Point {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

/** The point half way along a polyline, measured by length rather than by index. */
function midpointAlong(points: Point[]): Point {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    lengths.push(d);
    total += d;
  }
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    if (travelled + lengths[i] >= total / 2) {
      const remain = total / 2 - travelled;
      const ratio = lengths[i] === 0 ? 0 : remain / lengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    travelled += lengths[i];
  }
  return points[points.length - 1];
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function snap(value: number, grid: number): number {
  if (!grid || grid < 2) return Math.round(value);
  return Math.round(value / grid) * grid;
}

export function clampSize(value: number): number {
  return Math.min(MAX_SHAPE, Math.max(MIN_SHAPE, Math.round(value)));
}

/** The bounding box of every shape and every connector elbow. */
export function diagramBounds(diagram: Diagram, padding = 40): Rect {
  const points: Point[] = [];
  for (const shape of diagram.shapes) {
    points.push({ x: shape.x, y: shape.y }, { x: shape.x + shape.w, y: shape.y + shape.h });
  }
  const byId = shapeIndex(diagram.shapes);
  for (const connector of diagram.connectors) {
    const a = byId.get(connector.from);
    const b = byId.get(connector.to);
    if (!a || !b) continue;
    points.push(...connectorGeometry(connector, a, b).points);
  }
  if (points.length === 0) return { x: 0, y: 0, w: 640, h: 400 };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  return {
    x: round(minX),
    y: round(minY),
    w: round(Math.max(...xs) + padding - minX),
    h: round(Math.max(...ys) + padding - minY),
  };
}

export function shapeIndex(shapes: Shape[]): Map<string, Shape> {
  return new Map(shapes.map((s) => [s.id, s]));
}

/* ------------------------------ document edits ----------------------------- */

export function updateShape(diagram: Diagram, id: string, patch: Partial<Shape>): Diagram {
  return {
    ...diagram,
    shapes: diagram.shapes.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)),
  };
}

export function updateConnector(diagram: Diagram, id: string, patch: Partial<Connector>): Diagram {
  return {
    ...diagram,
    connectors: diagram.connectors.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)),
  };
}

/** Removing a shape has to take its connectors with it, or they dangle. */
export function removeShape(diagram: Diagram, id: string): Diagram {
  return {
    ...diagram,
    shapes: diagram.shapes.filter((s) => s.id !== id),
    connectors: diagram.connectors.filter((c) => c.from !== id && c.to !== id),
  };
}

export function removeConnector(diagram: Diagram, id: string): Diagram {
  return { ...diagram, connectors: diagram.connectors.filter((c) => c.id !== id) };
}

export function reorderShape(diagram: Diagram, id: string, to: "front" | "back" | "forward" | "backward"): Diagram {
  const index = diagram.shapes.findIndex((s) => s.id === id);
  if (index < 0) return diagram;
  const shapes = [...diagram.shapes];
  const [shape] = shapes.splice(index, 1);
  const target =
    to === "front"
      ? shapes.length
      : to === "back"
        ? 0
        : to === "forward"
          ? Math.min(shapes.length, index + 1)
          : Math.max(0, index - 1);
  shapes.splice(target, 0, shape);
  return { ...diagram, shapes };
}

/** A duplicate lands slightly down-right of the original, like every editor. */
export function duplicateShape(diagram: Diagram, id: string): { diagram: Diagram; id: string } | null {
  const shape = diagram.shapes.find((s) => s.id === id);
  if (!shape) return null;
  const copy: Shape = { ...shape, id: newId("s"), x: shape.x + 24, y: shape.y + 24 };
  return { diagram: { ...diagram, shapes: [...diagram.shapes, copy] }, id: copy.id };
}

export function hitShape(shapes: Shape[], point: Point): Shape | null {
  // Topmost first: the last shape drawn is the one the pointer lands on.
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const s = shapes[i];
    if (point.x >= s.x && point.x <= s.x + s.w && point.y >= s.y && point.y <= s.y + s.h) return s;
  }
  return null;
}

/* ------------------------- the palette and quick-add ------------------------ */

export interface PaletteGroup {
  title: string;
  kinds: ShapeKind[];
}

/** How the shape palette is grouped, in the order it is shown. */
export const PALETTE_GROUPS: PaletteGroup[] = [
  { title: "General", kinds: ["rounded", "rectangle", "ellipse", "text", "note"] },
  { title: "Flowchart", kinds: ["diamond", "parallelogram", "hexagon", "document", "cylinder", "triangle"] },
];

export type Direction = "up" | "right" | "down" | "left";

export const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

export const DIRECTION_PORT: Record<Direction, Port> = {
  up: "top",
  right: "right",
  down: "bottom",
  left: "left",
};

/**
 * Where a shape spawned in a given direction should sit: centred on the
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

/**
 * Adds a shape next to an existing one and joins the two.
 *
 * The new shape inherits the source's look, so a diagram keeps one visual
 * language as it is built out by clicking arrows.
 */
export function spawnConnected(
  diagram: Diagram,
  fromId: string,
  direction: Direction,
  kind?: ShapeKind,
): { diagram: Diagram; id: string } | null {
  const source = diagram.shapes.find((s) => s.id === fromId);
  if (!source) return null;

  const nextKind = kind ?? (source.kind === "diamond" ? "rounded" : source.kind);
  const size = DEFAULT_SHAPE_SIZE[nextKind] ?? { w: source.w, h: source.h };
  const at = spawnPosition(source, direction, size);

  const shape = createShape(nextKind, snap(at.x, diagram.grid), snap(at.y, diagram.grid), {
    fill: source.fill,
    stroke: source.stroke,
    strokeWidth: source.strokeWidth,
    fontSize: source.fontSize,
    textColor: source.textColor,
    bold: source.bold,
  });
  shape.w = size.w;
  shape.h = size.h;

  const connector = createConnector(source.id, shape.id, {
    fromPort: DIRECTION_PORT[direction],
  });

  return {
    diagram: {
      ...diagram,
      shapes: [...diagram.shapes, shape],
      connectors: [...diagram.connectors, connector],
    },
    id: shape.id,
  };
}
