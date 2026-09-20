import { describe, it, expect } from "vitest";
import {
  autoPorts,
  clampSize,
  connectorGeometry,
  createConnector,
  createShape,
  diagramBounds,
  duplicateShape,
  emptyDiagram,
  hitShape,
  portPoint,
  removeShape,
  reorderShape,
  snap,
  type Diagram,
} from "@/lib/diagram/model";
import { shapePath, wrapLabel, labelLineOffsets } from "@/lib/diagram/shapes";
import { escapeXml, toFile, toSvg } from "@/lib/diagram/export";
import { DiagramParseError, parseDiagram, parseDiagramFile, safeColor } from "@/lib/diagram/parse";
import { TEMPLATES, templateById } from "@/lib/diagram/templates";
import { snapToShapes, unionRect } from "@/lib/diagram/align";
import { PALETTE_GROUPS, spawnConnected, spawnPosition } from "@/lib/diagram/model";

function sample(): Diagram {
  const a = createShape("rounded", 0, 0, { id: "a", text: "A" });
  const b = createShape("rounded", 300, 0, { id: "b", text: "B" });
  return {
    ...emptyDiagram("Sample"),
    shapes: [a, b],
    connectors: [createConnector("a", "b", { id: "c1" })],
  };
}

describe("shape geometry", () => {
  it("places ports on the edge midpoints", () => {
    const r = { x: 10, y: 20, w: 100, h: 50 };
    expect(portPoint(r, "top")).toEqual({ x: 60, y: 20 });
    expect(portPoint(r, "bottom")).toEqual({ x: 60, y: 70 });
    expect(portPoint(r, "left")).toEqual({ x: 10, y: 45 });
    expect(portPoint(r, "right")).toEqual({ x: 110, y: 45 });
  });

  it("clamps a shape to the allowed size range", () => {
    expect(clampSize(2)).toBe(24);
    expect(clampSize(120.4)).toBe(120);
    expect(clampSize(99999)).toBe(4000);
  });

  it("snaps to the grid, and leaves a zero grid alone", () => {
    expect(snap(47, 10)).toBe(50);
    expect(snap(44, 10)).toBe(40);
    expect(snap(47.6, 0)).toBe(48);
  });

  it("produces a closed path for every shape kind", () => {
    const kinds = TEMPLATES.flatMap((t) => t.build().shapes.map((s) => s.kind));
    for (const kind of new Set(kinds)) {
      const path = shapePath({ kind, x: 0, y: 0, w: 120, h: 60 });
      expect(path.startsWith("M"), `${kind} should start with a move`).toBe(true);
      expect(path.length).toBeGreaterThan(10);
      expect(path).not.toContain("NaN");
    }
  });
});

describe("connector routing", () => {
  it("picks left/right ports when shapes sit side by side", () => {
    const a = { x: 0, y: 0, w: 100, h: 60 };
    const b = { x: 400, y: 10, w: 100, h: 60 };
    expect(autoPorts(a, b)).toEqual({ from: "right", to: "left" });
    expect(autoPorts(b, a)).toEqual({ from: "left", to: "right" });
  });

  it("picks top/bottom ports when shapes are stacked", () => {
    const a = { x: 0, y: 0, w: 100, h: 60 };
    const b = { x: 10, y: 400, w: 100, h: 60 };
    expect(autoPorts(a, b)).toEqual({ from: "bottom", to: "top" });
  });

  it("re-routes when a shape moves past the other", () => {
    const a = { x: 0, y: 0, w: 100, h: 60 };
    const right = connectorGeometry({ fromPort: "auto", toPort: "auto", routing: "straight" }, a, {
      x: 400, y: 0, w: 100, h: 60,
    });
    const left = connectorGeometry({ fromPort: "auto", toPort: "auto", routing: "straight" }, a, {
      x: -400, y: 0, w: 100, h: 60,
    });
    expect(right.start.x).toBe(100);
    expect(left.start.x).toBe(0);
  });

  it("builds an orthogonal path out of right angles only", () => {
    const geo = connectorGeometry(
      { fromPort: "auto", toPort: "auto", routing: "orthogonal" },
      { x: 0, y: 0, w: 100, h: 60 },
      { x: 300, y: 200, w: 100, h: 60 },
    );
    for (let i = 1; i < geo.points.length; i += 1) {
      const dx = Math.abs(geo.points[i].x - geo.points[i - 1].x);
      const dy = Math.abs(geo.points[i].y - geo.points[i - 1].y);
      expect(dx < 0.01 || dy < 0.01, "each leg is horizontal or vertical").toBe(true);
    }
  });

  it("puts the label at the half-way point of a straight line", () => {
    const geo = connectorGeometry(
      { fromPort: "auto", toPort: "auto", routing: "straight" },
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 300, y: 0, w: 100, h: 100 },
    );
    expect(geo.mid).toEqual({ x: 200, y: 50 });
  });

  it("emits a cubic curve for curved routing", () => {
    const geo = connectorGeometry(
      { fromPort: "auto", toPort: "auto", routing: "curved" },
      { x: 0, y: 0, w: 100, h: 60 },
      { x: 400, y: 0, w: 100, h: 60 },
    );
    expect(geo.path).toContain("C");
    expect(geo.path).not.toContain("NaN");
  });
});

describe("document edits", () => {
  it("removes the connectors attached to a deleted shape", () => {
    const next = removeShape(sample(), "a");
    expect(next.shapes).toHaveLength(1);
    expect(next.connectors).toHaveLength(0);
  });

  it("offsets a duplicate and gives it a fresh id", () => {
    const result = duplicateShape(sample(), "a");
    expect(result).not.toBeNull();
    const copy = result!.diagram.shapes.at(-1)!;
    expect(copy.id).not.toBe("a");
    expect(copy.x).toBe(24);
    expect(result!.diagram.connectors).toHaveLength(1);
  });

  it("moves a shape to the front of the draw order", () => {
    const next = reorderShape(sample(), "a", "front");
    expect(next.shapes.at(-1)!.id).toBe("a");
    expect(next.shapes).toHaveLength(2);
  });

  it("hit-tests the topmost shape under the pointer", () => {
    const d = sample();
    const overlapped = { ...d, shapes: [d.shapes[0], { ...d.shapes[1], id: "top", x: 0, y: 0 }] };
    expect(hitShape(overlapped.shapes, { x: 10, y: 10 })!.id).toBe("top");
    expect(hitShape(overlapped.shapes, { x: -50, y: -50 })).toBeNull();
  });

  it("measures bounds around every shape plus padding", () => {
    const box = diagramBounds(sample(), 40);
    expect(box.x).toBe(-40);
    expect(box.y).toBe(-40);
    expect(box.w).toBeGreaterThan(450);
  });

  it("falls back to a default box for an empty diagram", () => {
    expect(diagramBounds(emptyDiagram())).toEqual({ x: 0, y: 0, w: 640, h: 400 });
  });
});

describe("label wrapping", () => {
  it("wraps long text onto several lines", () => {
    const lines = wrapLabel("the quick brown fox jumps over the lazy dog", {
      x: 0, y: 0, w: 140, h: 60, kind: "rectangle", fontSize: 14,
    });
    expect(lines.length).toBeGreaterThan(1);
  });

  it("keeps explicit line breaks", () => {
    const lines = wrapLabel("one\ntwo", { x: 0, y: 0, w: 400, h: 60, kind: "rectangle", fontSize: 14 });
    expect(lines).toEqual(["one", "two"]);
  });

  it("hard-breaks a word that cannot fit", () => {
    const lines = wrapLabel("supercalifragilisticexpialidocious", {
      x: 0, y: 0, w: 60, h: 40, kind: "rectangle", fontSize: 14,
    });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("supercalifragilisticexpialidocious");
  });

  it("returns nothing for blank text", () => {
    expect(wrapLabel("   ", { x: 0, y: 0, w: 100, h: 40, kind: "rectangle", fontSize: 14 })).toEqual([]);
  });

  it("centres the block of lines vertically", () => {
    const offsets = labelLineOffsets(2, 14);
    expect(offsets[0]).toBeCloseTo(-9.45);
    expect(offsets[0] + offsets[1]).toBeCloseTo(0);
  });
});

describe("SVG export", () => {
  it("renders shapes, connectors and a title", () => {
    const svg = toSvg(sample());
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<title>Sample</title>");
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(svg).not.toContain("NaN");
  });

  it("omits the background rect when transparent is asked for", () => {
    const opaque = toSvg(sample());
    const clear = toSvg(sample(), { transparent: true });
    expect(opaque).toContain('fill="#ffffff"');
    expect(clear.indexOf("<rect")).toBe(-1);
  });

  it("defines one arrow marker per colour in use", () => {
    const d = sample();
    d.connectors.push(createConnector("b", "a", { id: "c2", stroke: "#ff4b4b" }));
    const svg = toSvg(d);
    expect((svg.match(/<marker /g) ?? []).length).toBe(2);
    expect(svg).not.toContain("context-stroke");
  });

  it("escapes label text so it cannot break out into markup", () => {
    const d = sample();
    d.shapes[0].text = '</text><script>alert(1)</script>';
    const svg = toSvg(d);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("escapes the five XML entities", () => {
    expect(escapeXml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&apos;");
  });

  it("scales the output box without changing the viewBox", () => {
    const svg = toSvg(sample(), { scale: 2 });
    const box = diagramBounds(sample(), 40);
    expect(svg).toContain(`width="${box.w * 2}"`);
    expect(svg).toContain(`viewBox="${box.x} ${box.y} ${box.w} ${box.h}"`);
  });
});

describe("saving and loading", () => {
  it("round-trips a diagram through the file format", () => {
    const original = sample();
    const restored = parseDiagramFile(toFile(original));
    expect(restored.name).toBe("Sample");
    expect(restored.shapes.map((s) => s.id)).toEqual(["a", "b"]);
    expect(restored.connectors).toHaveLength(1);
  });

  it("accepts a bare diagram object as well as a wrapped file", () => {
    expect(parseDiagramFile(JSON.stringify(sample())).shapes).toHaveLength(2);
  });

  it("rejects text that is not JSON", () => {
    expect(() => parseDiagramFile("not a diagram")).toThrow(DiagramParseError);
  });

  it("rejects JSON that is not an object", () => {
    expect(() => parseDiagramFile("[1,2,3]")).toThrow(DiagramParseError);
  });

  it("drops connectors whose endpoints are missing", () => {
    const parsed = parseDiagram({
      shapes: [{ id: "a", kind: "rectangle" }],
      connectors: [{ from: "a", to: "ghost" }, { from: "a", to: "a" }],
    });
    expect(parsed.connectors).toHaveLength(0);
  });

  it("drops shapes that share an id", () => {
    const parsed = parseDiagram({
      shapes: [{ id: "a", kind: "rectangle" }, { id: "a", kind: "ellipse" }],
    });
    expect(parsed.shapes).toHaveLength(1);
  });

  it("clamps absurd sizes and unknown kinds from a hand-edited file", () => {
    const parsed = parseDiagram({
      shapes: [{ id: "a", kind: "wormhole", w: 1e9, h: -5, fontSize: 900 }],
    });
    expect(parsed.shapes[0].kind).toBe("rectangle");
    expect(parsed.shapes[0].w).toBe(4000);
    expect(parsed.shapes[0].h).toBe(24);
    expect(parsed.shapes[0].fontSize).toBe(96);
  });

  it("refuses a colour that is not a plain colour value", () => {
    expect(safeColor("#ff0000", "#000")).toBe("#ff0000");
    expect(safeColor("rgb(1, 2, 3)", "#000")).toBe("rgb(1, 2, 3)");
    expect(safeColor("url(#evil)", "#000")).toBe("#000");
    expect(safeColor('red" onload="alert(1)', "#000")).toBe("#000");
    expect(safeColor(42, "#000")).toBe("#000");
  });

  it("survives a file with no shapes at all", () => {
    const parsed = parseDiagram({ name: "Empty" });
    expect(parsed.shapes).toEqual([]);
    expect(parsed.connectors).toEqual([]);
    expect(parsed.name).toBe("Empty");
  });
});

describe("templates", () => {
  it("every template builds a diagram that exports cleanly", () => {
    for (const template of TEMPLATES) {
      const diagram = template.build();
      const svg = toSvg(diagram);
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
    }
  });

  it("every template connector points at a shape that exists", () => {
    for (const template of TEMPLATES) {
      const diagram = template.build();
      const ids = new Set(diagram.shapes.map((s) => s.id));
      for (const connector of diagram.connectors) {
        expect(ids.has(connector.from), `${template.id}: missing source`).toBe(true);
        expect(ids.has(connector.to), `${template.id}: missing target`).toBe(true);
      }
    }
  });

  it("gives every shape a unique id", () => {
    for (const template of TEMPLATES) {
      const diagram = template.build();
      expect(new Set(diagram.shapes.map((s) => s.id)).size).toBe(diagram.shapes.length);
    }
  });

  it("looks a template up by id", () => {
    expect(templateById("flowchart")!.name).toBe("Flowchart");
    expect(templateById("nope")).toBeUndefined();
  });
});

describe("alignment guides", () => {
  const other = { x: 100, y: 100, w: 100, h: 50 };

  it("snaps a near-aligned left edge and reports a guide", () => {
    const result = snapToShapes({ x: 103, y: 300, w: 100, h: 50 }, [other], 6);
    expect(result.dx).toBe(-3);
    expect(result.guides.some((g) => g.axis === "x" && g.at === 100)).toBe(true);
  });

  it("snaps centres to each other", () => {
    const result = snapToShapes({ x: 148, y: 300, w: 100, h: 50 }, [other], 6);
    expect(result.dx).toBe(2);
  });

  it("leaves a shape alone when nothing is close", () => {
    const result = snapToShapes({ x: 500, y: 500, w: 100, h: 50 }, [other], 6);
    expect(result).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it("prefers the closest of two candidates", () => {
    const near = { x: 104, y: 400, w: 100, h: 50 };
    const result = snapToShapes({ x: 103, y: 300, w: 100, h: 50 }, [other, near], 6);
    expect(result.dx).toBe(1);
  });

  it("snaps both axes at once", () => {
    const result = snapToShapes({ x: 102, y: 97, w: 100, h: 50 }, [other], 6);
    expect(result.dx).toBe(-2);
    expect(result.dy).toBe(3);
    expect(result.guides).toHaveLength(2);
  });

  it("draws a guide long enough to span both shapes", () => {
    const result = snapToShapes({ x: 100, y: 400, w: 100, h: 50 }, [other], 6);
    const guide = result.guides.find((g) => g.axis === "x")!;
    expect(guide.from).toBe(100);
    expect(guide.to).toBe(450);
  });

  it("does nothing when snapping is switched off", () => {
    expect(snapToShapes({ x: 101, y: 101, w: 10, h: 10 }, [other], 0).guides).toEqual([]);
  });

  it("unions a group of rectangles", () => {
    expect(unionRect([{ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 20, w: 10, h: 10 }])).toEqual({
      x: 0, y: 0, w: 50, h: 30,
    });
    expect(unionRect([])).toBeNull();
  });
});

describe("quick-add arrows", () => {
  it("places a new shape clear of the source on each side", () => {
    const from = { x: 100, y: 100, w: 100, h: 60 };
    const size = { w: 80, h: 40 };
    expect(spawnPosition(from, "right", size, 50).x).toBe(250);
    expect(spawnPosition(from, "left", size, 50).x).toBe(-30);
    expect(spawnPosition(from, "down", size, 50).y).toBe(210);
    expect(spawnPosition(from, "up", size, 50).y).toBe(10);
  });

  it("centres the new shape on the source", () => {
    const from = { x: 100, y: 100, w: 100, h: 60 };
    const p = spawnPosition(from, "down", { w: 80, h: 40 }, 50);
    expect(p.x + 40).toBe(150);
  });

  it("adds a connected shape that inherits the source styling", () => {
    const d = sample();
    d.shapes[0].fill = "#ffecec";
    const result = spawnConnected(d, "a", "right")!;
    const added = result.diagram.shapes.at(-1)!;
    expect(result.diagram.shapes).toHaveLength(3);
    expect(result.diagram.connectors).toHaveLength(2);
    expect(added.fill).toBe("#ffecec");
    expect(result.diagram.connectors.at(-1)!.from).toBe("a");
    expect(result.diagram.connectors.at(-1)!.to).toBe(added.id);
  });

  it("follows a decision with a process rather than another decision", () => {
    const d = sample();
    d.shapes[0].kind = "diamond";
    expect(spawnConnected(d, "a", "down")!.diagram.shapes.at(-1)!.kind).toBe("rounded");
  });

  it("ignores a source that is not there", () => {
    expect(spawnConnected(sample(), "ghost", "up")).toBeNull();
  });

  it("lists every palette shape as a real shape kind", () => {
    for (const group of PALETTE_GROUPS) {
      expect(group.kinds.length).toBeGreaterThan(0);
      for (const kind of group.kinds) {
        expect(shapePath({ kind, x: 0, y: 0, w: 60, h: 40 })).toContain("M");
      }
    }
  });
});
