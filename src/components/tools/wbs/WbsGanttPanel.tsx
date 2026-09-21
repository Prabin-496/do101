"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select, Toggle } from "@/components/ui/Field";
import { ErrorState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import { cn } from "@/lib/utils/cn";
import { track } from "@/lib/analytics";
import { buildGanttGrid } from "@/lib/wbs/gantt";
import { copyGridForSpreadsheet } from "@/lib/wbs/clipboard";
import { gridToCsv } from "@/lib/wbs/grid";
import type { GanttScale, GanttSettings, WbsDoc, WbsRow } from "@/lib/wbs/model";
import { buildWorkbook, workbookFilename } from "@/lib/wbs/workbook";
import { WbsGantt } from "./WbsGantt";

const SCALES: { id: GanttScale; label: string }[] = [
  { id: "day", label: "Days" },
  { id: "week", label: "Weeks" },
  { id: "month", label: "Months" },
  { id: "quarter", label: "Quarters" },
];

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function WbsGanttPanel({
  doc,
  rows,
  selectedId,
  onSelect,
  onGantt,
  onDates,
  height = 460,
}: {
  doc: WbsDoc;
  rows: WbsRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onGantt: (changes: Partial<GanttSettings>) => void;
  onDates: (id: string, dates: { start: string; end: string }) => void;
  height?: number;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // The view respects collapsed branches; the copy and the download do not,
  // matching the spreadsheet export — a folded branch is still part of the plan.
  const grid = React.useMemo(() => buildGanttGrid(doc), [doc]);
  const dateFields = doc.fields.filter((field) => field.type === "date");
  const percentFields = doc.fields.filter((field) => field.type === "percent");
  const periods = grid.columns.filter((column) => column.key.startsWith("p-")).length;

  async function copy() {
    setError(null);
    try {
      await copyGridForSpreadsheet(grid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      track("tool_complete", { tool: "wbs", format: "gantt-copy" });
    } catch {
      setError("This browser blocked the clipboard. Use the CSV or Excel download instead.");
    }
  }

  async function downloadExcel() {
    setBusy(true);
    setError(null);
    try {
      const blob = await buildWorkbook(doc);
      save(blob, workbookFilename(doc, "xlsx"));
      track("tool_complete", { tool: "wbs", format: "gantt-xlsx" });
    } catch {
      setError("The workbook could not be built here. The CSV download still works.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <WbsGantt
        doc={doc}
        rows={rows}
        selectedId={selectedId}
        onSelect={onSelect}
        onDates={onDates}
        height={height}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={copy}>{copied ? "Copied — paste into Excel" : "Copy for Excel"}</Button>
        <Button tone="sky" onClick={downloadExcel} disabled={busy}>
          {busy ? "Building…" : "Download .xlsx"}
        </Button>
        <Button
          tone="panel"
          onClick={() =>
            save(
              new Blob([gridToCsv(grid)], { type: "text/csv;charset=utf-8" }),
              workbookFilename(doc, "csv"),
            )
          }
        >
          Download .csv
        </Button>
        <div className="flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--panel)] p-1">
          {SCALES.map((scale) => (
            <button
              key={scale.id}
              type="button"
              aria-pressed={doc.gantt.scale === scale.id}
              onClick={() => onGantt({ scale: scale.id })}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-extrabold",
                doc.gantt.scale === scale.id
                  ? "bg-[var(--bg)] text-[var(--ink)]"
                  : "text-[var(--muted)]",
              )}
            >
              {scale.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {copied ? (
        <SuccessNote>
          Copied {grid.rows.length} rows and {grid.columns.length} columns. Paste into a sheet and
          the blocks land one per {doc.gantt.scale}.
        </SuccessNote>
      ) : null}

      <InfoNote icon="📋">
        Copy puts the whole table on the clipboard, timeline included — every {doc.gantt.scale} is
        its own column with a block where the task runs, so pasting into Excel gives you a chart
        you can see at once. Select those columns and apply a conditional format to turn the blocks
        into colour. The .xlsx download has the same thing as a Gantt sheet, with real dates you can
        sort and filter.
      </InfoNote>

      <Card className="p-4">
        <h3 className="mb-3 text-base">Timeline</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wbs-gantt-start">Start column</Label>
            <Select
              id="wbs-gantt-start"
              value={doc.gantt.startFieldId}
              onChange={(event) => onGantt({ startFieldId: event.target.value })}
            >
              {dateFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-gantt-end">Finish column</Label>
            <Select
              id="wbs-gantt-end"
              value={doc.gantt.endFieldId}
              onChange={(event) => onGantt({ endFieldId: event.target.value })}
            >
              {dateFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-gantt-progress">Progress column</Label>
            <Select
              id="wbs-gantt-progress"
              value={doc.gantt.progressFieldId ?? ""}
              onChange={(event) => onGantt({ progressFieldId: event.target.value || null })}
            >
              <option value="">None</option>
              {percentFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-gantt-colour">Colour bars by</Label>
            <Select
              id="wbs-gantt-colour"
              value={doc.gantt.colourBy}
              onChange={(event) =>
                onGantt({ colourBy: event.target.value as GanttSettings["colourBy"] })
              }
            >
              <option value="level">Level</option>
              <option value="branch">Top-level branch</option>
              <option value="field">A choice column</option>
              <option value="flat">One colour</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-gantt-from" hint="blank = fit the work">
              Show from
            </Label>
            <Input
              id="wbs-gantt-from"
              type="date"
              value={doc.gantt.rangeStart ?? ""}
              onChange={(event) => onGantt({ rangeStart: event.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="wbs-gantt-to" hint="blank = fit the work">
              Show to
            </Label>
            <Input
              id="wbs-gantt-to"
              type="date"
              value={doc.gantt.rangeEnd ?? ""}
              onChange={(event) => onGantt({ rangeEnd: event.target.value || null })}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={doc.gantt.showProgress}
            onChange={(value) => onGantt({ showProgress: value })}
            label="Fill bars by progress"
          />
          <Toggle
            checked={doc.gantt.showToday}
            onChange={(value) => onGantt({ showToday: value })}
            label="Today line"
          />
          <Toggle
            checked={doc.gantt.showWeekends}
            onChange={(value) => onGantt({ showWeekends: value })}
            label="Shade weekends"
            description="Visible at the day scale."
          />
          <Toggle
            checked={doc.gantt.includeInWorkbook}
            onChange={(value) => onGantt({ includeInWorkbook: value })}
            label="Gantt sheet in the Excel download"
          />
        </div>

        <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
          The Gantt sheet leads with the same columns as the spreadsheet, then one column per{" "}
          {doc.gantt.scale} — {periods} of them in the copy and the download.
        </p>
      </Card>
    </div>
  );
}
