"use client";

import * as React from "react";
import { SHAPE_LIBRARY } from "@/lib/diagram/model";
import type { ShapeKind, Tool, ToolName } from "@/lib/canvas/model";
import { nodeDetailPath, nodePath } from "@/lib/canvas/render";
import { cn } from "@/lib/utils/cn";

/**
 * The left rail: the drawing tools and the shape library in one strip.
 *
 * Both halves arm the same `tool` state — a pen and a rectangle are the same
 * kind of choice, and keeping them in one list is what makes sketching over a
 * flowchart feel like one tool rather than two bolted together.
 */

export interface DrawTool {
  tool: ToolName;
  label: string;
  icon: string;
  key: string;
}

export const DRAW_TOOLS: DrawTool[] = [
  { tool: "select", label: "Select", icon: "↖", key: "V" },
  { tool: "pen", label: "Pen", icon: "✏️", key: "P" },
  { tool: "highlighter", label: "Marker", icon: "🖍", key: "H" },
  { tool: "eraser", label: "Eraser", icon: "🧽", key: "E" },
  { tool: "line", label: "Line", icon: "╱", key: "L" },
  { tool: "arrow", label: "Arrow", icon: "↗", key: "A" },
  { tool: "text", label: "Text", icon: "T", key: "T" },
  { tool: "laser", label: "Laser", icon: "🔴", key: "X" },
];

/** The shapes on offer, and the single-key shortcut for the common ones. */
export const SHAPE_KEYS: Partial<Record<ShapeKind, string>> = {
  rounded: "R",
  ellipse: "O",
  diamond: "D",
  note: "N",
};

const SHAPE_META: Record<string, { label: string; hint: string }> = Object.fromEntries(
  SHAPE_LIBRARY.map((item) => [item.kind, { label: item.label, hint: item.hint }]),
);

/** Free text covers what the diagram library's "text" shape was for. */
const GROUPS: { title: string; kinds: ShapeKind[] }[] = [
  { title: "Shapes", kinds: ["rounded", "rectangle", "ellipse", "note"] },
  {
    title: "Flowchart",
    kinds: ["diamond", "parallelogram", "hexagon", "document", "cylinder", "triangle"],
  },
];

export function isNodeTool(tool: Tool): tool is { node: ShapeKind } {
  return typeof tool !== "string";
}

export function sameTool(a: Tool, b: Tool): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.node === b.node;
}

/** A miniature of the real shape, drawn by the same code the canvas uses. */
export function ShapeThumb({ kind, className }: { kind: ShapeKind; className?: string }) {
  const box = { x: 4, y: 4, w: 48, h: 28 };
  const detail = nodeDetailPath({ ...box, kind });
  return (
    <svg viewBox="0 0 56 36" className={cn("h-8 w-12 shrink-0", className)} aria-hidden>
      <path
        d={nodePath({ ...box, kind })}
        fill="var(--sky-soft)"
        stroke="var(--sky)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {detail ? <path d={detail} fill="none" stroke="var(--sky)" strokeWidth={2} /> : null}
    </svg>
  );
}

function RailButton({
  active,
  horizontal,
  title,
  label,
  children,
  onClick,
  onPointerDown,
  grab,
}: {
  active: boolean;
  horizontal: boolean;
  title: string;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: (event: React.PointerEvent) => void;
  grab?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 py-1.5 transition-colors",
        horizontal ? "min-w-[58px]" : "w-full",
        grab && "cursor-grab active:cursor-grabbing",
        active
          ? "border-[var(--sky)] bg-[var(--sky-soft)]"
          : "border-transparent hover:bg-[var(--bg)]",
      )}
    >
      {children}
      <span className="text-[10px] font-extrabold leading-tight">{label}</span>
    </button>
  );
}

export interface PaletteProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
  /** Starts dragging a shape out of the palette and onto the canvas. */
  onShapeDragStart: (kind: ShapeKind, event: React.PointerEvent) => void;
  onPickImage: () => void;
  horizontal?: boolean;
}

export function CanvasPalette({
  tool,
  onTool,
  onShapeDragStart,
  onPickImage,
  horizontal = false,
}: PaletteProps) {
  const [query, setQuery] = React.useState("");

  const groups = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return GROUPS;
    return GROUPS.map((group) => ({
      ...group,
      kinds: group.kinds.filter((kind) => {
        const meta = SHAPE_META[kind];
        return (
          kind.includes(needle) ||
          meta?.label.toLowerCase().includes(needle) ||
          meta?.hint.toLowerCase().includes(needle)
        );
      }),
    })).filter((group) => group.kinds.length > 0);
  }, [query]);

  const drawButtons = DRAW_TOOLS.map((item) => (
    <RailButton
      key={item.tool}
      active={sameTool(tool, item.tool)}
      horizontal={horizontal}
      title={`${item.label} (${item.key})`}
      label={item.label}
      onClick={() => onTool(item.tool)}
    >
      <span aria-hidden className="text-lg leading-none">
        {item.icon}
      </span>
    </RailButton>
  ));

  const pictureButton = (
    <RailButton
      key="picture"
      active={false}
      horizontal={horizontal}
      title="Add a picture"
      label="Picture"
      onClick={onPickImage}
    >
      <span aria-hidden className="text-lg leading-none">
        🖼
      </span>
    </RailButton>
  );

  const shapeButtons = (kinds: ShapeKind[]) =>
    kinds.map((kind) => {
      const meta = SHAPE_META[kind] ?? { label: kind, hint: "" };
      const key = SHAPE_KEYS[kind];
      return (
        <RailButton
          key={kind}
          active={sameTool(tool, { node: kind })}
          horizontal={horizontal}
          grab
          title={`${meta.label} — ${meta.hint}${key ? ` (${key})` : ""}. Click then click the canvas, drag me onto it, or drag on the canvas to size it.`}
          label={meta.label}
          onClick={() => onTool(sameTool(tool, { node: kind }) ? "select" : { node: kind })}
          onPointerDown={(event) => {
            if (event.button === 0) onShapeDragStart(kind, event);
          }}
        >
          <ShapeThumb kind={kind} />
        </RailButton>
      );
    });

  if (horizontal) {
    return (
      <div
        className="do-scroll flex items-stretch gap-1 overflow-x-auto rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-1.5"
        role="toolbar"
        aria-label="Tools and shapes"
      >
        {drawButtons}
        {pictureButton}
        <span className="mx-0.5 w-px shrink-0 bg-[var(--border)]" aria-hidden />
        {groups.flatMap((group) => shapeButtons(group.kinds))}
      </div>
    );
  }

  return (
    <aside
      className="do-scroll flex h-full min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-1.5"
      aria-label="Tools and shapes"
    >
      <div className="grid grid-cols-2 gap-1" role="toolbar" aria-label="Drawing tools">
        {drawButtons}
        {pictureButton}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search shapes…"
        aria-label="Search shapes"
        className="w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[var(--sky)]"
      />

      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="px-1 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
            {group.title}
          </h3>
          <div className="grid grid-cols-2 gap-1">{shapeButtons(group.kinds)}</div>
        </section>
      ))}

      {groups.length === 0 ? (
        <p className="px-1 text-xs font-semibold text-[var(--muted)]">No shape matches that.</p>
      ) : null}

      <p className="mt-auto px-1 pt-2 text-[10px] font-semibold leading-snug text-[var(--muted)]">
        Drag a shape onto the canvas, or click it and then drag on the canvas to size it.
      </p>
    </aside>
  );
}
