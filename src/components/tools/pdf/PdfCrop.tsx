"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Slider } from "@/components/ui/Field";
import { ErrorState, EmptyState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { renderPdfPages } from "@/lib/pdf/render";
import { cropPdf, downloadBytes, pdfName, PdfError, type CropMargins } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

const EDGES: Array<{ id: keyof CropMargins; label: string }> = [
  { id: "top", label: "Top" },
  { id: "right", label: "Right" },
  { id: "bottom", label: "Bottom" },
  { id: "left", label: "Left" },
];

export function PdfCrop() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [margins, setMargins] = React.useState<CropMargins>({ top: 5, right: 5, bottom: 5, left: 5 });
  const [preview, setPreview] = React.useState<{ url: string; width: number; height: number } | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Uint8Array | null>(null);

  const file = files[0];

  const previewRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    previewRef.current = preview?.url ?? null;
  }, [preview]);
  React.useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  // Render the first page once, as a guide for the margin sliders.
  React.useEffect(() => {
    if (!file) return;
    let cancelled = false;

    void (async () => {
      try {
        const [page] = await renderPdfPages(file.bytes, {
          scale: 1.1,
          format: "image/jpeg",
          quality: 0.8,
          pages: [0],
        });
        if (cancelled) {
          URL.revokeObjectURL(page.url);
          return;
        }
        setPreview({ url: page.url, width: page.width, height: page.height });
      } catch {
        if (!cancelled) setError("The first page could not be previewed, but cropping still works.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, setError]);

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = await cropPdf(file.bytes, {
        top: margins.top / 100,
        right: margins.right / 100,
        bottom: margins.bottom / 100,
        left: margins.left / 100,
      });
      setResult(bytes);
      track("tool_complete", { tool: "pdf-crop" });
      recordCompletion(10);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The document could not be cropped.");
    } finally {
      setBusy(false);
    }
  };

  const size = file?.sizes[0];
  const newWidth = size ? size.width * (1 - (margins.left + margins.right) / 100) : 0;
  const newHeight = size ? size.height * (1 - (margins.top + margins.bottom) / 100) : 0;

  return (
    <div className="space-y-4">
      <InfoNote icon="ℹ️">
        Cropping changes the visible page box, so text stays selectable and nothing is re-encoded.
        The trimmed content is <strong>hidden, not deleted</strong> — it still exists in the file. If
        you need it genuinely gone, use <a href="/tools/pdf-redact" className="underline">Redact PDF</a>.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="✂️"
          title="Drop the PDF you want to crop"
          hint="Cropped on your device · nothing is uploaded"
        />
      ) : null}

      {loading ? <p className="text-sm font-extrabold text-[var(--muted)]">Reading…</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {file ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="grid place-items-center p-5">
              {preview ? (
                <div
                  className="relative max-w-full"
                  style={{ width: Math.min(preview.width, 420) }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.url}
                    alt="First page preview"
                    className="w-full rounded-xl border-2 border-[var(--border)] bg-white"
                  />
                  {/* The kept region is the clear rectangle; everything else dims. */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{
                      boxShadow: "inset 0 0 0 9999px rgba(255,75,75,.22)",
                      clipPath: `polygon(
                        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                        ${margins.left}% ${margins.top}%,
                        ${margins.left}% ${100 - margins.bottom}%,
                        ${100 - margins.right}% ${100 - margins.bottom}%,
                        ${100 - margins.right}% ${margins.top}%,
                        ${margins.left}% ${margins.top}%
                      )`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-[var(--grass)]"
                    style={{
                      top: `${margins.top}%`,
                      left: `${margins.left}%`,
                      right: `${margins.right}%`,
                      bottom: `${margins.bottom}%`,
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm font-extrabold text-[var(--muted)]">Rendering preview…</p>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-extrabold">📄 {file.name}</p>
                <Button
                  size="sm"
                  tone="ghost"
                  onClick={() => {
                    reset();
                    setPreview(null);
                    setResult(null);
                  }}
                >
                  Change
                </Button>
              </div>

              <div className="space-y-4">
                {EDGES.map((edge) => (
                  <div key={edge.id}>
                    <Label htmlFor={`crop-${edge.id}`} hint={`${margins[edge.id]}%`}>
                      Trim from {edge.label.toLowerCase()}
                    </Label>
                    <Slider
                      id={`crop-${edge.id}`}
                      min={0}
                      max={45}
                      value={margins[edge.id]}
                      onChange={(e) =>
                        setMargins((m) => ({ ...m, [edge.id]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>

              {size ? (
                <p className="mt-4 rounded-xl bg-[var(--panel)] px-3 py-2 text-xs font-bold">
                  {Math.round(size.width)}×{Math.round(size.height)}pt →{" "}
                  {Math.round(newWidth)}×{Math.round(newHeight)}pt
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button tone="cherry" onClick={apply} disabled={busy}>
                  {busy ? "Cropping…" : "Crop all pages"}
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => setMargins({ top: 0, right: 0, bottom: 0, left: 0 })}
                >
                  Reset
                </Button>
              </div>
            </Card>
          </div>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>Cropped · {formatBytes(result.length)}</SuccessNote>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result, pdfName(file.name, "cropped"))}
              >
                Download PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="✂️"
          title="No PDF yet"
          description="Add a PDF and drag the margin sliders to trim whitespace or scan borders."
        />
      )}
    </div>
  );
}
