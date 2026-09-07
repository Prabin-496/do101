"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, EmptyState, InfoNote, Progress, Stat, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { extractTables, tablesToWorkbook, type ExtractedTable } from "@/lib/pdf/tables";
import { downloadBytes, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export function PdfToExcel() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [tables, setTables] = React.useState<ExtractedTable[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [exporting, setExporting] = React.useState(false);

  const file = files[0];

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setTables(null);
    setProgress(0);
    try {
      const found = await extractTables(file.bytes, {
        onProgress: (done, total) => setProgress((done / total) * 100),
      });
      setTables(found);
      if (found.length) {
        track("tool_complete", { tool: "pdf-to-excel", tables: found.length });
        recordCompletion(15);
      }
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The tables could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!tables?.length || !file) return;
    setExporting(true);
    try {
      const blob = await tablesToWorkbook(tables);
      downloadBytes(
        new Uint8Array(await blob.arrayBuffer()),
        `${file.name.replace(/\.pdf$/i, "")}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch {
      setError("The workbook could not be built.");
    } finally {
      setExporting(false);
    }
  };

  const averageConfidence = tables?.length
    ? tables.reduce((n, t) => n + t.confidence, 0) / tables.length
    : 0;

  return (
    <div className="space-y-4">
      <InfoNote icon="ℹ️">
        <strong>This reads tables from the text layer, using position.</strong> Every word in a PDF
        has x and y coordinates; rows are found by grouping words on the same baseline and columns by
        clustering their horizontal positions. That recovers ordinary ruled and aligned tables well.
        Merged cells, nested tables and cells spanning several lines are where it struggles — check
        the preview before you rely on it.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="📈"
          title="Drop a PDF containing tables"
          hint="Read on your device · nothing is uploaded"
        />
      ) : null}

      {loading ? <p className="text-sm font-extrabold text-[var(--muted)]">Reading…</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {file ? (
        <>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">
                📄 {file.name} · {file.pageCount} pages · {formatBytes(file.size)}
              </p>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  reset();
                  setTables(null);
                }}
              >
                Choose another
              </Button>
            </div>
            <Button tone="cherry" onClick={run} disabled={busy}>
              {busy ? "Finding tables…" : "Find tables"}
            </Button>
            {busy ? (
              <Progress className="mt-4" value={progress} tone="cherry" label="Scanning pages" />
            ) : null}
          </Card>

          {tables && tables.length === 0 ? (
            <ErrorState
              title="No tables found"
              message="No page had enough aligned columns to look like a table. If this PDF is a scan, it has no text layer at all — run it through PDF OCR first. If the data is laid out with images or unusual spacing, position-based detection cannot see it."
            />
          ) : null}

          {tables && tables.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Tables found" value={tables.length} tone="grass" />
                <Stat
                  label="Rows total"
                  value={tables.reduce((n, t) => n + t.rows.length, 0)}
                  tone="sky"
                />
                <Stat
                  label="Confidence"
                  value={`${Math.round(averageConfidence * 100)}%`}
                  tone={averageConfidence > 0.7 ? "grass" : averageConfidence > 0.45 ? "fire" : "cherry"}
                />
              </div>

              {averageConfidence < 0.6 ? (
                <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
                  ⚠️ Confidence is low, so the column alignment is probably imperfect. Check the
                  preview carefully and expect to tidy the spreadsheet afterwards.
                </p>
              ) : null}

              <SuccessNote>
                Found {tables.length} table{tables.length === 1 ? "" : "s"} — one sheet per page.
              </SuccessNote>

              <div className="space-y-3">
                {tables.slice(0, 4).map((table) => (
                  <Card key={table.page} className="overflow-hidden">
                    <h3 className="border-b-2 border-[var(--border)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      Page {table.page} · {table.rows.length} rows ·{" "}
                      {Math.round(table.confidence * 100)}% confidence
                    </h3>
                    <div className="do-scroll max-h-60 overflow-auto">
                      <table className="w-full text-left text-sm">
                        <tbody>
                          {table.rows.slice(0, 10).map((row, i) => (
                            <tr key={i} className="border-b border-[var(--border)]">
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className={`max-w-[200px] truncate px-3 py-1.5 ${i === 0 ? "font-extrabold" : "text-[var(--muted)]"}`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ))}
                {tables.length > 4 ? (
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    Showing the first 4 of {tables.length} tables. All of them are included in the
                    download.
                  </p>
                ) : null}
              </div>

              <Button tone="grass" onClick={download} disabled={exporting}>
                {exporting ? "Building…" : "Download .xlsx"}
              </Button>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="📈"
          title="No PDF yet"
          description="Add a PDF with tables in it and DO101 will try to recover them as a spreadsheet."
        />
      )}
    </div>
  );
}
