import { describe, it, expect } from "vitest";
import { defaultChart, defaultFields, defaultGantt, defaultSettings } from "@/lib/wbs/fields";
import { flatten, newTask, type ChartSettings, type WbsDoc, type WbsTask } from "@/lib/wbs/model";
import {
  buildNodeTree,
  cardHeight,
  layoutNodes,
  nodeLabel,
  paletteFor,
  PALETTES,
  portsFor,
  prunePositions,
  ROOT_ID,
  wbsToDiagram,
} from "@/lib/wbs/chart";
import { toFile, toSvg } from "@/lib/diagram/export";
import { parseDiagramFile } from "@/lib/diagram/parse";

function doc(tasks: WbsTask[], chart: Partial<ChartSettings> = {}): WbsDoc {
  return {
    version: 1,
    settings: { ...defaultSettings(), projectName: "Harbour" },
    chart: { ...defaultChart(), ...chart },
    gantt: defaultGantt(),
    fields: defaultFields(),
    tasks,
  };
}

function tree(): WbsTask[] {
  const scope = { ...newTask("Scope"), values: { cost: 100, status: "Done" } };
  const budget = { ...newTask("Budget"), values: { cost: 300, status: "Blocked" } };
  return [
    { ...newTask("Planning"), children: [scope, budget] },
    { ...newTask("Delivery"), values: { cost: 50 } },
  ];
}

const SIZE = { w: 190, h: 74 };

describe("building the node tree", () => {
  it("mirrors the task tree", () => {
    const roots = buildNodeTree(flatten(doc(tree())), false);
    expect(roots).toHaveLength(2);
    expect(roots[0].children.map((node) => node.row?.name)).toEqual(["Scope", "Budget"]);
  });

  it("hangs everything under a project node when one is asked for", () => {
    const roots = buildNodeTree(flatten(doc(tree())), true);
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe(ROOT_ID);
    expect(roots[0].children).toHaveLength(2);
  });

  it("leaves out the children of a collapsed task", () => {
    const tasks = tree();
    const collapsed = [{ ...tasks[0], collapsed: true }, tasks[1]];
    const roots = buildNodeTree(flatten(doc(collapsed)), false);
    expect(roots[0].children).toHaveLength(0);
  });
});

describe("layout", () => {
  it("centres a parent over its children", () => {
    const nodes = layoutNodes(buildNodeTree(flatten(doc(tree())), false), defaultChart(), SIZE);
    const planning = nodes.find((node) => node.row?.name === "Planning")!;
    const scope = nodes.find((node) => node.row?.name === "Scope")!;
    const budget = nodes.find((node) => node.row?.name === "Budget")!;
    expect(planning.x).toBe((scope.x + budget.x) / 2);
  });

  it("puts each level on its own line", () => {
    const chart = defaultChart();
    const nodes = layoutNodes(buildNodeTree(flatten(doc(tree())), false), chart, SIZE);
    const planning = nodes.find((node) => node.row?.name === "Planning")!;
    const scope = nodes.find((node) => node.row?.name === "Scope")!;
    expect(scope.y - planning.y).toBe(SIZE.h + chart.levelGap);
  });

  it("never overlaps two siblings", () => {
    const chart = defaultChart();
    const nodes = layoutNodes(buildNodeTree(flatten(doc(tree())), true), chart, SIZE);
    const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (a.y !== b.y) continue;
      expect(b.x - a.x).toBeGreaterThanOrEqual(SIZE.w);
    }
  });

  it("swaps the axes when the tree grows to the right", () => {
    const chart = { ...defaultChart(), orientation: "right" as const };
    const nodes = layoutNodes(buildNodeTree(flatten(doc(tree())), false), chart, SIZE);
    const planning = nodes.find((node) => node.row?.name === "Planning")!;
    const scope = nodes.find((node) => node.row?.name === "Scope")!;
    expect(scope.x - planning.x).toBe(SIZE.w + chart.levelGap);
    expect(scope.y).not.toBe(planning.y);
  });

  it("gives every node its own row when stacked", () => {
    const chart = { ...defaultChart(), orientation: "stacked" as const };
    const nodes = layoutNodes(buildNodeTree(flatten(doc(tree())), false), chart, SIZE);
    expect(new Set(nodes.map((node) => node.y)).size).toBe(nodes.length);
    const planning = nodes.find((node) => node.row?.name === "Planning")!;
    const scope = nodes.find((node) => node.row?.name === "Scope")!;
    expect(scope.x).toBeGreaterThan(planning.x);
  });

  it("centres the project node over its branches", () => {
    const chart = defaultChart();
    const nodes = layoutNodes(buildNodeTree(flatten(doc(tree())), true), chart, SIZE);
    const root = nodes.find((node) => node.id === ROOT_ID)!;
    const branches = nodes.filter((node) => node.depth === 1);
    expect(root.x).toBe((branches[0].x + branches[branches.length - 1].x) / 2);
    expect(root.y).toBeLessThan(branches[0].y);
  });

  it("keeps a node that was dragged somewhere by hand", () => {
    const rows = flatten(doc(tree()));
    const dragged = rows[1].id;
    const chart = { ...defaultChart(), positions: { [dragged]: { x: 999, y: 555 } } };
    const nodes = layoutNodes(buildNodeTree(rows, false), chart, SIZE);
    const moved = nodes.find((node) => node.id === dragged)!;
    expect([moved.x, moved.y]).toEqual([999, 555]);
  });

  it("grows the card when extra columns are shown", () => {
    const chart = defaultChart();
    expect(cardHeight(chart, 0)).toBe(chart.nodeHeight);
    expect(cardHeight(chart, 2)).toBeGreaterThan(chart.nodeHeight);
  });
});

describe("connectors", () => {
  it("drops out of the bottom of a card in a top-down tree", () => {
    expect(portsFor("down")).toEqual({ from: "bottom", to: "top" });
  });

  it("leaves the side of a card when the tree grows to the right", () => {
    expect(portsFor("right")).toEqual({ from: "right", to: "left" });
  });

  it("brackets into the side of a card when indented", () => {
    expect(portsFor("stacked")).toEqual({ from: "bottom", to: "left" });
  });

  it("gives every link the ports its orientation asks for", () => {
    const d = doc(tree(), { orientation: "right", showRoot: false });
    const result = wbsToDiagram(d, flatten(d));
    expect(result.diagram.connectors.every((edge) => edge.fromPort === "right")).toBe(true);
    expect(result.diagram.connectors.every((edge) => edge.toPort === "left")).toBe(true);
  });
});

describe("cards", () => {
  it("prints the WBS code with the name", () => {
    const d = doc(tree());
    const row = flatten(d)[1];
    expect(nodeLabel(row, d, [])).toBe("1.1  Scope");
  });

  it("leaves the code off when it is switched off", () => {
    const d = doc(tree(), { showCode: false });
    expect(nodeLabel(flatten(d)[1], d, [])).toBe("Scope");
  });

  it("adds a line for each chosen column", () => {
    const d = doc(tree(), { showFields: ["cost"] });
    const cost = d.fields.find((field) => field.id === "cost")!;
    expect(nodeLabel(flatten(d)[1], d, [cost])).toBe("1.1  Scope\nCost: $100.00");
  });

  it("names an untitled task rather than drawing an empty card", () => {
    const d = doc([newTask("")], { showCode: false });
    expect(nodeLabel(flatten(d)[0], d, [])).toBe("Untitled task");
  });
});

describe("the diagram", () => {
  it("makes one shape per visible task, plus the project node", () => {
    const result = wbsToDiagram(doc(tree()), flatten(doc(tree())));
    expect(result.diagram.shapes).toHaveLength(5);
    expect(result.diagram.shapes[0].id).toBe(ROOT_ID);
  });

  it("joins every child to its parent", () => {
    const d = doc(tree(), { showRoot: false });
    const result = wbsToDiagram(d, flatten(d));
    expect(result.diagram.connectors).toHaveLength(2);
    const planning = result.nodes.find((node) => node.row?.name === "Planning")!;
    expect(result.diagram.connectors.every((edge) => edge.from === planning.id)).toBe(true);
  });

  it("colours by level, so a whole tier matches", () => {
    const d = doc(tree(), { showRoot: false, colourBy: "level" });
    const result = wbsToDiagram(d, flatten(d));
    const [planning, scope, budget] = result.diagram.shapes;
    expect(scope.fill).toBe(budget.fill);
    expect(scope.fill).not.toBe(planning.fill);
  });

  it("colours by branch, so a whole subtree matches", () => {
    const d = doc(tree(), { showRoot: false, colourBy: "branch" });
    const result = wbsToDiagram(d, flatten(d));
    const byName = new Map(result.nodes.map((node) => [node.row?.name, node.id]));
    const fill = (name: string) =>
      result.diagram.shapes.find((shape) => shape.id === byName.get(name))!.fill;
    expect(fill("Scope")).toBe(fill("Planning"));
    expect(fill("Delivery")).not.toBe(fill("Planning"));
  });

  it("colours by a choice column's value", () => {
    const d = doc(tree(), { showRoot: false, colourBy: "field", colourFieldId: "status" });
    const result = wbsToDiagram(d, flatten(d));
    const byName = new Map(result.nodes.map((node) => [node.row?.name, node.id]));
    const shape = (name: string) =>
      result.diagram.shapes.find((entry) => entry.id === byName.get(name))!;
    expect(shape("Scope").fill).not.toBe(shape("Budget").fill);
  });

  it("uses one colour for everything when colouring is off", () => {
    const d = doc(tree(), { showRoot: false, colourBy: "flat" });
    const fills = new Set(wbsToDiagram(d, flatten(d)).diagram.shapes.map((shape) => shape.fill));
    expect(fills.size).toBe(1);
  });

  it("lets a task override its own colour and shape", () => {
    const tasks = tree();
    tasks[1] = { ...tasks[1], style: { fill: "#123456", shape: "hexagon" } };
    const d = doc(tasks, { showRoot: false });
    const result = wbsToDiagram(d, flatten(d));
    const delivery = result.diagram.shapes.find((shape) => shape.fill === "#123456")!;
    expect(delivery.kind).toBe("hexagon");
  });

  it("emboldens summary tasks and the project node", () => {
    const d = doc(tree());
    const result = wbsToDiagram(d, flatten(d));
    const byId = new Map(result.diagram.shapes.map((shape) => [shape.id, shape]));
    expect(byId.get(ROOT_ID)!.bold).toBe(true);
    const scope = result.nodes.find((node) => node.row?.name === "Scope")!;
    expect(byId.get(scope.id)!.bold).toBe(false);
  });

  it("takes its background and line colour from the palette", () => {
    const d = doc(tree(), { palette: "warm" });
    const result = wbsToDiagram(d, flatten(d));
    expect(result.diagram.background).toBe(paletteFor("warm").background);
    expect(result.diagram.connectors[0].stroke).toBe(paletteFor("warm").line);
  });

  it("names the project node after the project", () => {
    const d = doc(tree());
    const result = wbsToDiagram(d, flatten(d));
    expect(result.diagram.shapes[0].text).toBe("Harbour");
  });

  it("offers palettes that all have swatches", () => {
    for (const palette of PALETTES) {
      expect(palette.swatches.length).toBeGreaterThan(0);
    }
  });
});

describe("exporting the chart", () => {
  it("renders to an SVG carrying the task names", () => {
    const d = doc(tree());
    const svg = toSvg(wbsToDiagram(d, flatten(d)).diagram);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Planning");
    expect(svg).toContain("Harbour");
  });

  it("draws a line for every parent-child link", () => {
    const d = doc(tree(), { showRoot: false });
    const svg = toSvg(wbsToDiagram(d, flatten(d)).diagram);
    expect(svg.match(/<path/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("hand-placed cards", () => {
  it("forgets the position of a task that has been deleted", () => {
    const tasks = tree();
    const positions = {
      [tasks[0].id]: { x: 10, y: 10 },
      [tasks[1].id]: { x: 20, y: 20 },
      [ROOT_ID]: { x: 0, y: 0 },
    };
    const kept = prunePositions([tasks[0]], positions);
    expect(Object.keys(kept).sort()).toEqual([ROOT_ID, tasks[0].id].sort());
  });

  it("keeps the project node's own position", () => {
    const positions = { [ROOT_ID]: { x: 5, y: 5 } };
    expect(prunePositions(tree(), positions)).toBe(positions);
  });

  it("returns the same object when every position is still in use", () => {
    const tasks = tree();
    const positions = { [tasks[0].id]: { x: 1, y: 2 } };
    expect(prunePositions(tasks, positions)).toBe(positions);
  });

  it("does nothing when nothing has been placed", () => {
    const positions = {};
    expect(prunePositions(tree(), positions)).toBe(positions);
  });
});

describe("the handoff to the diagram maker", () => {
  it("writes a file that the diagram maker reads back unchanged", () => {
    const d = doc(tree());
    const { diagram } = wbsToDiagram(d, flatten(d));
    const reopened = parseDiagramFile(toFile(diagram));

    expect(reopened.shapes).toHaveLength(diagram.shapes.length);
    expect(reopened.connectors).toHaveLength(diagram.connectors.length);
    expect(reopened.shapes.map((shape) => shape.text)).toEqual(
      diagram.shapes.map((shape) => shape.text),
    );
    expect(reopened.shapes[0].fill).toBe(diagram.shapes[0].fill);
    expect(reopened.name).toBe("Harbour");
  });

  it("keeps hand-placed cards where they were put", () => {
    const tasks = tree();
    const moved = flatten(doc(tasks))[0];
    const d = doc(tasks, { positions: { [moved.id]: { x: 400, y: 120 } } });
    const { diagram } = wbsToDiagram(d, flatten(d));
    const reopened = parseDiagramFile(toFile(diagram));
    const shape = reopened.shapes.find((entry) => entry.id === moved.id)!;
    expect([shape.x, shape.y]).toEqual([400, 120]);
  });
});
