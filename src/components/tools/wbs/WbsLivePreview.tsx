"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { wbsToDiagram } from "@/lib/wbs/chart";
import type { WbsDoc, WbsRow } from "@/lib/wbs/model";
import { WbsChart } from "./WbsChart";
import { copyGridForSpreadsheet } from "@/lib/wbs/clipboard";
import { buildGanttGrid, describeRange, ganttRange } from "@/lib/wbs/gantt";
import { buildGrid } from "@/lib/wbs/grid";
import { WbsGantt } from "./WbsGantt";
import { WbsSheetPreview } from "./WbsSheetPreview";

export type PreviewKind = "chart" | "gantt" | "sheet";

/**
 * The live half of the split view.
 *
 * It reads the same document the editor is writing, so it is not refreshed or
 * regenerated — it simply re-renders, which is why the chart and the sheet
 * move as you type. Sticky, so it stays in view while a long breakdown is
 * scrolled beside it.
 */
export function WbsLivePreview({
  doc,
  rows,
  kind,
  onKind,
  editing,
  selectedId,
  onSelect,
  onRename,
  onToggle,
  onMove,
  onAddChild,
  onAddSibling,
  onDelete,
  onDates,
}: {
  doc: WbsDoc;
  rows: WbsRow[];
  kind: PreviewKind;
  onKind: (kind: PreviewKind) => void;
  /** The view already being edited on the left, which the preview skips. */
  editing: PreviewKind | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onDelete: (id: string) => void;
  onDates: (id: string, dates: { start: string; end: string }) => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const chart = React.useMemo(() => wbsToDiagram(doc, rows), [doc, rows]);
  const grid = React.useMemo(() => buildGrid(doc), [doc]);
  // The whole plan, not only what is on screen — a folded branch is still
  // part of it, which is how the spreadsheet export behaves too.
  const ganttGrid = React.useMemo(() => buildGanttGrid(doc), [doc]);
  const all: { id: PreviewKind; label: string }[] = [
    { id: "chart", label: "Chart" },
    { id: "gantt", label: "Gantt" },
    { id: "sheet", label: "Sheet" },
  ];
  const options = all.filter((option) => option.id !== editing);
  const showing: PreviewKind =
    options.some((option) => option.id === kind) ? kind : options[0].id;

  return (
    <Card className="p-3 lg:sticky lg:top-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--panel)] p-1">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={showing === option.id}
              onClick={() => onKind(option.id)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-extrabold",
                showing === option.id ? "bg-[var(--bg)] text-[var(--ink)]" : "text-[var(--muted)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold text-[var(--muted)]">
          {showing === "chart"
            ? `${chart.diagram.shapes.length} cards · updates as you type`
            : showing === "gantt"
              ? `${describeRange(ganttRange(rows, doc.gantt), doc)} · updates as you type`
              : `${grid.rows.length} rows × ${grid.columns.length} columns · exactly what downloads`}
        </span>
      </div>

      {showing === "chart" ? null : (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            tone={copied ? "grass" : "panel"}
            onClick={async () => {
              setFailed(false);
              try {
                await copyGridForSpreadsheet(showing === "gantt" ? ganttGrid : grid);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              } catch {
                setFailed(true);
              }
            }}
          >
            {copied ? "Copied — paste into Excel" : "Copy for Excel"}
          </Button>
          {failed ? (
            <span className="text-xs font-bold text-[var(--cherry)]">
              This browser blocked the clipboard — use a download instead.
            </span>
          ) : (
            <span className="text-xs font-semibold text-[var(--muted)]">
              {showing === "gantt"
                ? "Timeline columns included, one per period."
                : "Every row and column, exactly as it downloads."}
            </span>
          )}
        </div>
      )}

      {showing === "gantt" ? (
        <WbsGantt
          doc={doc}
          rows={rows}
          selectedId={selectedId}
          onSelect={onSelect}
          onDates={onDates}
          height={460}
        />
      ) : showing === "chart" ? (
        <WbsChart
          chart={chart}
          snap={doc.chart.snap}
          selectedId={selectedId}
          onSelect={onSelect}
          onRename={onRename}
          onToggle={onToggle}
          onMove={onMove}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onDelete={onDelete}
          height={460}
        />
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <WbsSheetPreview grid={grid} limit={0} />
        </div>
      )}
    </Card>
  );
}
