"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, EmptyState, Progress, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { parsePageRanges, describeSelection } from "@/lib/pdf/pages";
import { splitPdf, selectPages, downloadBytes, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

interface Part {
  label: string;
  bytes: Uint8Array;
}

export function PdfSplit() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [mode, setMode] = React.useState<"every" | "ranges">("every");
  const [every, setEvery] = React.useState(1);
  const [ranges, setRanges] = React.useState("1-2, 3-4");
  const [busy, setBusy] = React.useState(false);
  const [parts, setParts] = React.useState<Part[]>([]);

  const file = files[0];
  const baseName = file ? file.name.replace(/\.pdf$/i, "") : "document";

  const rangeGroups = React.useMemo(() => {
    if (!file || mode !== "ranges") return null;
    return ranges
      .split(",")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => ({ chunk, ...parsePageRanges(chunk, file.pageCount) }));
  }, [ranges, file, mode]);

  const rangeError = rangeGroups?.find((g) => g.error)?.error;

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setParts([]);
    try {
      if (mode === "every") {
        setParts(await splitPdf(file.bytes, { every }));
      } else {
        if (!rangeGroups?.length) throw new PdfError("Add at least one range, like 1-3.");
        const out: Part[] = [];
        for (const group of rangeGroups) {
          if (group.error) throw new PdfError(group.error);
          out.push({
            label: describeSelection(group.indices).replace(/[,\s]+/g, "_"),
            bytes: await selectPages(file.bytes, group.indices),
          });
        }
        setParts(out);
      }
      track("tool_complete", { tool: "pdf-split", mode });
      recordCompletion(10);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The document could not be split.");
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = async () => {
    // Bundled as a zip so a 40-page split is one download, not forty.
    const { zipSync } = await import("fflate");
    const entries: Record<string, Uint8Array> = {};
    parts.forEach((part, i) => {
      entries[`${baseName}-${String(i + 1).padStart(2, "0")}-${part.label}.pdf`] = part.bytes;
    });
    const zipped = zipSync(entries, { level: 0 });
    downloadBytes(zipped, `${baseName}-split.zip`, "application/zip");
    track("tool_complete", { tool: "pdf-split", action: "download-zip" });
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="✂️"
          title="Drop the PDF you want to split"
          hint="Split on your device · nothing is uploaded"
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
                  setParts([]);
                }}
              >
                Choose another
              </Button>
            </div>

            <Tabs
              ariaLabel="Split mode"
              value={mode}
              onChange={(v) => setMode(v as "every" | "ranges")}
              items={[
                { id: "every", label: "Every N pages" },
                { id: "ranges", label: "Custom ranges" },
              ]}
            />

            <div className="mt-4">
              {mode === "every" ? (
                <div className="max-w-xs">
                  <Label htmlFor="every">Pages per file</Label>
                  <Input
                    id="every"
                    type="number"
                    min={1}
                    max={file.pageCount}
                    value={every}
                    onChange={(e) =>
                      setEvery(Math.max(1, Math.min(file.pageCount, Number(e.target.value) || 1)))
                    }
                  />
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    Produces {Math.ceil(file.pageCount / every)} file
                    {Math.ceil(file.pageCount / every) === 1 ? "" : "s"}.
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="split-ranges">Ranges, separated by commas</Label>
                  <Input
                    id="split-ranges"
                    value={ranges}
                    onChange={(e) => setRanges(e.target.value)}
                    placeholder="1-2, 3-4, 5-"
                  />
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    Each range becomes its own PDF. Ranges may overlap.
                  </p>
                  {rangeError ? (
                    <p className="mt-2 rounded-xl bg-[var(--cherry-soft)] px-3 py-2 text-sm font-bold">
                      {rangeError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="cherry" onClick={run} disabled={busy || Boolean(rangeError)}>
                {busy ? "Splitting…" : "Split PDF"}
              </Button>
            </div>

            {busy ? <Progress className="mt-4" value={65} tone="cherry" label="Splitting" /> : null}
          </Card>

          {parts.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SuccessNote>
                  {parts.length} file{parts.length === 1 ? "" : "s"} ready.
                </SuccessNote>
                {parts.length > 1 ? (
                  <Button tone="grass" onClick={downloadAll}>
                    Download all as .zip
                  </Button>
                ) : null}
              </div>

              <ul className="grid gap-2 sm:grid-cols-2">
                {parts.map((part, i) => (
                  <li key={`${part.label}-${i}`}>
                    <Card className="flex items-center justify-between gap-3 p-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold">
                          {baseName}-{part.label}.pdf
                        </span>
                        <span className="text-xs font-semibold text-[var(--muted)]">
                          {formatBytes(part.bytes.length)}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        tone="panel"
                        onClick={() => downloadBytes(part.bytes, `${baseName}-${part.label}.pdf`)}
                      >
                        Download
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="✂️"
          title="No PDF yet"
          description="Add a PDF to split it into separate files."
        />
      )}
    </div>
  );
}
