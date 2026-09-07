"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { ErrorState, EmptyState, Progress, Stat, SuccessNote } from "@/components/ui/Feedback";
import { readWorkbook, writeWorkbook, sheetsToPdf, SheetError, type SheetData } from "@/lib/docs/spreadsheet";
import { downloadBytes } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export type SheetTarget = "pdf" | "csv" | "xlsx";

const COPY: Record<SheetTarget, { icon: string; title: string; accept: string; action: string }> = {
  pdf: { icon: "📄", title: "Drop your spreadsheet", accept: ".xlsx,.xls,.csv,.ods", action: "Convert to PDF" },
  csv: { icon: "📊", title: "Drop your Excel file", accept: ".xlsx,.xls,.ods", action: "Convert to CSV" },
  xlsx: { icon: "📈", title: "Drop your CSV file", accept: ".csv,.txt", action: "Convert to Excel" },
};

export function SpreadsheetTool({ target }: { target: SheetTarget }) {
  const [sheets, setSheets] = React.useState<SheetData[] | null>(null);
  const [name, setName] = React.useState("");
  const [size, setSize] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [orientation, setOrientation] = React.useState<"landscape" | "portrait">("landscape");
  const [sheetNames, setSheetNames] = React.useState(true);
  const [output, setOutput] = React.useState<{ bytes: Uint8Array; label: string; note?: string } | null>(
    null,
  );

  const copy = COPY[target];

  const load = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setOutput(null);
    setBusy(true);
    try {
      const parsed = await readWorkbook(file);
      setSheets(parsed);
      setName(file.name);
      setSize(file.size);
    } catch (err) {
      setError(err instanceof SheetError ? err.message : "That file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!sheets) return;
    setBusy(true);
    setError(null);
    try {
      const base = name.replace(/\.[^.]+$/, "");
      if (target === "pdf") {
        const result = await sheetsToPdf(sheets, {
          orientation,
          includeSheetNames: sheetNames && sheets.length > 1,
        });
        setOutput({
          bytes: result.bytes,
          label: `${base}.pdf`,
          note:
            result.truncatedColumns > 0
              ? `${result.truncatedColumns} cells were too wide for their column and were shortened with an ellipsis. Landscape orientation usually helps.`
              : undefined,
        });
      } else {
        const blob = await writeWorkbook(sheets, target === "csv" ? "csv" : "xlsx");
        setOutput({
          bytes: new Uint8Array(await blob.arrayBuffer()),
          label: `${base}.${target}`,
          note:
            target === "csv" && sheets.length > 1
              ? `CSV holds a single table, so only the first sheet ("${sheets[0].name}") was exported.`
              : undefined,
        });
      }
      track("tool_complete", { tool: `spreadsheet-to-${target}` });
      recordCompletion(15);
    } catch {
      setError("The conversion failed. Very large workbooks can exhaust the browser's memory.");
    } finally {
      setBusy(false);
    }
  };

  const mime =
    target === "pdf"
      ? "application/pdf"
      : target === "csv"
        ? "text/csv;charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const totalRows = sheets?.reduce((n, s) => n + s.rows.length, 0) ?? 0;

  return (
    <div className="space-y-4">
      {!sheets ? (
        <FileDrop
          onFiles={load}
          accept={copy.accept}
          multiple={false}
          icon={copy.icon}
          title={copy.title}
          hint="Parsed on your device · nothing is uploaded"
          disabled={busy}
        />
      ) : null}

      {busy && !sheets ? <Progress value={60} tone="cherry" label="Reading workbook" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {sheets ? (
        <>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">
                {copy.icon} {name} · {sheets.length} sheet{sheets.length === 1 ? "" : "s"} ·{" "}
                {formatBytes(size)}
              </p>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  setSheets(null);
                  setOutput(null);
                }}
              >
                Choose another
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Sheets" value={sheets.length} tone="grass" />
              <Stat label="Rows" value={totalRows.toLocaleString()} tone="sky" />
              <Stat
                label="Columns"
                value={Math.max(1, ...sheets.flatMap((s) => s.rows.map((r) => r.length)))}
                tone="grape"
              />
            </div>

            {target === "pdf" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sheet-orientation">Orientation</Label>
                  <Select
                    id="sheet-orientation"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as "landscape" | "portrait")}
                  >
                    <option value="landscape">Landscape — fits more columns</option>
                    <option value="portrait">Portrait</option>
                  </Select>
                </div>
                {sheets.length > 1 ? (
                  <Toggle
                    checked={sheetNames}
                    onChange={setSheetNames}
                    label="Print sheet names"
                    description="A heading before each sheet's table."
                  />
                ) : null}
              </div>
            ) : null}

            <div className="mt-4">
              <Button tone="cherry" onClick={convert} disabled={busy}>
                {busy ? "Converting…" : copy.action}
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <h3 className="border-b-2 border-[var(--border)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Preview — {sheets[0].name}
            </h3>
            <div className="do-scroll max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <tbody>
                  {sheets[0].rows.slice(0, 12).map((row, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      {row.slice(0, 8).map((cell, j) => (
                        <td
                          key={j}
                          className={`max-w-[180px] truncate px-4 py-2 ${i === 0 ? "font-extrabold" : "text-[var(--muted)]"}`}
                        >
                          {String(cell ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheets[0].rows.length > 12 ? (
              <p className="px-5 py-2 text-xs font-semibold text-[var(--muted)]">
                Showing the first 12 rows of {sheets[0].rows.length.toLocaleString()}.
              </p>
            ) : null}
          </Card>

          {output ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                {output.label} ready · {formatBytes(output.bytes.length)}
              </SuccessNote>
              {output.note ? (
                <p className="rounded-xl bg-[var(--bg)] px-3 py-2 text-sm font-semibold">
                  {output.note}
                </p>
              ) : null}
              <Button
                tone="grass"
                onClick={() => downloadBytes(output.bytes, output.label, mime)}
              >
                Download {output.label.split(".").pop()?.toUpperCase()}
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={copy.icon}
          title="Nothing loaded yet"
          description="Add a file and its contents are parsed on your device — no upload, no account."
        />
      )}
    </div>
  );
}
