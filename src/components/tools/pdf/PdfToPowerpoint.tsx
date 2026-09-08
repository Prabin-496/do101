"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { ErrorState, EmptyState, InfoNote, Progress, Stat, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { renderPdfPages } from "@/lib/pdf/render";
import { imagesToPptx } from "@/lib/docs/pptx";
import { downloadBytes, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

const PAGE_LIMIT = 100;

export function PdfToPowerpoint() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [scale, setScale] = React.useState(2);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<{ bytes: Uint8Array; slides: number } | null>(null);

  const file = files[0];

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      if (file.pageCount > PAGE_LIMIT) {
        throw new PdfError(
          `This document has ${file.pageCount} pages. The converter handles up to ${PAGE_LIMIT} slides per run — split it first.`,
        );
      }

      const rendered = await renderPdfPages(file.bytes, {
        scale,
        format: "image/jpeg",
        quality: 0.88,
        onProgress: (done, total) => setProgress((done / total) * 80),
      });

      try {
        const slides = await Promise.all(
          rendered.map(async (page) => ({
            bytes: new Uint8Array(await page.blob.arrayBuffer()),
            extension: "jpg" as const,
            widthPx: page.width,
            heightPx: page.height,
          })),
        );
        setProgress(90);
        const blob = await imagesToPptx(slides);
        setResult({ bytes: new Uint8Array(await blob.arrayBuffer()), slides: slides.length });
        setProgress(100);
        track("tool_complete", { tool: "pdf-to-powerpoint", slides: slides.length });
        recordCompletion(15);
      } finally {
        rendered.forEach((page) => URL.revokeObjectURL(page.url));
      }
    } catch (err) {
      setError(
        err instanceof PdfError ? err.message : "The presentation could not be built.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="ℹ️">
        <strong>Each page becomes a full-bleed picture on a slide.</strong> The deck opens in
        PowerPoint, Keynote and Google Slides and is perfect for presenting or annotating on top of.
        The text is <strong>not</strong> converted into editable text boxes — rebuilding a PDF page
        as editable shapes needs layout analysis a browser cannot do, and a converter that pretended
        otherwise would hand you a mangled deck.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="📊"
          title="Drop the PDF to turn into slides"
          hint="Converted on your device · nothing is uploaded"
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

            <div className="max-w-sm">
              <Label htmlFor="pptx-scale">Slide resolution</Label>
              <Select
                id="pptx-scale"
                value={String(scale)}
                onChange={(e) => setScale(Number(e.target.value))}
              >
                <option value="1.5">Standard — smallest file</option>
                <option value="2">High — good on a projector</option>
                <option value="3">Very high — large file</option>
              </Select>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                {file.pageCount} page{file.pageCount === 1 ? "" : "s"} → {file.pageCount} slide
                {file.pageCount === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="mt-4">
              <Button tone="cherry" onClick={run} disabled={busy}>
                {busy ? "Building slides…" : "Convert to PowerPoint"}
              </Button>
            </div>

            {busy ? (
              <Progress className="mt-4" value={progress} tone="cherry" label="Rendering pages" />
            ) : null}
          </Card>

          {result ? (
            <>
              <SuccessNote>
                {result.slides} slide{result.slides === 1 ? "" : "s"} ready ·{" "}
                {formatBytes(result.bytes.length)}
              </SuccessNote>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Slides" value={result.slides} tone="cherry" />
                <Stat label="File size" value={formatBytes(result.bytes.length)} tone="sky" />
              </div>
              <Button
                tone="grass"
                onClick={() =>
                  downloadBytes(
                    result.bytes,
                    `${file.name.replace(/\.pdf$/i, "")}.pptx`,
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                  )
                }
              >
                Download .pptx
              </Button>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="📊"
          title="No PDF yet"
          description="Add a PDF and every page becomes a slide you can present from."
        />
      )}
    </div>
  );
}
