"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { InfoNote } from "@/components/ui/Feedback";
import {
  DEFAULT_WORKSPACE, LAYOUTS, LAYOUT_MAP, PANES, PANE_GROUPS, PANE_MAP,
  normalise, type LayoutId, type PaneId, type WorkspaceState,
} from "@/lib/workspace/panes";
import { useIsHydrated, useLocalValue } from "@/lib/utils/use-local";
import { writeLocal } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "workspace";

/**
 * One lazy component per pane, created once at module load.
 *
 * React.lazy has to be called outside render: a new lazy component on every
 * render is a different component type, so React would unmount and remount the
 * pane — losing whatever the reader had typed in it.
 */
const LAZY_PANES = new Map<PaneId, React.ReactNode>(
  PANES.map((pane) => {
    const Lazy = React.lazy(pane.load);
    return [
      pane.id,
      <React.Suspense
        key={pane.id}
        fallback={
          <div className="flex items-center justify-center p-10">
            <p className="text-sm font-bold text-[var(--muted)]">Loading {pane.name}…</p>
          </div>
        }
      >
        <Lazy />
      </React.Suspense>,
    ];
  }),
);

/** Renders a pane's tool, loading its code the first time it is shown. */
function PaneBody({ id }: { id: PaneId }) {
  return LAZY_PANES.get(id) ?? null;
}

function PanePicker({
  value,
  onChange,
  onClose,
}: {
  value: PaneId;
  onChange: (id: PaneId) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--bg)] p-2 shadow-lg">
      <button
        type="button"
        onClick={() => {
          onChange("empty");
          onClose();
        }}
        className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[var(--muted)] hover:bg-[var(--panel)]"
      >
        Empty this pane
      </button>
      {PANE_GROUPS.map((group) => {
        const items = PANES.filter((pane) => pane.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="mt-1">
            <p className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {group}
            </p>
            {items.map((pane) => (
              <button
                key={pane.id}
                type="button"
                onClick={() => {
                  onChange(pane.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition",
                  pane.id === value ? "bg-[var(--sky-soft)]" : "hover:bg-[var(--panel)]",
                )}
              >
                <span aria-hidden>{pane.icon}</span>
                {pane.name}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function Workspace() {
  const hydrated = useIsHydrated();
  const stored = useLocalValue<WorkspaceState | null>(STORAGE_KEY, null);
  const state = React.useMemo(() => normalise(stored ?? DEFAULT_WORKSPACE), [stored]);

  const [openPicker, setOpenPicker] = React.useState<number | null>(null);
  const [maximised, setMaximised] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ index: number; rect: DOMRect } | null>(null);
  const reported = React.useRef(false);

  const layout = LAYOUT_MAP.get(state.layout)!;
  const cells = layout.cells;

  function save(patch: Partial<WorkspaceState>) {
    writeLocal(STORAGE_KEY, normalise({ ...state, ...patch }));
    if (!reported.current) {
      reported.current = true;
      track("tool_complete", { tool: "workspace" });
    }
  }

  function setPane(index: number, id: PaneId) {
    const panes = [...state.panes];
    panes[index] = id;
    save({ panes });
  }

  function setLayout(id: LayoutId) {
    // Reset sizes so a new layout starts even rather than inheriting a drag
    // from a layout with a different number of panes.
    save({ layout: id, sizes: [1, 1, 1, 1] });
    setMaximised(null);
  }

  /**
   * Divider dragging.
   *
   * Sizes are stored as flex ratios rather than pixels so the layout still
   * makes sense after the window is resized or the workspace is reopened on a
   * different screen.
   */
  function startDrag(index: number, event: React.PointerEvent) {
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { index, rect: container.getBoundingClientRect() };
  }

  function onDrag(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const { index, rect } = drag;
    const vertical = layout.direction === "column";
    const total = vertical ? rect.height : rect.width;
    const position = vertical ? event.clientY - rect.top : event.clientX - rect.left;

    const sizes = [...state.sizes];
    const before = sizes.slice(0, index + 1).reduce((a, b) => a + b, 0);
    const after = sizes[index + 1];
    const pairTotal = sizes[index] + after;

    // Fraction of the container up to the divider being dragged.
    const sumAll = sizes.slice(0, cells).reduce((a, b) => a + b, 0);
    const fraction = Math.min(0.9, Math.max(0.1, position / total));
    const targetBefore = fraction * sumAll;
    const delta = targetBefore - (before - sizes[index]);

    const nextFirst = Math.min(pairTotal - 0.2, Math.max(0.2, delta));
    sizes[index] = nextFirst;
    sizes[index + 1] = pairTotal - nextFirst;
    save({ sizes });
  }

  function endDrag(event: React.PointerEvent) {
    if (!dragRef.current) return;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  }

  if (!hydrated) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm font-bold text-[var(--muted)]">Setting up your workspace…</p>
      </Card>
    );
  }

  const visible = Array.from({ length: cells }, (_, i) => i);
  const shown = maximised !== null ? [maximised] : visible;

  const gridStyle: React.CSSProperties =
    maximised !== null
      ? { display: "block" }
      : layout.direction === "grid"
        ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }
        : {
            display: "grid",
            gap: 0,
            [layout.direction === "column" ? "gridTemplateRows" : "gridTemplateColumns"]:
              visible
                .map((i) => `minmax(0, ${state.sizes[i]}fr)`)
                .join(" 0.75rem "),
          };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Layout">
            {LAYOUTS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={state.layout === option.id}
                onClick={() => setLayout(option.id)}
                title={option.name}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition",
                  state.layout === option.id
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]",
                )}
              >
                <span aria-hidden className="text-sm">{option.icon}</span>
                <span className="hidden sm:inline">{option.name}</span>
              </button>
            ))}
          </div>
          <span className="flex-1" />
          {maximised !== null ? (
            <Button size="sm" tone="panel" onClick={() => setMaximised(null)}>
              ⤢ Back to {LAYOUT_MAP.get(state.layout)!.name.toLowerCase()}
            </Button>
          ) : null}
          <Button
            size="sm"
            tone="ghost"
            onClick={() => {
              writeLocal(STORAGE_KEY, DEFAULT_WORKSPACE);
              setMaximised(null);
            }}
          >
            Reset
          </Button>
        </div>

        <div className="mt-3 border-t-2 border-[var(--border)] pt-3">
          <Toggle
            checked={state.compact}
            onChange={(compact) => save({ compact })}
            label="Compact panes"
            description="Tighter padding and smaller headers, for fitting more on a laptop screen."
          />
        </div>
      </Card>

      <div
        ref={containerRef}
        style={gridStyle}
        className={cn(
          "min-h-[60vh]",
          // Stacking on narrow screens is the only sensible thing to do: two
          // columns on a phone gives each tool about 160px.
          layout.direction !== "grid" && maximised === null ? "max-lg:!grid-cols-1 max-lg:!grid-rows-none max-lg:gap-3" : "",
          layout.direction === "grid" && maximised === null ? "max-lg:!grid-cols-1" : "",
        )}
      >
        {shown.map((index, position) => {
          const paneId = state.panes[index];
          const definition = paneId === "empty" ? null : PANE_MAP.get(paneId);
          const isLast = position === shown.length - 1;
          const showDivider =
            maximised === null && layout.direction !== "grid" && !isLast;

          return (
            <React.Fragment key={index}>
              <Card
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden",
                  state.compact ? "p-0" : "p-0",
                )}
              >
                <div
                  className={cn(
                    "relative flex items-center gap-2 border-b-2 border-[var(--border)] bg-[var(--panel)]",
                    state.compact ? "px-2 py-1.5" : "px-3 py-2",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenPicker(openPicker === index ? null : index)}
                    aria-expanded={openPicker === index}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left text-sm font-extrabold hover:bg-[var(--bg)]"
                  >
                    <span aria-hidden>{definition?.icon ?? "＋"}</span>
                    <span className="truncate">{definition?.name ?? "Choose a tool"}</span>
                    <span aria-hidden className="text-[var(--muted)]">▾</span>
                  </button>

                  {definition?.route ? (
                    <Link
                      href={definition.route}
                      title={`Open ${definition.name} on its own page`}
                      className="rounded-lg px-2 py-1 text-xs font-extrabold text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                    >
                      ↗
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setMaximised(maximised === index ? null : index)}
                    title={maximised === index ? "Restore" : "Focus this pane"}
                    className="rounded-lg px-2 py-1 text-xs font-extrabold text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                  >
                    {maximised === index ? "⤡" : "⤢"}
                  </button>

                  {openPicker === index ? (
                    <>
                      <button
                        type="button"
                        aria-label="Close tool picker"
                        onClick={() => setOpenPicker(null)}
                        className="fixed inset-0 z-10 cursor-default"
                      />
                      <PanePicker
                        value={paneId}
                        onChange={(id) => setPane(index, id)}
                        onClose={() => setOpenPicker(null)}
                      />
                    </>
                  ) : null}
                </div>

                <div className={cn("do-scroll min-h-0 flex-1 overflow-y-auto", state.compact ? "p-2" : "p-4")}>
                  {definition ? (
                    <PaneBody id={paneId} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <span className="do-bob text-3xl" aria-hidden>🧩</span>
                      <p className="text-sm font-extrabold">This pane is empty</p>
                      <Button size="sm" tone="panel" onClick={() => setOpenPicker(index)}>
                        Pick a tool
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {showDivider ? (
                <div
                  role="separator"
                  aria-orientation={layout.direction === "column" ? "horizontal" : "vertical"}
                  aria-label="Resize panes"
                  tabIndex={0}
                  onPointerDown={(event) => startDrag(index, event)}
                  onPointerMove={onDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={(event) => {
                    const step = 0.1;
                    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
                    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
                    if (!forward && !back) return;
                    event.preventDefault();
                    const sizes = [...state.sizes];
                    const delta = forward ? step : -step;
                    const pair = sizes[index] + sizes[index + 1];
                    const next = Math.min(pair - 0.2, Math.max(0.2, sizes[index] + delta));
                    sizes[index] = next;
                    sizes[index + 1] = pair - next;
                    save({ sizes });
                  }}
                  className={cn(
                    "group flex touch-none items-center justify-center rounded-full transition max-lg:hidden",
                    layout.direction === "column"
                      ? "h-3 cursor-row-resize"
                      : "w-3 cursor-col-resize",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full bg-[var(--border)] transition group-hover:bg-[var(--sky)] group-focus:bg-[var(--sky)]",
                      layout.direction === "column" ? "h-1 w-12" : "h-12 w-1",
                    )}
                  />
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>

      <InfoNote icon="🧩">
        <strong className="font-extrabold">Your layout is remembered on this device.</strong>{" "}
        The panes you pick, the split sizes and the layout are stored in this browser,
        so the workspace opens the way you left it. Drag the bars between panes to
        resize, or use the arrow keys once a bar has focus. On a phone the panes stack
        into one column, because two tools side by side on a small screen helps nobody.
      </InfoNote>
    </div>
  );
}
