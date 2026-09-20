"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Slider, Toggle } from "@/components/ui/Field";
import { SHAPE_LIBRARY } from "@/lib/diagram/model";
import {
  clampNode,
  type Board,
  type Dash,
  type Element,
  type PortOrAuto,
  type Routing,
  type ShapeKind,
  type Tool,
} from "@/lib/canvas/model";
import { isNodeTool } from "./CanvasPalette";
import {
  FILL_COLORS,
  HIGHLIGHTER_WIDTHS,
  INK_COLORS,
  NOTE_COLORS,
  PAPER_COLORS,
  PEN_WIDTHS,
  STROKE_COLORS,
  TEXT_SIZES,
  type Styles,
} from "./styles";
import { cn } from "@/lib/utils/cn";

/** Free text does the job the diagram library's "text" shape was for. */
const KINDS = SHAPE_LIBRARY.filter((item) => item.kind !== "text");

const DASH_OPTIONS: [Dash, string][] = [
  ["solid", "Solid"],
  ["dashed", "Dashed"],
  ["dotted", "Dotted"],
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">{title}</h3>
      {children}
    </section>
  );
}

function Swatches({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            title={color === "transparent" ? "None" : color}
            aria-label={`${label}: ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={cn(
              "h-7 w-7 rounded-lg border-2 transition-transform",
              value === color ? "scale-110 border-[var(--sky)]" : "border-[var(--border)]",
              color === "transparent" &&
                "bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%),linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]",
            )}
            style={color === "transparent" ? undefined : { background: color }}
          />
        ))}
        <label className="ml-1 flex h-7 cursor-pointer items-center gap-1 rounded-lg border-2 border-[var(--border)] px-2 text-[11px] font-extrabold text-[var(--muted)]">
          <input
            type="color"
            value={value === "transparent" ? "#ffffff" : value}
            onChange={(e) => onChange(e.target.value)}
            className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
            aria-label={`Custom ${label.toLowerCase()}`}
          />
          Custom
        </label>
      </div>
    </div>
  );
}

function Widths({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (width: number) => void;
}) {
  return (
    <div>
      <Label hint={`${Math.round(value)}px`}>{label}</Label>
      <div className="flex items-center gap-2">
        {options.map((width) => (
          <button
            key={width}
            type="button"
            aria-label={`${label} ${width}px`}
            aria-pressed={value === width}
            onClick={() => onChange(width)}
            className={cn(
              "grid h-9 flex-1 place-items-center rounded-xl border-2 transition-colors",
              value === width
                ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                : "border-[var(--border)] hover:bg-[var(--panel)]",
            )}
          >
            <span
              className="block rounded-full bg-[var(--ink)]"
              style={{ width: Math.min(24, width + 6), height: Math.max(2, Math.min(12, width / 2)) }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function DashPicker({ value, onChange }: { value: Dash; onChange: (dash: Dash) => void }) {
  return (
    <div>
      <Label>Line style</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value as Dash)}>
        {DASH_OPTIONS.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </Select>
    </div>
  );
}

export interface InspectorProps {
  board: Board;
  docName: string;
  selection: Element[];
  tool: Tool;
  styles: Styles;
  onStyles: (next: Styles) => void;
  /** Applies a change to every selected element as one undo step. */
  onPatch: (change: (el: Element) => Element) => void;
  onReorder: (to: "front" | "forward" | "backward" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditText: (id: string) => void;
  onBoard: (patch: Partial<Board>) => void;
  onDocName: (name: string) => void;
}

export function CanvasInspector(props: InspectorProps) {
  const { board, docName, selection, tool, styles, onStyles, onBoard, onDocName } = props;

  if (selection.length) return <SelectionPanels {...props} />;

  return (
    <div className="space-y-3">
      <ToolDefaults tool={tool} styles={styles} onStyles={onStyles} />
      <ConnectorDefaults styles={styles} onStyles={onStyles} />
      <PaperPanel board={board} docName={docName} onBoard={onBoard} onDocName={onDocName} />
    </div>
  );
}

/* ------------------------------ the selection ------------------------------ */

function SelectionPanels({
  selection,
  onPatch,
  onReorder,
  onDuplicate,
  onDelete,
  onEditText,
  board,
  docName,
  onBoard,
  onDocName,
}: InspectorProps) {
  const nodes = selection.filter((el) => el.type === "node");
  const edges = selection.filter((el) => el.type === "edge");
  const strokes = selection.filter((el) => el.type === "stroke");
  const lines = selection.filter((el) => el.type === "line");
  const texts = selection.filter((el) => el.type === "text");

  const node = nodes[0];
  const edge = edges[0];
  const stroke = strokes[0];
  const line = lines[0];
  const text = texts[0];
  const single = selection.length === 1 ? selection[0] : null;

  const title =
    selection.length === 1
      ? single!.type === "node"
        ? `Shape — ${single!.kind}`
        : single!.type === "edge"
          ? "Connector"
          : `Selected ${single!.type}`
      : `${selection.length} things selected`;

  return (
    <div className="space-y-3">
      <Panel title={title}>
        {single && single.type === "node" ? (
          <>
            <div>
              <Label hint="or double-click it">Label</Label>
              <Input
                value={single.text}
                placeholder="Type a label…"
                onChange={(e) => onPatch((el) => ({ ...el, text: e.target.value }) as Element)}
              />
            </div>
            <div>
              <Label>Shape</Label>
              <Select
                value={single.kind}
                onChange={(e) =>
                  onPatch((el) => ({ ...el, kind: e.target.value as ShapeKind }) as Element)
                }
              >
                {KINDS.map((item) => (
                  <option key={item.kind} value={item.kind}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Width</Label>
                <Input
                  type="number"
                  value={Math.round(single.w)}
                  min={24}
                  onChange={(e) =>
                    onPatch((el) => ({ ...el, w: clampNode(Number(e.target.value) || 24) }) as Element)
                  }
                />
              </div>
              <div>
                <Label>Height</Label>
                <Input
                  type="number"
                  value={Math.round(single.h)}
                  min={24}
                  onChange={(e) =>
                    onPatch((el) => ({ ...el, h: clampNode(Number(e.target.value) || 24) }) as Element)
                  }
                />
              </div>
            </div>
          </>
        ) : null}

        {single && single.type === "edge" ? (
          <div>
            <Label hint="or double-click it">Label</Label>
            <Input
              value={single.label}
              placeholder="yes / no / sends…"
              onChange={(e) => onPatch((el) => ({ ...el, label: e.target.value }) as Element)}
            />
          </div>
        ) : null}

        {selection.length > 1 ? (
          <p className="text-sm font-semibold text-[var(--muted)]">
            Styling applies to everything selected that has it.
          </p>
        ) : null}

        {node ? (
          <>
            <Swatches
              label="Fill"
              value={node.fill}
              options={FILL_COLORS}
              onChange={(fill) => onPatch((el) => (el.type === "node" ? { ...el, fill } : el))}
            />
            <Swatches
              label="Border"
              value={node.stroke}
              options={STROKE_COLORS}
              onChange={(stroke) => onPatch((el) => (el.type === "node" ? { ...el, stroke } : el))}
            />
            <div>
              <Label hint={`${node.strokeWidth}px`}>Border width</Label>
              <Slider
                min={0}
                max={10}
                step={1}
                value={node.strokeWidth}
                onChange={(e) =>
                  onPatch((el) =>
                    el.type === "node" ? { ...el, strokeWidth: Number(e.target.value) } : el,
                  )
                }
              />
            </div>
          </>
        ) : null}

        {stroke ? (
          <>
            <Swatches
              label="Ink"
              value={stroke.color}
              options={INK_COLORS}
              onChange={(color) => onPatch((el) => (el.type === "stroke" ? { ...el, color } : el))}
            />
            <Widths
              label="Nib"
              value={stroke.width}
              options={stroke.kind === "highlighter" ? HIGHLIGHTER_WIDTHS : PEN_WIDTHS}
              onChange={(width) => onPatch((el) => (el.type === "stroke" ? { ...el, width } : el))}
            />
          </>
        ) : null}

        {line ? (
          <>
            <Swatches
              label="Line colour"
              value={line.color}
              options={INK_COLORS}
              onChange={(color) => onPatch((el) => (el.type === "line" ? { ...el, color } : el))}
            />
            <Widths
              label="Thickness"
              value={line.width}
              options={PEN_WIDTHS}
              onChange={(width) => onPatch((el) => (el.type === "line" ? { ...el, width } : el))}
            />
          </>
        ) : null}

        {node || line || edge ? (
          <DashPicker
            value={node?.dash ?? line?.dash ?? edge!.dash}
            onChange={(dash) =>
              onPatch((el) =>
                el.type === "node" || el.type === "line" || el.type === "edge"
                  ? { ...el, dash }
                  : el,
              )
            }
          />
        ) : null}
      </Panel>

      {edge ? (
        <Panel title={edges.length === 1 ? "Connector" : `${edges.length} connectors`}>
          <div>
            <Label>Route</Label>
            <Select
              value={edge.routing}
              onChange={(e) =>
                onPatch((el) =>
                  el.type === "edge" ? { ...el, routing: e.target.value as Routing } : el,
                )
              }
            >
              <option value="orthogonal">Right angles</option>
              <option value="straight">Straight</option>
              <option value="curved">Curved</option>
            </Select>
          </div>
          <Swatches
            label="Colour"
            value={edge.stroke}
            options={STROKE_COLORS}
            onChange={(stroke) => onPatch((el) => (el.type === "edge" ? { ...el, stroke } : el))}
          />
          <div>
            <Label hint={`${edge.strokeWidth}px`}>Thickness</Label>
            <Slider
              min={1}
              max={10}
              step={1}
              value={edge.strokeWidth}
              onChange={(e) =>
                onPatch((el) =>
                  el.type === "edge" ? { ...el, strokeWidth: Number(e.target.value) } : el,
                )
              }
            />
          </div>
          <Toggle
            checked={edge.startArrow}
            onChange={(startArrow) =>
              onPatch((el) => (el.type === "edge" ? { ...el, startArrow } : el))
            }
            label="Arrow at the start"
          />
          <Toggle
            checked={edge.endArrow}
            onChange={(endArrow) => onPatch((el) => (el.type === "edge" ? { ...el, endArrow } : el))}
            label="Arrow at the end"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Leaves from</Label>
              <Select
                value={edge.fromPort}
                onChange={(e) =>
                  onPatch((el) =>
                    el.type === "edge" ? { ...el, fromPort: e.target.value as PortOrAuto } : el,
                  )
                }
              >
                <option value="auto">Automatic</option>
                <option value="top">Top</option>
                <option value="right">Right</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
              </Select>
            </div>
            <div>
              <Label>Arrives at</Label>
              <Select
                value={edge.toPort}
                onChange={(e) =>
                  onPatch((el) =>
                    el.type === "edge" ? { ...el, toPort: e.target.value as PortOrAuto } : el,
                  )
                }
              >
                <option value="auto">Automatic</option>
                <option value="top">Top</option>
                <option value="right">Right</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
              </Select>
            </div>
          </div>
        </Panel>
      ) : null}

      {line ? (
        <Panel title="Arrow ends">
          <Toggle
            checked={line.arrowStart}
            onChange={(arrowStart) =>
              onPatch((el) => (el.type === "line" ? { ...el, arrowStart } : el))
            }
            label="Head at the start"
          />
          <Toggle
            checked={line.arrowEnd}
            onChange={(arrowEnd) => onPatch((el) => (el.type === "line" ? { ...el, arrowEnd } : el))}
            label="Head at the end"
          />
        </Panel>
      ) : null}

      {node || text ? (
        <Panel title="Text">
          {node && node.kind === "note" ? (
            <Swatches
              label="Paper"
              value={node.fill}
              options={NOTE_COLORS}
              onChange={(fill) => onPatch((el) => (el.type === "node" ? { ...el, fill } : el))}
            />
          ) : null}
          <div>
            <Label hint={`${Math.round(node?.fontSize ?? text!.size)}px`}>Size</Label>
            <Slider
              min={8}
              max={96}
              step={1}
              value={node?.fontSize ?? text!.size}
              onChange={(e) => {
                const size = Number(e.target.value);
                onPatch((el) =>
                  el.type === "node"
                    ? { ...el, fontSize: size }
                    : el.type === "text"
                      ? { ...el, size }
                      : el,
                );
              }}
            />
          </div>
          <Swatches
            label="Colour"
            value={node?.textColor ?? text!.color}
            options={INK_COLORS}
            onChange={(color) =>
              onPatch((el) =>
                el.type === "node"
                  ? { ...el, textColor: color }
                  : el.type === "text"
                    ? { ...el, color }
                    : el,
              )
            }
          />
          <Toggle
            checked={node?.bold ?? text!.bold}
            onChange={(bold) =>
              onPatch((el) => (el.type === "node" || el.type === "text" ? { ...el, bold } : el))
            }
            label="Bold"
          />
          {single && (single.type === "node" || single.type === "text") ? (
            <Button tone="panel" size="sm" className="w-full" onClick={() => onEditText(single.id)}>
              Edit the text
            </Button>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Arrange">
        <div className="grid grid-cols-2 gap-2">
          <Button tone="panel" size="sm" onClick={() => onReorder("front")}>
            To front
          </Button>
          <Button tone="panel" size="sm" onClick={() => onReorder("back")}>
            To back
          </Button>
          <Button tone="panel" size="sm" onClick={() => onReorder("forward")}>
            Forward
          </Button>
          <Button tone="panel" size="sm" onClick={() => onReorder("backward")}>
            Backward
          </Button>
          <Button tone="panel" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button tone="cherry" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
        {node ? (
          <p className="text-[11px] font-semibold text-[var(--muted)]">
            Connectors always pass under the shapes they join, whatever the layer order.
          </p>
        ) : null}
      </Panel>

      <PaperPanel board={board} docName={docName} onBoard={onBoard} onDocName={onDocName} />
    </div>
  );
}

/* ----------------------------- the tool defaults ---------------------------- */

function ToolDefaults({
  tool,
  styles,
  onStyles,
}: {
  tool: Tool;
  styles: Styles;
  onStyles: (next: Styles) => void;
}) {
  const set = <K extends keyof Styles>(key: K, value: Styles[K]) =>
    onStyles({ ...styles, [key]: value });

  if (isNodeTool(tool)) {
    const note = tool.node === "note";
    return (
      <Panel title={note ? "New sticky notes" : "New shapes"}>
        {note ? (
          <>
            <Swatches
              label="Paper"
              value={styles.note.fill}
              options={NOTE_COLORS}
              onChange={(fill) => set("note", { ...styles.note, fill })}
            />
            <Swatches
              label="Writing"
              value={styles.note.textColor}
              options={INK_COLORS}
              onChange={(textColor) => set("note", { ...styles.note, textColor })}
            />
            <div>
              <Label hint={`${styles.note.fontSize}px`}>Size</Label>
              <Slider
                min={10}
                max={40}
                step={1}
                value={styles.note.fontSize}
                onChange={(e) => set("note", { ...styles.note, fontSize: Number(e.target.value) })}
              />
            </div>
          </>
        ) : (
          <>
            <Swatches
              label="Fill"
              value={styles.node.fill}
              options={FILL_COLORS}
              onChange={(fill) => set("node", { ...styles.node, fill })}
            />
            <Swatches
              label="Border"
              value={styles.node.stroke}
              options={STROKE_COLORS}
              onChange={(stroke) => set("node", { ...styles.node, stroke })}
            />
            <div>
              <Label hint={`${styles.node.strokeWidth}px`}>Border width</Label>
              <Slider
                min={0}
                max={10}
                step={1}
                value={styles.node.strokeWidth}
                onChange={(e) => set("node", { ...styles.node, strokeWidth: Number(e.target.value) })}
              />
            </div>
            <DashPicker value={styles.node.dash} onChange={(dash) => set("node", { ...styles.node, dash })} />
            <div>
              <Label hint={`${styles.node.fontSize}px`}>Label size</Label>
              <Slider
                min={8}
                max={48}
                step={1}
                value={styles.node.fontSize}
                onChange={(e) => set("node", { ...styles.node, fontSize: Number(e.target.value) })}
              />
            </div>
            <Swatches
              label="Label colour"
              value={styles.node.textColor}
              options={INK_COLORS}
              onChange={(textColor) => set("node", { ...styles.node, textColor })}
            />
            <Toggle
              checked={styles.node.bold}
              onChange={(bold) => set("node", { ...styles.node, bold })}
              label="Bold labels"
            />
          </>
        )}
        <p className="text-xs font-semibold text-[var(--muted)]">
          Click the canvas to drop one at its natural size, or drag to size it as you place it.
        </p>
      </Panel>
    );
  }

  switch (tool) {
    case "pen":
      return (
        <Panel title="Pen">
          <Swatches
            label="Ink"
            value={styles.pen.color}
            options={INK_COLORS}
            onChange={(color) => set("pen", { ...styles.pen, color })}
          />
          <Widths
            label="Nib"
            value={styles.pen.width}
            options={PEN_WIDTHS}
            onChange={(width) => set("pen", { ...styles.pen, width })}
          />
        </Panel>
      );

    case "highlighter":
      return (
        <Panel title="Highlighter">
          <Swatches
            label="Ink"
            value={styles.highlighter.color}
            options={INK_COLORS}
            onChange={(color) => set("highlighter", { ...styles.highlighter, color })}
          />
          <Widths
            label="Width"
            value={styles.highlighter.width}
            options={HIGHLIGHTER_WIDTHS}
            onChange={(width) => set("highlighter", { ...styles.highlighter, width })}
          />
          <p className="text-xs font-semibold text-[var(--muted)]">
            Highlighter ink always sits behind your drawing, so it never covers it.
          </p>
        </Panel>
      );

    case "eraser":
      return (
        <Panel title="Eraser">
          <div>
            <Label hint={`${styles.eraserSize}px`}>Size</Label>
            <Slider
              min={6}
              max={60}
              step={2}
              value={styles.eraserSize}
              onChange={(e) => set("eraserSize", Number(e.target.value))}
            />
          </div>
          <p className="text-xs font-semibold text-[var(--muted)]">
            Rubbing over a line removes the whole line, not a hole in the middle of it.
          </p>
        </Panel>
      );

    case "line":
    case "arrow":
      return (
        <Panel title={tool === "arrow" ? "Arrow" : "Line"}>
          <Swatches
            label="Colour"
            value={styles.line.color}
            options={INK_COLORS}
            onChange={(color) => set("line", { ...styles.line, color })}
          />
          <Widths
            label="Thickness"
            value={styles.line.width}
            options={PEN_WIDTHS}
            onChange={(width) => set("line", { ...styles.line, width })}
          />
          <DashPicker value={styles.line.dash} onChange={(dash) => set("line", { ...styles.line, dash })} />
          {tool === "arrow" ? (
            <>
              <Toggle
                checked={styles.line.arrowEnd}
                onChange={(arrowEnd) => set("line", { ...styles.line, arrowEnd })}
                label="Head at the end"
              />
              <Toggle
                checked={styles.line.arrowStart}
                onChange={(arrowStart) => set("line", { ...styles.line, arrowStart })}
                label="Head at the start"
              />
            </>
          ) : null}
          <p className="text-xs font-semibold text-[var(--muted)]">
            Hold Shift while dragging to snap to 45°. To join two shapes so the line follows them
            about, drag a blue arrow instead.
          </p>
        </Panel>
      );

    case "text":
      return (
        <Panel title="Text">
          <Swatches
            label="Colour"
            value={styles.text.color}
            options={INK_COLORS}
            onChange={(color) => set("text", { ...styles.text, color })}
          />
          <div>
            <Label hint={`${styles.text.size}px`}>Size</Label>
            <div className="flex gap-1.5">
              {TEXT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={styles.text.size === size}
                  onClick={() => set("text", { ...styles.text, size })}
                  className={cn(
                    "flex-1 rounded-xl border-2 py-1.5 text-xs font-extrabold transition-colors",
                    styles.text.size === size
                      ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                      : "border-[var(--border)]",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={styles.text.bold}
            onChange={(bold) => set("text", { ...styles.text, bold })}
            label="Bold"
          />
        </Panel>
      );

    case "laser":
      return (
        <Panel title="Laser pointer">
          <p className="text-xs font-semibold text-[var(--muted)]">
            Drag to point things out while you talk. The trail fades after a second and is never
            saved or exported — it is for the person watching, not for the board.
          </p>
        </Panel>
      );

    default:
      return (
        <Panel title="Select">
          <ul className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
            <li>Click anything to restyle it, or drag across the board to pick up several.</li>
            <li>Hover a shape and click a blue arrow to add the next one, already joined.</li>
            <li>Drag a blue arrow onto another shape to connect the two.</li>
            <li>Double-click a shape to label it, or a connector to name the branch.</li>
            <li>Pick a pen or a shape on the left to start adding things.</li>
          </ul>
        </Panel>
      );
  }
}

function ConnectorDefaults({
  styles,
  onStyles,
}: {
  styles: Styles;
  onStyles: (next: Styles) => void;
}) {
  const set = (patch: Partial<Styles["edge"]>) =>
    onStyles({ ...styles, edge: { ...styles.edge, ...patch } });

  return (
    <Panel title="New connectors">
      <div>
        <Label>Route</Label>
        <Select value={styles.edge.routing} onChange={(e) => set({ routing: e.target.value as Routing })}>
          <option value="orthogonal">Right angles</option>
          <option value="straight">Straight</option>
          <option value="curved">Curved</option>
        </Select>
      </div>
      <Swatches
        label="Colour"
        value={styles.edge.stroke}
        options={STROKE_COLORS}
        onChange={(stroke) => set({ stroke })}
      />
      <DashPicker value={styles.edge.dash} onChange={(dash) => set({ dash })} />
      <Toggle
        checked={styles.edge.endArrow}
        onChange={(endArrow) => set({ endArrow })}
        label="Arrow at the end"
      />
    </Panel>
  );
}

function PaperPanel({
  board,
  docName,
  onBoard,
  onDocName,
}: {
  board: Board;
  docName: string;
  onBoard: (patch: Partial<Board>) => void;
  onDocName: (name: string) => void;
}) {
  return (
    <Panel title="Paper">
      <div>
        <Label hint="used for the file name">Title</Label>
        <Input value={docName} onChange={(e) => onDocName(e.target.value)} />
      </div>
      <div>
        <Label>Ruling</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {(["plain", "grid", "dots", "lined"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={board.paper === kind}
              onClick={() => onBoard({ paper: kind })}
              className={cn(
                "rounded-xl border-2 py-1.5 text-[11px] font-extrabold capitalize transition-colors",
                board.paper === kind
                  ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                  : "border-[var(--border)] hover:bg-[var(--bg)]",
              )}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>
      <Swatches
        label="Colour"
        value={board.paperColor}
        options={PAPER_COLORS}
        onChange={(paperColor) => onBoard({ paperColor })}
      />
      <div>
        <Label hint={board.grid ? `${board.grid}px` : "off"}>Snap shapes to a grid</Label>
        <Slider
          min={0}
          max={40}
          step={5}
          value={board.grid}
          onChange={(e) => onBoard({ grid: Number(e.target.value) })}
        />
      </div>
    </Panel>
  );
}
