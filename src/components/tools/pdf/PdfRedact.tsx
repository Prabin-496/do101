"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, EmptyState, InfoNote, Progress, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { renderPdfPages, type RenderedPage } from "@/lib/pdf/render";
import { redactPdf, type RedactionBox } from "@/lib/pdf/redact";
import { downloadBytes, pdfName, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

const PAGE_LIMIT = 40;

export function PdfRedact() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [pages, setPages] = React.useState<RenderedPage[]>([]);
  const [boxes, setBoxes] = React.useState<RedactionBox[]>([]);
  const [rendering, setRendering] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Uint8Array | null>(null);
  const [drawing, setDrawing] = React.useState<{ page: number; start: [number, number]; current: [number, number] } | null>(null);

  const file = files[0];

  const pagesRef = React.useRef<RenderedPage[]>([]);
  React.useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  React.useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  React.useEffect(() => {
    if (!file) return;
    let cancelled = false;

    void (async () => {
      setRendering(true);
      setError(null);
      try {
        if (file.pageCount > PAGE_LIMIT) {
          throw new PdfError(
            `This document has ${file.pageCount} pages. Redaction previews up to ${PAGE_LIMIT} — extract the pages you need first.`,
          );
        }
        const rendered = await renderPdfPages(file.bytes, {
          scale: 1.2,
          format: "image/jpeg",
          quality: 0.8,
          onProgress: (done, total) => !cancelled && setProgress((done / total) * 100),
        });
        if (cancelled) {
          rendered.forEach((p) => URL.revokeObjectURL(p.url));
          return;
        }
        setPages(rendered);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof PdfError ? err.message : "The pages could not be previewed.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, setError]);

  /** Pointer position as a fraction of the page image. */
  const fraction = (event: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    ];
  };

  const finishBox = () => {
    if (!drawing) return;
    const [x1, y1] = drawing.start;
    const [x2, y2] = drawing.current;
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    // Ignore accidental taps.
    if (width > 0.01 && height > 0.005) {
      setBoxes((prev) => [
        ...prev,
        {
          pageIndex: drawing.page,
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width,
          height,
        },
      ]);
    }
    setDrawing(null);
  };

  const apply = async () => {
    if (!file || !boxes.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const output = await redactPdf(file.bytes, boxes, {
        onProgress: (done, total) => setProgress((done / total) * 100),
      });
      setResult(output.bytes);
      track("tool_complete", { tool: "pdf-redact", boxes: boxes.length });
      recordCompletion(20);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The redaction could not be applied.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="🛡️">
        <strong>This removes the text, not just the view of it.</strong> Drawing a black box in most
        PDF editors leaves the words underneath, where anyone can select or extract them — a mistake
        that has leaked real documents. DO101 flattens each page to an image with your areas painted
        out, so the original text objects are genuinely gone. The trade-off is that the output is an
        image: text elsewhere on the page is no longer selectable or searchable.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="🖍️"
          title="Drop the PDF you need to redact"
          hint="Never uploaded — redaction happens entirely on your device"
        />
      ) : null}

      {loading ? <p className="text-sm font-extrabold text-[var(--muted)]">Reading…</p> : null}
      {rendering ? (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-extrabold">Rendering pages…</p>
          <Progress value={progress} tone="cherry" />
        </Card>
      ) : null}
      {error ? <ErrorState message={error} /> : null}

      {file && pages.length ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-extrabold">
              📄 {file.name} · {boxes.length} area{boxes.length === 1 ? "" : "s"} marked
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" tone="panel" onClick={() => setBoxes([])} disabled={!boxes.length}>
                Clear marks
              </Button>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  reset();
                  setPages([]);
                  setBoxes([]);
                  setResult(null);
                }}
              >
                Choose another
              </Button>
            </div>
          </Card>

          <p className="text-xs font-semibold text-[var(--muted)]">
            Drag across anything that must be removed. Click a mark to delete it.
          </p>

          <div className="space-y-4">
            {pages.map((page, pageIndex) => (
              <Card key={page.page} className="p-3">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Page {page.page}
                </p>
                <div
                  className="relative mx-auto max-w-2xl touch-none select-none"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const point = fraction(e);
                    setDrawing({ page: pageIndex, start: point, current: point });
                  }}
                  onPointerMove={(e) => {
                    if (drawing?.page !== pageIndex) return;
                    setDrawing({ ...drawing, current: fraction(e) });
                  }}
                  onPointerUp={finishBox}
                  onPointerCancel={() => setDrawing(null)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.url}
                    alt={`Page ${page.page}`}
                    draggable={false}
                    className="w-full rounded-xl border-2 border-[var(--border)] bg-white"
                  />

                  {boxes
                    .map((box, index) => ({ box, index }))
                    .filter(({ box }) => box.pageIndex === pageIndex)
                    .map(({ box, index }) => (
                      <button
                        key={index}
                        type="button"
                        aria-label={`Remove redaction ${index + 1} on page ${page.page}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setBoxes((prev) => prev.filter((_, i) => i !== index))}
                        className="absolute cursor-pointer bg-black ring-2 ring-[var(--cherry)]"
                        style={{
                          left: `${box.x * 100}%`,
                          top: `${box.y * 100}%`,
                          width: `${box.width * 100}%`,
                          height: `${box.height * 100}%`,
                        }}
                      />
                    ))}

                  {drawing?.page === pageIndex ? (
                    <div
                      className="pointer-events-none absolute bg-black/70 ring-2 ring-[var(--cherry)]"
                      style={{
                        left: `${Math.min(drawing.start[0], drawing.current[0]) * 100}%`,
                        top: `${Math.min(drawing.start[1], drawing.current[1]) * 100}%`,
                        width: `${Math.abs(drawing.current[0] - drawing.start[0]) * 100}%`,
                        height: `${Math.abs(drawing.current[1] - drawing.start[1]) * 100}%`,
                      }}
                    />
                  ) : null}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button tone="cherry" onClick={apply} disabled={busy || !boxes.length}>
              {busy ? "Applying…" : `Redact and flatten (${boxes.length})`}
            </Button>
          </div>

          {busy ? <Progress value={progress} tone="cherry" label="Flattening pages" /> : null}

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                Redacted and flattened · {formatBytes(result.length)}
              </SuccessNote>
              <p className="rounded-xl bg-[var(--bg)] px-3 py-2 text-sm font-semibold">
                Open the result and try to select the redacted text — there is nothing there to
                select. Keep your original somewhere safe.
              </p>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result, pdfName(file.name, "redacted"))}
              >
                Download redacted PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : null}

      {!file && !loading ? (
        <EmptyState
          icon="🖍️"
          title="No PDF yet"
          description="Add a PDF, drag over the parts that must disappear, and download a version where they genuinely have."
        />
      ) : null}
    </div>
  );
}
