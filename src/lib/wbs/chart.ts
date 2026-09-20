/**
 * The WBS as a diagram.
 *
 * The tree is laid out and then turned into the same `Diagram` structure the
 * diagram maker uses, which buys three things at once: the canvas on screen,
 * the SVG and PNG exports, and a file that opens in the diagram editor for
 * free-form work — all rendered by one set of shared primitives, so what you
 * drag is exactly what you download.
 */

import type { Port } from "@/lib/diagram/model";
import {
  createConnector,
  createShape,
  emptyDiagram,
  type Connector,
  type Diagram,
  type Rect,
  type Shape,
} from "@/lib/diagram/model";
import { LINE_HEIGHT } from "@/lib/diagram/shapes";
import { formatValue } from "./fields";
import type { ChartColouring, ChartSettings, WbsDoc, WbsField, WbsRow, WbsTask } from "./model";

/** The id of the optional node standing for the project itself. */
export const ROOT_ID = "__project__";

/**
 * Where a link leaves the parent and meets the child.
 *
 * Fixed rather than automatic: a tree reads as a tree because every line drops
 * from the same edge. Left to the automatic choice, a child sitting off to one
 * side gets a line out of the parent's side that then runs alongside its
 * neighbours.
 */
export function portsFor(orientation: ChartSettings["orientation"]): { from: Port; to: Port } {
  switch (orientation) {
    case "right":
      return { from: "right", to: "left" };
    case "stacked":
      // The bracket look: down the parent's edge, then in to the child's side.
      return { from: "bottom", to: "left" };
    default:
      return { from: "bottom", to: "top" };
  }
}

/**
 * Drops positions belonging to tasks that no longer exist, so a deleted card
 * cannot leave a ghost behind — or, worse, hand its place to a future task.
 * The same object is returned when nothing changed, to avoid pointless renders.
 */
export function prunePositions(
  tasks: WbsTask[],
  positions: ChartSettings["positions"],
): ChartSettings["positions"] {
  const ids = Object.keys(positions);
  if (ids.length === 0) return positions;

  const live = new Set<string>([ROOT_ID]);
  const walk = (list: WbsTask[]) => {
    for (const task of list) {
      live.add(task.id);
      walk(task.children);
    }
  };
  walk(tasks);

  if (ids.every((id) => live.has(id))) return positions;
  return Object.fromEntries(Object.entries(positions).filter(([id]) => live.has(id)));
}

/* -------------------------------- palettes -------------------------------- */

export interface Palette {
  id: string;
  label: string;
  /** Fill and stroke pairs, cycled by level, branch or field value. */
  swatches: { fill: string; stroke: string }[];
  text: string;
  line: string;
  background: string;
}

export const PALETTES: Palette[] = [
  {
    id: "brand",
    label: "DO101",
    swatches: [
      { fill: "#e6f7fe", stroke: "#22b8f0" },
      { fill: "#eefbe9", stroke: "#4cc93f" },
      { fill: "#f6ecff", stroke: "#b45cff" },
      { fill: "#fff3e3", stroke: "#ff8a00" },
      { fill: "#fff8dd", stroke: "#ffc800" },
      { fill: "#ffecec", stroke: "#ff4b4b" },
    ],
    text: "#22303c",
    line: "#64757f",
    background: "#ffffff",
  },
  {
    id: "blueprint",
    label: "Blueprint",
    swatches: [
      { fill: "#dce9f7", stroke: "#1b4f8a" },
      { fill: "#e8f0fa", stroke: "#2d6cb5" },
      { fill: "#f1f6fc", stroke: "#4a89d0" },
      { fill: "#e2ebf5", stroke: "#153c69" },
    ],
    text: "#0f2a47",
    line: "#2d6cb5",
    background: "#ffffff",
  },
  {
    id: "slate",
    label: "Greyscale",
    swatches: [
      { fill: "#eef1f3", stroke: "#49606d" },
      { fill: "#f5f7f8", stroke: "#6d8593" },
      { fill: "#e4e9ec", stroke: "#33464f" },
    ],
    text: "#22303c",
    line: "#6d8593",
    background: "#ffffff",
  },
  {
    id: "warm",
    label: "Warm",
    swatches: [
      { fill: "#fff1e0", stroke: "#e07b1a" },
      { fill: "#ffe9e4", stroke: "#e2553a" },
      { fill: "#fff7d9", stroke: "#d8a700" },
      { fill: "#f8ead9", stroke: "#a9752c" },
    ],
    text: "#3c2a1c",
    line: "#a9752c",
    background: "#fffdf9",
  },
  {
    id: "mono",
    label: "Print (white)",
    swatches: [{ fill: "#ffffff", stroke: "#22303c" }],
    text: "#22303c",
    line: "#22303c",
    background: "#ffffff",
  },
];

export function paletteFor(id: string): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/* --------------------------------- layout --------------------------------- */

export interface ChartNode {
  id: string;
  /** Absent on the project root, which stands for no task. */
  row: WbsRow | null;
  children: ChartNode[];
  depth: number;
  x: number;
  y: number;
}

/** Rows to nodes, honouring collapse: a hidden row brings no node with it. */
export function buildNodeTree(rows: WbsRow[], showRoot: boolean): ChartNode[] {
  const byId = new Map<string, ChartNode>();
  const roots: ChartNode[] = [];

  for (const row of rows) {
    if (row.hidden) continue;
    const node: ChartNode = { id: row.id, row, children: [], depth: 0, x: 0, y: 0 };
    byId.set(row.id, node);
    const parent = row.parentId ? byId.get(row.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  if (!showRoot) return roots;
  return [{ id: ROOT_ID, row: null, children: roots, depth: 0, x: 0, y: 0 }];
}

export function cardHeight(chart: ChartSettings, fieldCount: number): number {
  if (fieldCount === 0) return chart.nodeHeight;
  return chart.nodeHeight + fieldCount * Math.round(chart.fontSize * LINE_HEIGHT);
}

/**
 * Tidy tree placement: leaves take the next slot along the cross axis, and a
 * parent centres itself over its children. Positions set by dragging are
 * applied afterwards, so a hand-placed node stays where it was put.
 */
export function layoutNodes(
  roots: ChartNode[],
  chart: ChartSettings,
  size: { w: number; h: number },
): ChartNode[] {
  const all: ChartNode[] = [];
  const horizontal = chart.orientation === "right";
  const crossStep = (horizontal ? size.h : size.w) + chart.siblingGap;
  const mainStep = (horizontal ? size.w : size.h) + chart.levelGap;
  let cursor = 0;

  const place = (node: ChartNode, depth: number): number => {
    node.depth = depth;
    all.push(node);

    let centre: number;
    if (node.children.length === 0) {
      centre = cursor;
      cursor += crossStep;
    } else {
      const centres = node.children.map((child) => place(child, depth + 1));
      centre = (centres[0] + centres[centres.length - 1]) / 2;
    }

    if (horizontal) {
      node.x = depth * mainStep;
      node.y = centre;
    } else {
      node.x = centre;
      node.y = depth * mainStep;
    }
    return centre;
  };

  if (chart.orientation === "stacked") {
    // Every node gets its own row and is indented by its depth: the bracket
    // layout people draw when the tree is deep rather than wide.
    let row = 0;
    const walk = (node: ChartNode, depth: number) => {
      node.depth = depth;
      node.x = depth * (chart.siblingGap + Math.round(size.w * 0.32));
      node.y = row * (size.h + Math.round(chart.siblingGap * 0.6));
      row += 1;
      all.push(node);
      node.children.forEach((child) => walk(child, depth + 1));
    };
    roots.forEach((node) => walk(node, 0));
  } else {
    roots.forEach((node) => place(node, 0));
  }

  for (const node of all) {
    const manual = chart.positions[node.id];
    if (manual) {
      node.x = manual.x;
      node.y = manual.y;
    }
  }

  return all;
}

/* ------------------------------ node contents ------------------------------ */

/** The label on a card: the code and name, then any chosen column values. */
export function nodeLabel(row: WbsRow, doc: WbsDoc, fields: WbsField[]): string {
  const heading = doc.chart.showCode && row.code ? `${row.code}  ${row.name}` : row.name;
  const lines = [heading || "Untitled task"];
  for (const field of fields) {
    const text = formatValue(row.values[field.id] ?? null, field, doc.settings);
    if (text) lines.push(`${field.label}: ${text}`);
  }
  return lines.join("\n");
}

export function swatchIndex(
  row: WbsRow,
  doc: WbsDoc,
  count: number,
  colourBy: ChartColouring = doc.chart.colourBy,
  colourFieldId: string | null = doc.chart.colourFieldId,
): number {
  switch (colourBy) {
    case "level":
      return (row.level - 1) % count;
    case "branch": {
      // Everything under the same top-level branch shares its colour, which
      // is what makes a wide chart readable at a glance.
      const first = row.code.split(/[^A-Za-z0-9]/)[0] ?? "";
      const n = Number(first.replace(/\D/g, ""));
      return (Number.isFinite(n) && n > 0 ? n - 1 : 0) % count;
    }
    case "field": {
      const field = doc.fields.find((entry) => entry.id === colourFieldId);
      const value = field ? row.values[field.id] : null;
      const options = field?.options ?? [];
      const index = options.indexOf(String(value ?? ""));
      return index >= 0 ? index % count : 0;
    }
    default:
      return 0;
  }
}

/* ----------------------------- the diagram ----------------------------- */

export interface ChartResult {
  diagram: Diagram;
  /** Shape ids in tree order, and the row each one came from. */
  nodes: { id: string; rect: Rect; row: WbsRow | null; depth: number }[];
}

/**
 * Builds the diagram for a document. Everything that draws the chart — the
 * canvas, the SVG export, the PNG, the handoff file — starts here.
 */
export function wbsToDiagram(doc: WbsDoc, rows: WbsRow[]): ChartResult {
  const chart = doc.chart;
  const palette = paletteFor(chart.palette);
  const shown = chart.showFields
    .map((id) => doc.fields.find((field) => field.id === id))
    .filter((field): field is WbsField => Boolean(field));

  const size = {
    w: chart.nodeWidth,
    h: cardHeight(chart, shown.length),
  };

  const tree = buildNodeTree(rows, chart.showRoot);
  const placed = layoutNodes(tree, chart, size);
  const edgePorts = portsFor(chart.orientation);
  const ports = { fromPort: edgePorts.from, toPort: edgePorts.to };

  const shapes: Shape[] = [];
  const connectors: Connector[] = [];
  const nodes: ChartResult["nodes"] = [];

  for (const node of placed) {
    const row = node.row;
    const swatch =
      row === null
        ? palette.swatches[0]
        : palette.swatches[swatchIndex(row, doc, palette.swatches.length)];

    const override = row ? findStyle(doc, row.id) : undefined;
    const shape = createShape(override?.shape ?? chart.shape, node.x, node.y, {
      id: node.id,
      w: size.w,
      h: size.h,
      text: row === null ? doc.settings.projectName || "Project" : nodeLabel(row, doc, shown),
      fill: override?.fill ?? swatch.fill,
      stroke: override?.stroke ?? swatch.stroke,
      fontSize: chart.fontSize,
      textColor: palette.text,
      bold: row === null || row.isSummary,
    });
    shapes.push(shape);
    nodes.push({ id: node.id, rect: shape, row, depth: node.depth });

    for (const child of node.children) {
      connectors.push(
        createConnector(node.id, child.id, {
          id: `edge-${node.id}-${child.id}`,
          routing: chart.routing,
          stroke: palette.line,
          endArrow: chart.arrows,
          ...ports,
        }),
      );
    }
  }

  return {
    diagram: {
      ...emptyDiagram(doc.settings.projectName || "Work breakdown structure"),
      background: palette.background,
      grid: chart.snap > 0 ? chart.snap : 10,
      shapes,
      connectors,
    },
    nodes,
  };
}

/** The style stored on a task, found without walking the tree twice. */
function findStyle(doc: WbsDoc, id: string) {
  const search = (tasks: WbsDoc["tasks"]): WbsDoc["tasks"][number]["style"] | undefined => {
    for (const task of tasks) {
      if (task.id === id) return task.style;
      const found = search(task.children);
      if (found) return found;
    }
    return undefined;
  };
  return search(doc.tasks);
}
