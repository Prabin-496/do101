import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { CanvasTool } from "@/components/tools/canvas/CanvasTool";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { TEMPLATES } from "@/lib/canvas/templates";

const tool = getTool("canvas")!;
export const metadata: Metadata = toolMetadata(tool);

const SHORTCUTS: [string, string][] = [
  ["P / H / E", "Pen, highlighter, eraser"],
  ["L / A", "Line and arrow that float free"],
  ["R / O / D", "Rounded box, ellipse, decision"],
  ["T / N", "Text and sticky note"],
  ["X", "Laser pointer"],
  ["V", "Back to selecting"],
  ["Click a blue arrow", "Add the next shape, already joined"],
  ["Drag a blue arrow", "Link to another shape"],
  ["Double-click", "Type in a shape, or label a connector"],
  ["Enter", "Edit the selected thing"],
  ["⌘/Ctrl + V", "Paste a screenshot onto the canvas"],
  ["⌘/Ctrl + Z", "Undo, and ⇧ to redo"],
  ["⌘/Ctrl + D", "Duplicate the selection"],
  ["Shift + drag", "Straight lines, squares and circles"],
  ["Arrow keys", "Nudge by 1px, or 10 with ⇧"],
  ["Space or ⌘/Ctrl + drag", "Pan the canvas"],
  ["⌘/Ctrl + scroll", "Zoom about the pointer"],
];

const USES: [string, string][] = [
  ["Explaining on a call", "Share your screen, draw as you talk and point with the laser."],
  ["Mapping out a process", "Real flowchart shapes with connectors that follow them about."],
  ["Marking up a screenshot", "Paste it in, then circle the bit that matters and add an arrow."],
  ["Thinking something through", "Sticky notes and rough shapes, before it deserves a tidy diagram."],
  ["Teaching a step at a time", "One board per step, then download them all as numbered PNGs."],
  ["Sketching a system", "Boxes, a database, arrows — then scribble the bit you are unsure about."],
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Productivity", href: "/tools?category=productivity" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell
        tool={tool}
        wide
        extraContent={
          <>
            <section aria-labelledby="uses-heading">
              <h2 id="uses-heading" className="mb-3 text-xl sm:text-2xl">
                What people use it for
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {USES.map(([title, what]) => (
                  <li key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">{title}</p>
                    <p className="text-xs font-semibold text-[var(--muted)]">{what}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="templates-heading">
              <h2 id="templates-heading" className="mb-3 text-xl sm:text-2xl">
                What you can start from
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {TEMPLATES.filter((t) => t.id !== "blank").map((template) => (
                  <li key={template.id} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">
                      <span aria-hidden>{template.icon}</span> {template.name}
                    </p>
                    <p className="text-xs font-semibold text-[var(--muted)]">{template.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="shortcuts-heading">
              <h2 id="shortcuts-heading" className="mb-3 text-xl sm:text-2xl">
                Shortcuts worth knowing
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {SHORTCUTS.map(([keys, what]) => (
                  <li
                    key={keys}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--panel)] px-4 py-3"
                  >
                    <span className="text-xs font-extrabold">{keys}</span>
                    <span className="text-right text-xs font-semibold text-[var(--muted)]">{what}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        }
      >
        <CanvasTool />
      </ToolShell>
    </>
  );
}
