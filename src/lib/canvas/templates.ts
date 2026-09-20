/**
 * Starting points.
 *
 * A blank canvas is the reason most people abandon a drawing tool, so every
 * template is a finished, editable example rather than a skeleton. The
 * diagram ones are defined once in `@/lib/diagram/templates` — the
 * work-breakdown chart draws from the same library — and are converted to
 * elements here, so a flowchart you start from is the same flowchart
 * everywhere it appears.
 */
import { TEMPLATES as DIAGRAM_TEMPLATES } from "@/lib/diagram/templates";
import { boardFromDiagram } from "./convert";
import { createNode, emptyBoard, newId, type Board, type Element } from "./model";

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  build: () => Board;
}

/** The diagram templates, minus the blank one the toolbar offers separately. */
const FROM_DIAGRAMS: Template[] = DIAGRAM_TEMPLATES.filter((t) => t.id !== "blank").map(
  (template) => ({
    id: template.id,
    name: template.name,
    icon: template.icon,
    description: template.description,
    build: () => boardFromDiagram(template.build()),
  }),
);

/** A wall of sticky notes, which is what a blank board is usually first used for. */
function stickies(): Board {
  const colors = ["#fff8dd", "#e6f7fe", "#eefbe9", "#f6ecff"];
  const headings = ["Keep", "Stop", "Start", "Questions"];
  const elements: Element[] = headings.flatMap((heading, column) => {
    const x = 60 + column * 210;
    const title: Element = {
      id: newId("t"),
      type: "text",
      x,
      y: 50,
      w: 180,
      h: 34,
      text: heading,
      color: "#22303c",
      size: 26,
      bold: true,
    };
    const note = createNode("note", x, 100, {
      fill: colors[column],
      stroke: "transparent",
      strokeWidth: 0,
      text: "",
    });
    note.w = 180;
    note.h = 160;
    return [title, note];
  });

  return { ...emptyBoard("Retro board"), paper: "dots", elements };
}

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank canvas",
    icon: "⬜",
    description: "Start from nothing",
    build: () => emptyBoard(),
  },
  ...FROM_DIAGRAMS,
  {
    id: "retro",
    name: "Retro board",
    icon: "🗒",
    description: "Four columns of sticky notes",
    build: stickies,
  },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
