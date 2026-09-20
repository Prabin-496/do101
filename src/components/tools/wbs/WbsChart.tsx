"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import {
  connectorGeometry,
  diagramBounds,
  shapeIndex,
  snap as snapTo,
  type Rect,
  type Shape,
} from "@/lib/diagram/model";
import { FONT_STACK } from "@/lib/diagram/export";
import { DASH_ARRAY, labelLineOffsets, shapeDetailPath, shapePath, wrapLabel } from "@/lib/diagram/shapes";
import type { ChartResult } from "@/lib/wbs/chart";

/**
 * The chart canvas.
 *
 * It draws the diagram produced by `wbsToDiagram` with the same primitives the
 * SVG exporter uses, so the picture on screen and the downloaded file are the
 * same picture. Dragging a card stores a position against the task; everything
 * else stays automatic, which is the difference between this and a blank
 * drawing surface — the tree can be rearranged without being broken.
 */

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

type Drag =
  | { kind: "node"; id: string; grabX: number; grabY: number; x: number; y: number; moved: boolean }
  | { kind: "pan"; startX: number; startY: number; fromX: number; fromY: number };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

function fitViewport(box: Rect, size: { w: number; h: number }): Viewport {
  if (size.w === 0 || size.h === 0 || box.w === 0 || box.h === 0) {
    return { x: box.x, y: box.y, zoom: 1 };
  }
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(size.w / box.w, size.h / box.h)));
  return {
    x: box.x + box.w / 2 - size.w / zoom / 2,
    y: box.y + box.h / 2 - size.h / zoom / 2,
    zoom,
  };
}

function ShapeNode({ shape }: { shape: Shape }) {
  const lines = wrapLabel(shape.text, shape);
  const offsets = labelLineOffsets(lines.length, shape.fontSize);
  const detail = shapeDetailPath(shape);
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;

  return (
    <>
      <path
        d={shapePath(shape)}
        fill={shape.fill}
        stroke={shape.stroke}
        strokeWidth={shape.strokeWidth}
        strokeLinejoin="round"
      />
      {detail ? <path d={detail} fill="none" stroke={shape.stroke} strokeWidth={shape.strokeWidth} /> : null}
      {lines.length ? (
        <text
          x={cx}
          y={cy}
          fontFamily={FONT_STACK}
          fontSize={shape.fontSize}
          fontWeight={shape.bold ? 700 : 500}
          fill={shape.textColor}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {lines.map((line, i) => (
            <tspan key={`${line}-${i}`} x={cx} dy={i === 0 ? offsets[0] : offsets[i] - offsets[i - 1]}>
              {line || " "}
            </tspan>
          ))}
        </text>
      ) : null}
    </>
  );
}

export interface WbsChartProps {
  /** Built by the panel above, so the canvas and the downloads agree. */
  chart: ChartResult;
  /** Grid a dragged card snaps to. */
  snap: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onDelete: (id: string) => void;
  height: number;
}

export function WbsChart({
  chart,
  snap,
  selectedId,
  onSelect,
  onRename,
  onToggle,
  onMove,
  onAddChild,
  onAddSibling,
  onDelete,
  height,
}: WbsChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [userView, setUserView] = React.useState<Viewport | null>(null);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);

  const { diagram } = chart;

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const bounds = React.useMemo(() => diagramBounds(diagram, 60), [diagram]);
  const view = userView ?? fitViewport(bounds, size);

  // Zooming is bound to ctrl/⌘ + wheel so an ordinary scroll still moves the
  // page — the listener has to be non-passive to be allowed to stop it.
  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setUserView((current) => {
        const from = current ?? fitViewport(bounds, { w: rect.width, h: rect.height });
        const zoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, from.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)),
        );
        // Keep the point under the cursor still while the scale changes.
        return {
          zoom,
          x: from.x + px / from.zoom - px / zoom,
          y: from.y + py / from.zoom - py / zoom,
        };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [bounds]);

  function toWorld(event: React.PointerEvent): { x: number; y: number } {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) / view.zoom + view.x,
      y: (event.clientY - rect.top) / view.zoom + view.y,
    };
  }

  function startNodeDrag(event: React.PointerEvent, shape: Shape) {
    if (event.button !== 0) return;
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const point = toWorld(event);
    onSelect(shape.id);
    setDrag({
      kind: "node",
      id: shape.id,
      grabX: point.x - shape.x,
      grabY: point.y - shape.y,
      x: shape.x,
      y: shape.y,
      moved: false,
    });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag) return;
    if (drag.kind === "pan") {
      const dx = (event.clientX - drag.startX) / view.zoom;
      const dy = (event.clientY - drag.startY) / view.zoom;
      setUserView({ zoom: view.zoom, x: drag.fromX - dx, y: drag.fromY - dy });
      return;
    }
    const point = toWorld(event);
    setDrag({
      ...drag,
      x: snapTo(point.x - drag.grabX, snap),
      y: snapTo(point.y - drag.grabY, snap),
      moved: true,
    });
  }

  function onPointerUp() {
    if (drag?.kind === "node" && drag.moved) onMove(drag.id, { x: drag.x, y: drag.y });
    setDrag(null);
  }

  const dragged = drag?.kind === "node" ? drag : null;
  // The dragged card follows the pointer without the document being rewritten
  // on every frame; the move is committed once, on release.
  const shapes: Shape[] = React.useMemo(
    () =>
      dragged
        ? diagram.shapes.map((shape) =>
            shape.id === dragged.id ? { ...shape, x: dragged.x, y: dragged.y } : shape,
          )
        : diagram.shapes,
    [diagram.shapes, dragged],
  );
  const byId = React.useMemo(() => shapeIndex(shapes), [shapes]);
  const rowById = React.useMemo(
    () => new Map(chart.nodes.map((node) => [node.id, node.row])),
    [chart.nodes],
  );

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const editingShape = editing ? byId.get(editing) : undefined;

  function zoomBy(factor: number) {
    setUserView({
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor)),
      x: view.x + size.w / view.zoom / 2 - size.w / (view.zoom * factor) / 2,
      y: view.y + size.h / view.zoom / 2 - size.h / (view.zoom * factor) / 2,
    });
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        style={{ height }}
        className="do-scroll relative w-full touch-none overflow-hidden rounded-2xl border-2 border-[var(--border)]"
      >
        <svg
          ref={svgRef}
          width={size.w || 1}
          height={size.h || 1}
          viewBox={`${view.x} ${view.y} ${(size.w || 1) / view.zoom} ${(size.h || 1) / view.zoom}`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          role="application"
          aria-label="Work breakdown structure chart"
        >
          {/* The background doubles as the pan surface and the deselect target. */}
          <rect
            x={bounds.x - 5000}
            y={bounds.y - 5000}
            width={bounds.w + 10000}
            height={bounds.h + 10000}
            fill={diagram.background}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              (event.target as Element).setPointerCapture?.(event.pointerId);
              onSelect(null);
              setEditing(null);
              setDrag({
                kind: "pan",
                startX: event.clientX,
                startY: event.clientY,
                fromX: view.x,
                fromY: view.y,
              });
            }}
            style={{ cursor: drag?.kind === "pan" ? "grabbing" : "grab" }}
          />

          {diagram.connectors.map((connector) => {
            const a = byId.get(connector.from);
            const b = byId.get(connector.to);
            if (!a || !b) return null;
            const geometry = connectorGeometry(connector, a, b);
            return (
              <path
                key={connector.id}
                d={geometry.path}
                fill="none"
                stroke={connector.stroke}
                strokeWidth={connector.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={DASH_ARRAY[connector.style]}
                markerEnd={connector.endArrow ? "url(#wbs-arrow)" : undefined}
              />
            );
          })}

          <defs>
            <marker
              id="wbs-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={diagram.connectors[0]?.stroke ?? "#64757f"} />
            </marker>
          </defs>

          {shapes.map((shape) => {
            const row = rowById.get(shape.id) ?? null;
            const isSelected = shape.id === selectedId;
            return (
              <g
                key={shape.id}
                onPointerDown={(event) => startNodeDrag(event, shape)}
                onDoubleClick={() => {
                  if (row) setEditing(shape.id);
                }}
                style={{ cursor: "move" }}
              >
                <ShapeNode shape={shape} />
                {isSelected ? (
                  <rect
                    x={shape.x - 6}
                    y={shape.y - 6}
                    width={shape.w + 12}
                    height={shape.h + 12}
                    rx={10}
                    fill="none"
                    stroke="#22b8f0"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    style={{ pointerEvents: "none" }}
                  />
                ) : null}
                {row?.isSummary ? (
                  <g
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onToggle(shape.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={shape.x + shape.w / 2}
                      cy={shape.y + shape.h + 1}
                      r={9}
                      fill="#ffffff"
                      stroke={shape.stroke}
                      strokeWidth={2}
                    />
                    <text
                      x={shape.x + shape.w / 2}
                      y={shape.y + shape.h + 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={13}
                      fontWeight={700}
                      fill={shape.stroke}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {row.collapsed ? "+" : "–"}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {editingShape && rowById.get(editingShape.id) ? (
            <foreignObject
              x={editingShape.x + 8}
              y={editingShape.y + editingShape.h / 2 - 16}
              width={editingShape.w - 16}
              height={32}
            >
              <input
                autoFocus
                value={rowById.get(editingShape.id)?.name ?? ""}
                onChange={(event) => onRename(editingShape.id, event.target.value)}
                onBlur={() => setEditing(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") setEditing(null);
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  boxSizing: "border-box",
                  border: "2px solid #22b8f0",
                  borderRadius: 8,
                  padding: "0 8px",
                  font: `600 ${editingShape.fontSize}px ${FONT_STACK}`,
                  color: "#22303c",
                  background: "#ffffff",
                }}
              />
            </foreignObject>
          ) : null}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1.5 p-2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] p-1">
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.2)}
              aria-label="Zoom out"
              className="grid h-7 w-7 place-items-center rounded-lg text-sm font-extrabold hover:bg-[var(--panel)]"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center text-xs font-extrabold tabular-nums text-[var(--muted)]">
              {Math.round(view.zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomBy(1.2)}
              aria-label="Zoom in"
              className="grid h-7 w-7 place-items-center rounded-lg text-sm font-extrabold hover:bg-[var(--panel)]"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setUserView(null)}
              className="rounded-lg px-2 py-1 text-xs font-extrabold hover:bg-[var(--panel)]"
            >
              Fit
            </button>
          </div>
          <span className="pointer-events-none rounded-xl bg-[var(--bg)]/85 px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
            Drag a card to place it · drag the background to pan · ⌘/Ctrl + scroll to zoom ·
            double-click to rename
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => selectedId && onAddSibling(selectedId)} disabled={!selected}>
          + Task after
        </Button>
        <Button size="sm" tone="sky" onClick={() => selectedId && onAddChild(selectedId)} disabled={!selected}>
          + Sub-task
        </Button>
        <Button
          size="sm"
          tone="panel"
          onClick={() => selectedId && setEditing(selectedId)}
          disabled={!selected || !rowById.get(selectedId ?? "")}
        >
          Rename
        </Button>
        <Button
          size="sm"
          tone="cherry"
          onClick={() => selectedId && onDelete(selectedId)}
          disabled={!selected || !rowById.get(selectedId ?? "")}
        >
          Delete
        </Button>
        <span className={cn("flex-1")} />
      </div>
    </div>
  );
}
