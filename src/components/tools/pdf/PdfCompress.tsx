"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select, Slider } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, EmptyState, Progress, Stat } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { compressPdf, type CompressResult, type CompressStrategy } from "@/lib/pdf/compress";
import { downloadBytes, pdfName, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export function PdfCompress() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [strategy, setStrategy] = React.useState<CompressStrategy>("optimize");
  const [quality, setQuality] = React.useState(60);
  const [scale, setScale] = React.useState(1.5);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<CompressResult | null>(null);

  const file = files[0];

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      setResult(
        await compressPdf(file.bytes, {
          strategy,
          quality: quality / 100,
          scale,
          onProgress: (done, total) => setProgress((done / total) * 100),
        }),
      );
      track("tool_complete", { tool: "pdf-compress", strategy });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "This PDF could not be compressed.");
    } finally {
      setBusy(false);
    }
  };

  const savedPct = result
    ? ((result.originalSize - result.newSize) / result.originalSize) * 100
    : 0;

  return (
    <div className="space-y-4">
      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="🗜️"
          title="Drop the PDF you want smaller"
          hint="Compressed on your device · nothing is uploaded"
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
                  setResult(null);
                }}
              >
                Choose another
              </Button>
            </div>

            <Tabs
              ariaLabel="Compression strategy"
              value={strategy}
              onChange={(v) => setStrategy(v as CompressStrategy)}
              items={[
                { id: "optimize", label: "Keep text (safe)" },
                { id: "rasterize", label: "Shrink hard (images)" },
              ]}
            />

            {strategy === "optimize" ? (
              <p className="mt-4 rounded-xl bg-[var(--sky-soft)] px-4 py-3 text-sm font-semibold">
                Rewrites the document structure with object streams. Text stays selectable and
                searchable. <strong>The saving is usually small</strong> — a few percent on a typical
                file, and sometimes none at all if the PDF is already well built.
              </p>
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-semibold">
                ⚠️ Re-renders every page as a JPEG image and rebuilds the PDF around it. This can
                shrink a scanned document enormously, but{" "}
                <strong>the text layer is destroyed</strong> — the result is a picture of your
                document, so text cannot be selected, searched or copied afterwards. Keep your
                original.
              </p>
            )}

            {strategy === "rasterize" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="c-quality" hint={`${quality}%`}>
                    Image quality
                  </Label>
                  <Slider
                    id="c-quality"
                    min={20}
                    max={95}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="c-scale">Resolution</Label>
                  <Select
                    id="c-scale"
                    value={String(scale)}
                    onChange={(e) => setScale(Number(e.target.value))}
                  >
                    <option value="1">72 DPI — smallest, screen only</option>
                    <option value="1.5">108 DPI — balanced</option>
                    <option value="2">144 DPI — sharper</option>
                    <option value="3">216 DPI — near print</option>
                  </Select>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="cherry" onClick={run} disabled={busy}>
                {busy ? "Compressing…" : "Compress PDF"}
              </Button>
            </div>

            {busy ? (
              <Progress
                className="mt-4"
                value={strategy === "rasterize" ? progress : 60}
                tone="cherry"
                label="Compressing"
              />
            ) : null}
          </Card>

          {result ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Before" value={formatBytes(result.originalSize)} />
                <Stat
                  label="After"
                  value={formatBytes(result.newSize)}
                  tone={result.grew ? "cherry" : "grass"}
                />
                <Stat
                  label={result.grew ? "Larger by" : "Saved"}
                  value={`${Math.abs(savedPct).toFixed(0)}%`}
                  tone={result.grew ? "cherry" : "grass"}
                />
              </div>

              {result.grew ? (
                <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
                  This PDF did not get smaller — it is already efficiently built. Keep your original,
                  or try the &ldquo;shrink hard&rdquo; mode if the text layer does not matter to you.
                </p>
              ) : null}

              {!result.textPreserved ? (
                <p className="rounded-2xl bg-[var(--sky-soft)] px-4 py-3 text-sm font-semibold">
                  Reminder: this output has no text layer. Text in it can no longer be selected or
                  searched.
                </p>
              ) : null}

              <Button
                tone="grass"
                onClick={() => downloadBytes(result.bytes, pdfName(file.name, "compressed"))}
              >
                Download compressed PDF
              </Button>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="🗜️"
          title="No PDF yet"
          description="Add a PDF and choose how aggressively to shrink it."
        />
      )}
    </div>
  );
}
