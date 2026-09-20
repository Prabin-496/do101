import { describe, it, expect } from "vitest";
import {
  cloneElements,
  createEdge,
  createNode,
  distanceToSegment,
  drawOrder,
  duplicateElements,
  edgeGeometry,
  elementBounds,
  elementsInRect,
  emptyBoard,
  emptyDoc,
  hitElement,
  hitTest,
  measureText,
  nodeIndex,
  normalizeRect,
  patchElements,
  removeElements,
  reorderElements,
  scaleElement,
  snap,
  spawnConnected,
  spawnPosition,
  translateElement,
  unionBounds,
  type Board,
  type EdgeEl,
  type Element,
  type ImageEl,
  type LineEl,
  type NodeEl,
  type StrokeEl,
  type TextEl,
} from "@/lib/canvas/model";
import { shouldSample, simplifyPoints, strokePath } from "@/lib/canvas/stroke";
import {
  arrowColors,
  arrowHead,
  dashArray,
  labelRows,
  nodeDetailPath,
  nodePath,
  strokeOpacity,
  textRows,
} from "@/lib/canvas/render";
import { boardBounds, escapeXml, toFile, toSvg } from "@/lib/canvas/export";
import { CanvasParseError, parseCanvasFile, parseDoc, safeColor, safeImageHref } from "@/lib/canvas/parse";
import { copySelection, pasteClip } from "@/lib/canvas/clipboard";
import { TEMPLATES, templateById } from "@/lib/canvas/templates";
import { boardFromDiagram } from "@/lib/canvas/convert";
import { fileStem } from "@/lib/canvas/download";
import { createConnector, createShape, emptyDiagram } from "@/lib/diagram/model";

/* ---------------------------------- fixtures -------------------------------- */

const ink = (over: Partial<StrokeEl> = {}): StrokeEl => ({
  id: "s1",
  type: "stroke",
  kind: "pen",
  points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 50 }],
  color: "#22303c",
  width: 4,
  ...over,
});

const node = (over: Partial<NodeEl> = {}): NodeEl => ({
  ...createNode("rectangle", 10, 10, { id: "n1" }),
  w: 100,
  h: 60,
  ...over,
});

const line = (over: Partial<LineEl> = {}): LineEl => ({
  id: "l1",
  type: "line",
  from: { x: 0, y: 0 },
  to: { x: 40, y: 40 },
  color: "#22303c",
  width: 3,
  dash: "solid",
  arrowStart: false,
  arrowEnd: true,
  ...over,
});

const text = (over: Partial<TextEl> = {}): TextEl => ({
  id: "t1",
  type: "text",
  x: 0,
  y: 0,
  w: 100,
  h: 30,
  text: "hi",
  color: "#22303c",
  size: 20,
  bold: false,
  ...over,
});

const picture = (over: Partial<ImageEl> = {}): ImageEl => ({
  id: "i1",
  type: "image",
  x: 0,
  y: 0,
  w: 80,
  h: 60,
  href: "data:image/png;base64,iVBORw0KGgo=",
  alt: "shot",
  ...over,
});

function board(elements: Element[]): Board {
  return { ...emptyBoard("Test board"), elements };
}

/** Two nodes joined left to right, the shape most of these tests need. */
function flow(): Board {
  const a = createNode("rounded", 0, 0, { id: "a", text: "A" });
  const b = createNode("rounded", 300, 0, { id: "b", text: "B" });
  const c: EdgeEl = { ...createEdge("a", "b", { id: "c1" }) };
  return board([a, b, c]);
}

/* ---------------------------------- geometry -------------------------------- */

describe("geometry", () => {
  it("measures the distance from a point to a segment", () => {
    expect(distanceToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    // Past the end, the nearest point is the endpoint itself.
    expect(distanceToSegment({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });

  it("normalises a rectangle dragged in any direction", () => {
    expect(normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10, w: 20, h: 30 });
  });

  it("snaps to the grid, and leaves a zero grid alone", () => {
    expect(snap(47, 10)).toBe(50);
    expect(snap(44, 10)).toBe(40);
    expect(snap(47.6, 0)).toBe(48);
  });

  it("bounds ink by its points plus half the nib", () => {
    expect(elementBounds(ink(), new Map())).toEqual({ x: -2, y: -2, w: 104, h: 54 });
  });

  it("grows a text box to fit its content", () => {
    expect(elementBounds(text({ w: 10, h: 10, text: "hello world" }), new Map()).w).toBeGreaterThan(10);
  });

  it("measures multi-line text by its longest line", () => {
    const one = measureText("abc", 20);
    const two = measureText("abc\nlonger line", 20);
    expect(two.w).toBeGreaterThan(one.w);
    expect(two.h).toBeGreaterThan(one.h);
  });

  it("unions the bounds of several elements", () => {
    expect(unionBounds([node(), node({ id: "n2", x: 200, y: 100 })])).toEqual({
      x: 10, y: 10, w: 290, h: 150,
    });
    expect(unionBounds([])).toBeNull();
  });

  it("includes an edge's elbows in the bounds", () => {
    const b = flow();
    const box = unionBounds(b.elements)!;
    expect(box.w).toBeGreaterThanOrEqual(450);
    expect(Number.isFinite(box.x)).toBe(true);
  });

  it("ignores an edge whose end is missing rather than reporting a box at the origin", () => {
    const orphan: EdgeEl = createEdge("gone", "also-gone", { id: "c9" });
    expect(unionBounds([orphan])).toBeNull();
    expect(unionBounds([node({ x: 500, y: 500 }), orphan])!.x).toBe(500);
  });
});

/* -------------------------------- nodes and edges ------------------------------- */

describe("edges follow their nodes", () => {
  it("routes between the two nodes it names", () => {
    const b = flow();
    const geo = edgeGeometry(b.elements[2] as EdgeEl, nodeIndex(b.elements))!;
    expect(geo).not.toBeNull();
    expect(geo.path).not.toContain("NaN");
    // Side by side, so it leaves the right edge of A.
    expect(geo.start.x).toBe(150);
  });

  it("re-routes once a node has moved past the other", () => {
    const b = flow();
    const moved = {
      ...b,
      elements: b.elements.map((el) => (el.id === "b" ? translateElement(el, -700, 0) : el)),
    };
    const geo = edgeGeometry(moved.elements[2] as EdgeEl, nodeIndex(moved.elements))!;
    expect(geo.start.x).toBe(0);
  });

  it("gives up on an edge whose node has gone", () => {
    expect(edgeGeometry(createEdge("a", "ghost"), nodeIndex([node({ id: "a" })]))).toBeNull();
  });

  it("moving an edge on its own does nothing, because it has no geometry", () => {
    const edge = createEdge("a", "b", { id: "c1" });
    expect(translateElement(edge, 50, 50)).toBe(edge);
    expect(scaleElement(edge, { x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 20, h: 20 })).toBe(edge);
  });
});

/* -------------------------------- hit testing -------------------------------- */

describe("hit testing", () => {
  const index = new Map<string, NodeEl>();

  it("hits ink near the line and misses it further away", () => {
    expect(hitElement(ink(), { x: 25, y: 1 }, index)).toBe(true);
    expect(hitElement(ink(), { x: 25, y: 40 }, index)).toBe(false);
  });

  it("hits a single-point dab", () => {
    expect(hitElement(ink({ points: [{ x: 10, y: 10 }] }), { x: 11, y: 11 }, index)).toBe(true);
    expect(hitElement(ink({ points: [{ x: 10, y: 10 }] }), { x: 60, y: 60 }, index)).toBe(false);
  });

  it("only hits an empty hollow shape near its outline", () => {
    const hollow = node({ fill: "transparent", text: "" });
    expect(hitElement(hollow, { x: 11, y: 40 }, index)).toBe(true);
    expect(hitElement(hollow, { x: 60, y: 40 }, index)).toBe(false);
  });

  it("hits anywhere inside a filled shape", () => {
    expect(hitElement(node({ fill: "#eee" }), { x: 60, y: 40 }, index)).toBe(true);
  });

  it("treats a labelled hollow shape as solid, because that is how it reads", () => {
    expect(hitElement(node({ fill: "transparent", text: "Step" }), { x: 60, y: 40 }, index)).toBe(true);
  });

  it("respects the ring of an empty hollow ellipse", () => {
    const e = node({ kind: "ellipse", fill: "transparent", text: "" });
    expect(hitElement(e, { x: 60, y: 40 }, index)).toBe(false);
    expect(hitElement(e, { x: 11, y: 40 }, index)).toBe(true);
    expect(hitElement(e, { x: 13, y: 13 }, index)).toBe(false);
  });

  it("hits a connector along its route", () => {
    const b = flow();
    const map = nodeIndex(b.elements);
    const edge = b.elements[2] as EdgeEl;
    const geo = edgeGeometry(edge, map)!;
    expect(hitElement(edge, geo.mid, map)).toBe(true);
    expect(hitElement(edge, { x: geo.mid.x, y: geo.mid.y + 400 }, map)).toBe(false);
  });

  it("returns the topmost element under the pointer", () => {
    const lower = node({ id: "low", fill: "#eee" });
    const upper = node({ id: "up", fill: "#eee" });
    expect(hitTest([lower, upper], { x: 60, y: 40 })!.id).toBe("up");
    expect(hitTest([lower, upper], { x: 900, y: 900 })).toBeNull();
  });

  it("prefers a shape over a connector passing under it", () => {
    const b = flow();
    const target = nodeIndex(b.elements).get("a")!;
    const hit = hitTest(b.elements, { x: target.x + target.w / 2, y: target.y + target.h / 2 });
    expect(hit!.id).toBe("a");
  });

  it("selects only elements fully inside a marquee", () => {
    const inside = node({ id: "in" });
    const outside = node({ id: "out", x: 500 });
    const found = elementsInRect([inside, outside], { x: 0, y: 0, w: 200, h: 200 });
    expect(found.map((e) => e.id)).toEqual(["in"]);
  });

  it("brings an edge along when both of its nodes are caught", () => {
    const found = elementsInRect(flow().elements, { x: -50, y: -50, w: 600, h: 300 });
    expect(found.map((e) => e.id).sort()).toEqual(["a", "b", "c1"]);
  });

  it("leaves an edge behind when only one end is caught", () => {
    const found = elementsInRect(flow().elements, { x: -50, y: -50, w: 250, h: 300 });
    expect(found.map((e) => e.id)).toEqual(["a"]);
  });
});

/* -------------------------------- transforms -------------------------------- */

describe("transforms", () => {
  it("moves every kind of element", () => {
    expect((translateElement(ink(), 10, 5) as StrokeEl).points[0]).toEqual({ x: 10, y: 5 });
    expect(translateElement(node(), 10, 5)).toMatchObject({ x: 20, y: 15 });
    expect(translateElement(line(), 10, 5)).toMatchObject({ from: { x: 10, y: 5 } });
  });

  it("scales ink through its bounding box", () => {
    const from = { x: 0, y: 0, w: 100, h: 100 };
    const to = { x: 0, y: 0, w: 200, h: 200 };
    const scaled = scaleElement(ink({ points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] }), from, to) as StrokeEl;
    expect(scaled.points[1]).toEqual({ x: 200, y: 200 });
    expect(scaled.width).toBe(8);
  });

  it("keeps a nib round when a box is stretched one way", () => {
    const scaled = scaleElement(ink(), { x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 400, h: 100 }) as StrokeEl;
    // The uniform factor is the smaller one, so the line does not blow out.
    expect(scaled.width).toBe(4);
  });

  it("never lets a node collapse below its minimum", () => {
    const scaled = scaleElement(node(), { x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 0, h: 0 }) as NodeEl;
    expect(scaled.w).toBeGreaterThanOrEqual(24);
  });

  it("survives scaling from a zero-width box", () => {
    const scaled = scaleElement(node(), { x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 50, h: 50 }) as NodeEl;
    expect(Number.isFinite(scaled.x)).toBe(true);
  });
});

/* -------------------------------- board edits -------------------------------- */

describe("board operations", () => {
  it("removes elements by id", () => {
    expect(removeElements(board([ink(), node()]), ["s1"]).elements).toHaveLength(1);
  });

  it("takes an edge with the node it was attached to", () => {
    const next = removeElements(flow(), ["a"]);
    expect(next.elements.map((e) => e.id)).toEqual(["b"]);
  });

  it("patches only the elements asked for, never their ids or types", () => {
    const next = patchElements(board([ink(), node()]), ["n1"], (el) => ({ ...el, fill: "#ff0000" }) as Element);
    expect((next.elements[1] as NodeEl).fill).toBe("#ff0000");
    expect(next.elements[1].id).toBe("n1");
    expect(next.elements[1].type).toBe("node");
    expect((next.elements[0] as StrokeEl).color).toBe("#22303c");
  });

  it("moves elements to the front and the back", () => {
    const b = board([ink(), node()]);
    expect(reorderElements(b, ["s1"], "front").elements.at(-1)!.id).toBe("s1");
    expect(reorderElements(b, ["n1"], "back").elements[0].id).toBe("n1");
  });

  it("moves an element one step at a time", () => {
    const b = board([node({ id: "a" }), node({ id: "b" }), node({ id: "c" })]);
    expect(reorderElements(b, ["a"], "forward").elements.map((e) => e.id)).toEqual(["b", "a", "c"]);
    expect(reorderElements(b, ["c"], "backward").elements.map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  it("keeps a block of elements in order as it steps them forward", () => {
    const b = board([node({ id: "a" }), node({ id: "b" }), node({ id: "c" })]);
    expect(reorderElements(b, ["a", "b"], "forward").elements.map((e) => e.id)).toEqual(["c", "a", "b"]);
  });

  it("duplicates with fresh ids and an offset", () => {
    const { board: next, ids } = duplicateElements(board([node()]), ["n1"], 20);
    expect(next.elements).toHaveLength(2);
    expect(ids[0]).not.toBe("n1");
    expect(next.elements[1]).toMatchObject({ x: 30, y: 30 });
  });

  it("carries the edge between two duplicated nodes, re-pointed at the copies", () => {
    const { board: next, ids } = duplicateElements(flow(), ["a", "b", "c1"], 20);
    const copied = next.elements.filter((el) => ids.includes(el.id));
    const edge = copied.find((el) => el.type === "edge") as EdgeEl;
    expect(copied).toHaveLength(3);
    expect(ids).toContain(edge.from);
    expect(ids).toContain(edge.to);
    expect(edge.from).not.toBe("a");
  });

  it("drops an edge whose other end was not copied", () => {
    const copies = cloneElements(flow().elements.filter((el) => el.id !== "b"), 0, 0);
    expect(copies.some((el) => el.type === "edge")).toBe(false);
  });

  it("draws highlighter ink at the back and connectors under the shapes", () => {
    const marker = ink({ id: "hl", kind: "highlighter" });
    const ordered = drawOrder([...flow().elements, marker]);
    expect(ordered.map((e) => e.id)).toEqual(["hl", "c1", "a", "b"]);
  });

  it("leaves the order alone when there is nothing to push back", () => {
    const elements = [node(), ink()];
    expect(drawOrder(elements)).toBe(elements);
  });
});

describe("growing a flow", () => {
  it("places a new node clear of the source on each side", () => {
    const from = { x: 100, y: 100, w: 100, h: 60 };
    const size = { w: 80, h: 40 };
    expect(spawnPosition(from, "right", size, 50).x).toBe(250);
    expect(spawnPosition(from, "left", size, 50).x).toBe(-30);
    expect(spawnPosition(from, "down", size, 50).y).toBe(210);
    expect(spawnPosition(from, "up", size, 50).y).toBe(10);
  });

  it("centres the new node on the source", () => {
    const p = spawnPosition({ x: 100, y: 100, w: 100, h: 60 }, "down", { w: 80, h: 40 }, 50);
    expect(p.x + 40).toBe(150);
  });

  it("adds a connected node that inherits the source styling", () => {
    const b = flow();
    const source = b.elements[0] as NodeEl;
    source.fill = "#ffecec";
    const result = spawnConnected(b, "a", "right")!;
    const added = nodeIndex(result.board.elements).get(result.id)!;
    expect(result.board.elements.filter((e) => e.type === "node")).toHaveLength(3);
    expect(result.board.elements.filter((e) => e.type === "edge")).toHaveLength(2);
    expect(added.fill).toBe("#ffecec");
    expect((result.board.elements.at(-1) as EdgeEl).to).toBe(added.id);
  });

  it("follows a decision with a process rather than another decision", () => {
    const b = flow();
    (b.elements[0] as NodeEl).kind = "diamond";
    const result = spawnConnected(b, "a", "down")!;
    expect(nodeIndex(result.board.elements).get(result.id)!.kind).toBe("rounded");
  });

  it("ignores a source that is not there", () => {
    expect(spawnConnected(flow(), "ghost", "up")).toBeNull();
  });
});

/* ------------------------------- ink smoothing ------------------------------ */

describe("ink smoothing", () => {
  it("skips samples that are too close together", () => {
    expect(shouldSample(undefined, { x: 0, y: 0 })).toBe(true);
    expect(shouldSample({ x: 0, y: 0 }, { x: 0.5, y: 0 })).toBe(false);
    expect(shouldSample({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
  });

  it("drops points that lie on the line between their neighbours", () => {
    const straight = Array.from({ length: 20 }, (_, i) => ({ x: i * 5, y: 0 }));
    expect(simplifyPoints(straight, 0.6)).toHaveLength(2);
  });

  it("keeps the points that carry the shape", () => {
    expect(simplifyPoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }], 0.6)).toHaveLength(3);
  });

  it("always keeps both ends", () => {
    const wobble = Array.from({ length: 30 }, (_, i) => ({ x: i, y: Math.sin(i) * 0.1 }));
    const simplified = simplifyPoints(wobble, 5);
    expect(simplified[0]).toEqual(wobble[0]);
    expect(simplified.at(-1)).toEqual(wobble.at(-1));
  });

  it("handles a very long stroke without overflowing", () => {
    const long = Array.from({ length: 20000 }, (_, i) => ({ x: i, y: (i % 7) * 3 }));
    expect(() => simplifyPoints(long, 0.5)).not.toThrow();
  });

  it("draws a dot for a single tap", () => {
    const path = strokePath([{ x: 5, y: 5 }]);
    expect(path).toContain("M 5 5");
    expect(path).toContain("L");
  });

  it("draws a straight line for two points", () => {
    expect(strokePath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe("M 0 0 L 10 10");
  });

  it("curves through three or more points", () => {
    const path = strokePath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 10 }]);
    expect(path).toContain("Q");
    expect(path).not.toContain("NaN");
  });

  it("returns nothing for no points", () => {
    expect(strokePath([])).toBe("");
  });
});

/* ----------------------------- rendering helpers ---------------------------- */

describe("rendering helpers", () => {
  it("makes the highlighter translucent and the pen solid", () => {
    expect(strokeOpacity(ink({ kind: "highlighter" }))).toBeLessThan(1);
    expect(strokeOpacity(ink())).toBe(1);
  });

  it("scales the dash pattern with the line width", () => {
    expect(dashArray("solid", 4)).toBeUndefined();
    expect(dashArray("dashed", 4)).not.toBe(dashArray("dashed", 8));
    expect(dashArray("dotted", 4)).toBeDefined();
  });

  it("points an arrow head along the line", () => {
    const head = arrowHead({ x: 100, y: 0 }, { x: 0, y: 0 }, 10);
    expect(head).toContain("L 100 0");
    expect(head).not.toContain("NaN");
  });

  it("closes the outline of every shape kind it offers", () => {
    const kinds = ["rectangle", "rounded", "ellipse", "diamond", "parallelogram", "hexagon", "cylinder", "triangle", "document", "note"] as const;
    for (const kind of kinds) {
      const path = nodePath({ kind, x: 0, y: 0, w: 120, h: 60 });
      expect(path.startsWith("M"), `${kind} should start with a move`).toBe(true);
      expect(path).not.toContain("NaN");
      expect(path).toContain("Z");
    }
  });

  it("gives a cylinder a lid and a note a fold", () => {
    expect(nodeDetailPath({ kind: "cylinder", x: 0, y: 0, w: 100, h: 80 })).toContain("A");
    expect(nodeDetailPath({ kind: "note", x: 0, y: 0, w: 100, h: 80 })).toContain("M");
    expect(nodeDetailPath({ kind: "rectangle", x: 0, y: 0, w: 100, h: 80 })).toBeNull();
  });

  it("centres a label but writes a note from its top-left corner", () => {
    const centred = labelRows(node({ text: "Step" }))!;
    const sticky = labelRows(node({ kind: "note", text: "Idea" }))!;
    expect(centred.rows[0].x).toBe(60);
    expect(sticky.rows[0].x).toBeLessThan(centred.rows[0].x);
    expect(sticky.y).toBeGreaterThan(node().y);
  });

  it("has no label rows for an unlabelled shape", () => {
    expect(labelRows(node({ text: "  " }))).toBeNull();
  });

  it("lays free text out one row at a time", () => {
    const rows = textRows("one\ntwo", 20);
    expect(rows).toHaveLength(2);
    expect(rows[1].dy).toBeGreaterThan(0);
  });

  it("lists one arrow colour per connector that has an arrow", () => {
    const b = flow();
    const extra: EdgeEl = createEdge("b", "a", { id: "c2", stroke: "#ff4b4b" });
    const plain: EdgeEl = createEdge("a", "b", { id: "c3", endArrow: false, startArrow: false });
    expect(arrowColors([...b.elements, extra, plain]).sort()).toEqual(["#64757f", "#ff4b4b"]);
  });
});

/* -------------------------------- SVG export -------------------------------- */

describe("SVG export", () => {
  it("renders every element type without producing NaN", () => {
    const svg = toSvg(
      board([
        ink(),
        node(),
        node({ id: "n2", kind: "ellipse", fill: "#eef" }),
        node({ id: "n3", kind: "note", text: "note" }),
        line(),
        text(),
        picture(),
      ]),
    );
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
  });

  it("renders a connector between two shapes", () => {
    const svg = toSvg(flow());
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain("<title>Test board</title>");
    expect(svg).not.toContain("NaN");
  });

  it("draws connectors under the shapes they join", () => {
    const b = flow();
    (b.elements[0] as NodeEl).fill = "#abcdef";
    (b.elements[2] as EdgeEl).stroke = "#123456";
    const svg = toSvg(b);
    expect(svg.indexOf("#123456")).toBeLessThan(svg.indexOf("#abcdef"));
  });

  it("puts highlighter ink behind the rest", () => {
    const svg = toSvg(board([node({ fill: "#abcdef" }), ink({ id: "hl", kind: "highlighter", color: "#ff0000" })]));
    expect(svg.indexOf("#ff0000")).toBeLessThan(svg.indexOf("#abcdef"));
  });

  it("defines one arrow marker per colour in use", () => {
    const b = flow();
    b.elements.push(createEdge("b", "a", { id: "c2", stroke: "#ff4b4b" }));
    const svg = toSvg(b);
    expect((svg.match(/<marker /g) ?? []).length).toBe(2);
    expect(svg).not.toContain("context-stroke");
  });

  it("skips a connector whose node has been deleted", () => {
    const svg = toSvg(board([node({ id: "a" }), createEdge("a", "ghost", { id: "c1" })]));
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("marker-end");
  });

  it("draws the paper, and leaves it out when transparent", () => {
    expect(toSvg(board([node()]))).toContain('fill="#ffffff"');
    expect(toSvg(board([node()]), { transparent: true })).not.toContain("<rect");
  });

  it("includes the chosen paper pattern", () => {
    expect(toSvg({ ...board([node()]), paper: "grid" })).toContain("<pattern");
    expect(toSvg(board([node()]))).not.toContain("<pattern");
  });

  it("escapes text so it cannot break out into markup", () => {
    const svg = toSvg(board([text({ text: "</text><script>alert(1)</script>" })]));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("escapes a shape label too", () => {
    // Short enough not to wrap, so the escaped text lands in one tspan.
    const svg = toSvg(board([node({ text: `<b>&"` })]));
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;&amp;&quot;");
  });

  it("escapes a long label even though it wraps across lines", () => {
    const svg = toSvg(board([node({ text: "</text><script>alert(1)</script>" })]));
    expect(svg).not.toContain("<script>");
    // The only real </text> is the one the exporter closed itself.
    expect((svg.match(/<\/text>/g) ?? []).length).toBe(1);
    expect(svg).toContain("&lt;/text&gt;");
  });

  it("escapes the five XML entities", () => {
    expect(escapeXml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&apos;");
  });

  it("falls back to a sensible page for an empty board", () => {
    expect(boardBounds(emptyBoard())).toEqual({ x: 0, y: 0, w: 960, h: 600 });
  });

  it("can export a chosen area instead of the drawing", () => {
    expect(toSvg(board([node()]), { area: { x: 0, y: 0, w: 300, h: 200 } })).toContain('viewBox="0 0 300 200"');
  });

  it("scales the output box without changing the viewBox", () => {
    const b = board([node()]);
    const svg = toSvg(b, { scale: 2 });
    const area = boardBounds(b);
    expect(svg).toContain(`width="${area.w * 2}"`);
    expect(svg).toContain(`viewBox="${area.x} ${area.y} ${area.w} ${area.h}"`);
  });
});

/* ------------------------------ saving and loading ----------------------------- */

describe("saving and loading", () => {
  it("round-trips a document through the file format", () => {
    const doc = { ...emptyDoc("My canvas"), boards: [flow()] };
    const restored = parseCanvasFile(toFile(doc));
    expect(restored.name).toBe("My canvas");
    expect(restored.boards[0].elements.map((e) => e.id)).toEqual(["a", "b", "c1"]);
  });

  it("keeps every element type through a round trip", () => {
    const doc = { ...emptyDoc(), boards: [board([ink(), node(), line(), text(), picture()])] };
    const restored = parseCanvasFile(toFile(doc));
    expect(restored.boards[0].elements.map((e) => e.type)).toEqual([
      "stroke", "node", "line", "text", "image",
    ]);
  });

  it("accepts a bare document as well as a wrapped file", () => {
    const doc = { ...emptyDoc(), boards: [board([node()])] };
    expect(parseCanvasFile(JSON.stringify(doc)).boards[0].elements).toHaveLength(1);
  });

  it("rejects text that is not JSON", () => {
    expect(() => parseCanvasFile("nope")).toThrow(CanvasParseError);
  });

  it("rejects JSON that is not an object", () => {
    expect(() => parseCanvasFile("[1,2]")).toThrow(CanvasParseError);
  });

  it("always leaves at least one board to draw on", () => {
    expect(parseDoc({ boards: [] }).boards).toHaveLength(1);
    expect(parseDoc({}).boards).toHaveLength(1);
  });

  it("drops elements of an unknown type", () => {
    const parsed = parseDoc({ boards: [{ elements: [{ type: "wormhole" }, { type: "node" }] }] });
    expect(parsed.boards[0].elements).toHaveLength(1);
  });

  it("drops a stroke with no points", () => {
    expect(parseDoc({ boards: [{ elements: [{ type: "stroke", points: [] }] }] }).boards[0].elements).toHaveLength(0);
  });

  it("drops duplicate ids", () => {
    const parsed = parseDoc({
      boards: [{ elements: [{ id: "a", type: "node" }, { id: "a", type: "node", kind: "ellipse" }] }],
    });
    expect(parsed.boards[0].elements).toHaveLength(1);
  });

  it("drops a connector whose endpoints are not on the board", () => {
    const parsed = parseDoc({
      boards: [
        {
          elements: [
            { id: "a", type: "node" },
            { id: "c1", type: "edge", from: "a", to: "ghost" },
            { id: "c2", type: "edge", from: "a", to: "a" },
          ],
        },
      ],
    });
    expect(parsed.boards[0].elements.map((e) => e.id)).toEqual(["a"]);
  });

  it("clamps absurd numbers from a hand-edited file", () => {
    const parsed = parseDoc({
      boards: [{ elements: [{ type: "node", w: 1e9, h: -20, strokeWidth: 9999, fontSize: 900 }] }],
    });
    const el = parsed.boards[0].elements[0] as NodeEl;
    expect(el.w).toBe(200000);
    expect(el.h).toBe(24);
    expect(el.strokeWidth).toBe(24);
    expect(el.fontSize).toBe(200);
  });

  it("falls back to a rectangle for an unknown shape kind", () => {
    const parsed = parseDoc({ boards: [{ elements: [{ type: "node", kind: "wormhole" }] }] });
    expect((parsed.boards[0].elements[0] as NodeEl).kind).toBe("rectangle");
  });

  it("refuses a colour that is not a plain colour value", () => {
    expect(safeColor("#ff0000", "#000")).toBe("#ff0000");
    expect(safeColor("rgb(1, 2, 3)", "#000")).toBe("rgb(1, 2, 3)");
    expect(safeColor("url(#evil)", "#000")).toBe("#000");
    expect(safeColor('red" onload="alert(1)', "#000")).toBe("#000");
    expect(safeColor(42, "#000")).toBe("#000");
  });

  it("only accepts inline image data, never a remote or script URL", () => {
    expect(safeImageHref("data:image/png;base64,iVBORw0KGgo=")).not.toBeNull();
    expect(safeImageHref("https://example.com/tracker.png")).toBeNull();
    expect(safeImageHref("javascript:alert(1)")).toBeNull();
    expect(safeImageHref("data:text/html;base64,abcd")).toBeNull();
  });

  it("drops a picture whose source was refused", () => {
    const parsed = parseDoc({ boards: [{ elements: [{ type: "image", href: "https://example.com/x.png" }] }] });
    expect(parsed.boards[0].elements).toHaveLength(0);
  });
});

describe("opening what the old tools saved", () => {
  it("turns a whiteboard file's boxes and notes into shapes", () => {
    const legacy = {
      format: "do101-whiteboard",
      doc: {
        name: "Old board",
        boards: [
          {
            name: "Board 1",
            background: "dots",
            backgroundColor: "#fffdf5",
            elements: [
              { id: "r", type: "rect", x: 0, y: 0, w: 120, h: 60, color: "#22b8f0", width: 3, dash: "dashed", fill: "transparent" },
              { id: "e", type: "ellipse", x: 200, y: 0, w: 100, h: 100, color: "#4cc93f", width: 2, fill: "#eefbe9" },
              { id: "n", type: "note", x: 0, y: 200, w: 180, h: 180, text: "remember", fill: "#fff8dd", color: "#22303c", size: 16 },
              { id: "k", type: "stroke", kind: "pen", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: "#000", width: 4 },
            ],
          },
        ],
      },
    };
    const doc = parseCanvasFile(JSON.stringify(legacy));
    const b = doc.boards[0];
    expect(doc.name).toBe("Old board");
    expect(b.paper).toBe("dots");
    expect(b.paperColor).toBe("#fffdf5");

    const kinds = b.elements.map((el) => (el.type === "node" ? el.kind : el.type));
    expect(kinds).toEqual(["rectangle", "ellipse", "note", "stroke"]);

    const rect = b.elements[0] as NodeEl;
    expect(rect.stroke).toBe("#22b8f0");
    expect(rect.strokeWidth).toBe(3);
    expect(rect.dash).toBe("dashed");
    expect(rect.fill).toBe("transparent");

    const sticky = b.elements[2] as NodeEl;
    expect(sticky.text).toBe("remember");
    expect(sticky.fontSize).toBe(16);
    expect(sticky.textColor).toBe("#22303c");
  });

  it("turns a diagram file into a single board, connectors intact", () => {
    const diagram = {
      ...emptyDiagram("Old diagram"),
      grid: 20,
      shapes: [createShape("rounded", 0, 0, { id: "a", text: "A" }), createShape("diamond", 300, 0, { id: "b" })],
      connectors: [createConnector("a", "b", { id: "c1", label: "yes", style: "dashed" })],
    };
    const doc = parseCanvasFile(JSON.stringify({ format: "do101-diagram", diagram }));
    expect(doc.boards).toHaveLength(1);
    expect(doc.name).toBe("Old diagram");

    const b = doc.boards[0];
    expect(b.grid).toBe(20);
    const edge = b.elements.find((el) => el.type === "edge") as EdgeEl;
    expect(edge.from).toBe("a");
    expect(edge.to).toBe("b");
    expect(edge.label).toBe("yes");
    // A connector's `style` is what a canvas calls a dash.
    expect(edge.dash).toBe("dashed");
    expect(edgeGeometry(edge, nodeIndex(b.elements))).not.toBeNull();
  });

  it("accepts a bare diagram object, not just a wrapped one", () => {
    const diagram = { ...emptyDiagram("Bare"), shapes: [createShape("rectangle", 0, 0, { id: "a" })], connectors: [] };
    expect(parseCanvasFile(JSON.stringify(diagram)).boards[0].elements).toHaveLength(1);
  });

  it("converts a diagram without going through JSON", () => {
    const diagram = {
      ...emptyDiagram("Direct"),
      shapes: [createShape("cylinder", 10, 10, { id: "db", text: "Data" })],
      connectors: [],
    };
    const b = boardFromDiagram(diagram);
    expect(b.name).toBe("Direct");
    expect((b.elements[0] as NodeEl).kind).toBe("cylinder");
    expect((b.elements[0] as NodeEl).text).toBe("Data");
  });
});

/* -------------------------------- copy and paste ------------------------------- */

describe("copy and paste", () => {
  it("carries connectors that run between the copied shapes", () => {
    const clip = copySelection(flow(), ["a", "b", "c1"])!;
    expect(clip.elements).toHaveLength(3);
  });

  it("drops a connector whose other end was not copied", () => {
    const clip = copySelection(flow(), ["a", "c1"])!;
    expect(clip.elements.map((e) => e.id)).toEqual(["a"]);
  });

  it("returns nothing when the selection is empty", () => {
    expect(copySelection(flow(), [])).toBeNull();
  });

  it("gives pasted elements new ids and offsets them", () => {
    const b = flow();
    const { board: next, ids } = pasteClip(b, copySelection(b, ["a", "b", "c1"])!, undefined, 20);
    expect(next.elements).toHaveLength(6);
    expect(ids.every((id) => !["a", "b", "c1"].includes(id))).toBe(true);
    expect((next.elements[3] as NodeEl).x).toBe(20);
  });

  it("re-points pasted connectors at the pasted copies", () => {
    const b = flow();
    const { board: next, ids } = pasteClip(b, copySelection(b, ["a", "b", "c1"])!);
    const pasted = next.elements.at(-1) as EdgeEl;
    expect(ids).toContain(pasted.from);
    expect(ids).toContain(pasted.to);
    expect(pasted.id).not.toBe("c1");
  });

  it("drops the group where it was asked for", () => {
    const b = flow();
    const { board: next } = pasteClip(b, copySelection(b, ["a", "b"])!, { x: 1000, y: 500 });
    const pasted = next.elements.slice(3) as NodeEl[];
    expect(Math.min(...pasted.map((n) => n.x))).toBe(1000);
    expect(Math.min(...pasted.map((n) => n.y))).toBe(500);
  });

  it("does not mutate the board it copied from", () => {
    const b = flow();
    const clip = copySelection(b, ["a"])!;
    (clip.elements[0] as NodeEl).x = 999;
    expect((b.elements[0] as NodeEl).x).toBe(0);
  });
});

/* ---------------------------------- templates --------------------------------- */

describe("templates", () => {
  it("every template builds a board that exports cleanly", () => {
    for (const template of TEMPLATES) {
      const svg = toSvg(template.build());
      expect(svg, template.id).not.toContain("NaN");
      expect(svg, template.id).not.toContain("undefined");
    }
  });

  it("every template connector points at a shape that exists", () => {
    for (const template of TEMPLATES) {
      const b = template.build();
      const nodes = nodeIndex(b.elements);
      for (const el of b.elements) {
        if (el.type !== "edge") continue;
        expect(nodes.has(el.from), `${template.id}: missing source`).toBe(true);
        expect(nodes.has(el.to), `${template.id}: missing target`).toBe(true);
      }
    }
  });

  it("gives every element a unique id", () => {
    for (const template of TEMPLATES) {
      const ids = template.build().elements.map((el) => el.id);
      expect(new Set(ids).size, template.id).toBe(ids.length);
    }
  });

  it("offers a blank board and the diagram starters", () => {
    expect(templateById("blank")!.build().elements).toEqual([]);
    expect(templateById("flowchart")!.name).toBe("Flowchart");
    expect(templateById("retro")!.build().elements.length).toBeGreaterThan(0);
    expect(templateById("nope")).toBeUndefined();
  });
});

/* ---------------------------------- file names --------------------------------- */

describe("file names", () => {
  it("makes a safe stem from any name", () => {
    expect(fileStem("Team sync — Q3 plan!")).toBe("team-sync-q3-plan");
    expect(fileStem("   ")).toBe("canvas");
    expect(fileStem("???")).toBe("canvas");
  });
});
