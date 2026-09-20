/**
 * Starting points.
 *
 * A blank canvas is the reason most people abandon a diagram tool, so every
 * template is a finished, editable example rather than a skeleton.
 */
import {
  createConnector,
  createShape,
  emptyDiagram,
  type Connector,
  type Diagram,
  type Shape,
  type ShapeKind,
} from "./model";

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  build: () => Diagram;
}

const PALETTE = {
  sky: { fill: "#e6f7fe", stroke: "#22b8f0" },
  grass: { fill: "#eefbe9", stroke: "#4cc93f" },
  grape: { fill: "#f6ecff", stroke: "#b45cff" },
  sun: { fill: "#fff8dd", stroke: "#ffc800" },
  fire: { fill: "#fff3e3", stroke: "#ff8a00" },
  cherry: { fill: "#ffecec", stroke: "#ff4b4b" },
} as const;

type Tone = keyof typeof PALETTE;

interface Spec {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  text: string;
  tone?: Tone;
  w?: number;
  h?: number;
}

type Link = [from: string, to: string, label?: string, patch?: Partial<Connector>];

/** Builds a diagram from a compact spec, keeping each template readable. */
function build(name: string, specs: Spec[], links: Link[]): Diagram {
  const ids = new Map<string, string>();
  const shapes: Shape[] = specs.map((spec) => {
    const tone = PALETTE[spec.tone ?? "sky"];
    const shape = createShape(spec.kind, spec.x, spec.y, {
      text: spec.text,
      fill: tone.fill,
      stroke: spec.kind === "text" ? "transparent" : tone.stroke,
    });
    if (spec.w) shape.w = spec.w;
    if (spec.h) shape.h = spec.h;
    ids.set(spec.id, shape.id);
    return shape;
  });

  const connectors: Connector[] = links.flatMap(([from, to, label, patch]) => {
    const a = ids.get(from);
    const b = ids.get(to);
    if (!a || !b) return [];
    return [createConnector(a, b, { label: label ?? "", ...patch })];
  });

  return { ...emptyDiagram(name), shapes, connectors };
}

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank canvas",
    icon: "⬜",
    description: "Start from nothing",
    build: () => emptyDiagram(),
  },
  {
    id: "flowchart",
    name: "Flowchart",
    icon: "🔀",
    description: "A decision with two branches",
    build: () =>
      build(
        "Flowchart",
        [
          { id: "start", kind: "ellipse", x: 300, y: 60, text: "Start", tone: "grass" },
          { id: "step", kind: "rounded", x: 295, y: 190, text: "Do the thing" },
          { id: "check", kind: "diamond", x: 295, y: 320, text: "Did it work?", tone: "sun" },
          { id: "yes", kind: "rounded", x: 100, y: 470, text: "Ship it", tone: "grass" },
          { id: "no", kind: "rounded", x: 490, y: 470, text: "Fix and retry", tone: "cherry" },
          { id: "end", kind: "ellipse", x: 300, y: 600, text: "End", tone: "grass" },
        ],
        [
          ["start", "step"],
          ["step", "check"],
          ["check", "yes", "yes"],
          ["check", "no", "no"],
          ["yes", "end"],
          ["no", "step", "", { fromPort: "top", toPort: "right" }],
        ],
      ),
  },
  {
    id: "org",
    name: "Org chart",
    icon: "🏢",
    description: "Who reports to whom",
    build: () =>
      build(
        "Org chart",
        [
          { id: "ceo", kind: "rounded", x: 320, y: 60, text: "Founder", tone: "grape" },
          { id: "eng", kind: "rounded", x: 100, y: 240, text: "Engineering" },
          { id: "design", kind: "rounded", x: 320, y: 240, text: "Design" },
          { id: "growth", kind: "rounded", x: 540, y: 240, text: "Growth" },
          { id: "fe", kind: "rectangle", x: 20, y: 400, text: "Frontend", tone: "grass" },
          { id: "be", kind: "rectangle", x: 190, y: 400, text: "Backend", tone: "grass" },
        ],
        [
          ["ceo", "eng"],
          ["ceo", "design"],
          ["ceo", "growth"],
          ["eng", "fe"],
          ["eng", "be"],
        ],
      ),
  },
  {
    id: "mindmap",
    name: "Mind map",
    icon: "🧠",
    description: "One idea, branching out",
    build: () =>
      build(
        "Mind map",
        [
          { id: "core", kind: "ellipse", x: 320, y: 280, text: "Big idea", tone: "grape", w: 160, h: 90 },
          { id: "a", kind: "rounded", x: 60, y: 120, text: "Why", tone: "sky" },
          { id: "b", kind: "rounded", x: 620, y: 120, text: "Who for", tone: "grass" },
          { id: "c", kind: "rounded", x: 60, y: 460, text: "How", tone: "fire" },
          { id: "d", kind: "rounded", x: 620, y: 460, text: "Risks", tone: "cherry" },
        ],
        [
          ["core", "a"],
          ["core", "b"],
          ["core", "c"],
          ["core", "d"],
        ],
      ),
  },
  {
    id: "architecture",
    name: "System design",
    icon: "🗄️",
    description: "Client, server and a database",
    build: () =>
      build(
        "System design",
        [
          { id: "user", kind: "ellipse", x: 60, y: 200, text: "Browser", tone: "sun" },
          { id: "cdn", kind: "rounded", x: 260, y: 200, text: "CDN / edge" },
          { id: "api", kind: "rounded", x: 470, y: 200, text: "API server", tone: "grape" },
          { id: "db", kind: "cylinder", x: 690, y: 190, text: "Database", tone: "grass" },
          { id: "cache", kind: "cylinder", x: 470, y: 380, text: "Cache", tone: "fire", w: 150 },
        ],
        [
          ["user", "cdn", "HTTPS"],
          ["cdn", "api"],
          ["api", "db", "SQL"],
          ["api", "cache"],
        ],
      ),
  },
  {
    id: "swimlane",
    name: "Process lanes",
    icon: "🏊",
    description: "Steps split across two teams",
    build: () =>
      build(
        "Process lanes",
        [
          { id: "lane1", kind: "text", x: 40, y: 80, text: "Sales", w: 120, h: 40 },
          { id: "lane2", kind: "text", x: 40, y: 300, text: "Delivery", w: 120, h: 40 },
          { id: "s1", kind: "rounded", x: 200, y: 60, text: "Lead arrives", tone: "sky" },
          { id: "s2", kind: "rounded", x: 420, y: 60, text: "Quote sent", tone: "sky" },
          { id: "s3", kind: "diamond", x: 640, y: 50, text: "Accepted?", tone: "sun" },
          { id: "d1", kind: "rounded", x: 420, y: 280, text: "Kick off", tone: "grass" },
          { id: "d2", kind: "rounded", x: 640, y: 280, text: "Hand over", tone: "grass" },
        ],
        [
          ["s1", "s2"],
          ["s2", "s3"],
          ["s3", "d1", "yes"],
          ["d1", "d2"],
        ],
      ),
  },
  {
    id: "network",
    name: "Network",
    icon: "🌐",
    description: "A small office network",
    build: () =>
      build(
        "Network",
        [
          { id: "net", kind: "ellipse", x: 320, y: 40, text: "Internet", tone: "sky" },
          { id: "fw", kind: "hexagon", x: 320, y: 190, text: "Firewall", tone: "cherry" },
          { id: "sw", kind: "rounded", x: 320, y: 330, text: "Switch", tone: "grape" },
          { id: "pc1", kind: "rectangle", x: 110, y: 480, text: "Desk 1", tone: "grass" },
          { id: "pc2", kind: "rectangle", x: 320, y: 480, text: "Desk 2", tone: "grass" },
          { id: "nas", kind: "cylinder", x: 530, y: 470, text: "NAS", tone: "fire" },
        ],
        [
          ["net", "fw"],
          ["fw", "sw"],
          ["sw", "pc1"],
          ["sw", "pc2"],
          ["sw", "nas"],
        ],
      ),
  },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
