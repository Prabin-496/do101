"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select, Slider } from "@/components/ui/Field";
import { ErrorState, EmptyState, Progress, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { renderPdfPages, type RenderedPage } from "@/lib/pdf/render";
import { downloadBytes, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

type Format = "image/png" | "image/jpeg" | "image/webp";

const EXT: Record<Format, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const DPI_OPTIONS = [
  { scale: 1, label: "72 DPI — small files" },
  { scale: 2, label: "144 DPI — good for screens" },
  { scale: 3, label: "216 DPI — sharp" },
  { scale: 4.17, label: "300 DPI — print quality" },
];

export function PdfToImages({ fixedFormat }: { fixedFormat?: Format }) {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [format, setFormat] = React.useState<Format>(fixedFormat ?? "image/png");
  const [scale, setScale] = React.useState(2);
  const [quality, setQuality] = React.useState(90);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [pages, setPages] = React.useState<RenderedPage[]>([]);

  const file = files[0];
  const baseName = file ? file.name.replace(/\.pdf$/i, "") : "page";
  const activeFormat = fixedFormat ?? format;

  // Rendered previews are object URLs, so they have to be released.
  const pagesRef = React.useRef<RenderedPage[]>([]);
  React.useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  React.useEffect(
    () => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  );

  const clearPages = React.useCallback(() => {
    pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
  }, []);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    clearPages();
    try {
      const rendered = await renderPdfPages(file.bytes, {
        scale,
        format: activeFormat,
        quality: quality / 100,
        onProgress: (done, total) => setProgress((done / total) * 100),
      });
      setPages(rendered);
      track("tool_complete", { tool: "pdf-to-images", format: EXT[activeFormat], pages: rendered.length });
      recordCompletion(15);
    } catch (err) {
      setError(
        err instanceof PdfError
          ? err.message
          : "The pages could not be rendered. Very large documents can exhaust the browser's memory.",
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadOne = async (page: RenderedPage) => {
    const bytes = new Uint8Array(await page.blob.arrayBuffer());
    downloadBytes(bytes, `${baseName}-p${page.page}.${EXT[activeFormat]}`, activeFormat);
  };

  const downloadAll = async () => {
    const { zipSync } = await import("fflate");
    const entries: Record<string, Uint8Array> = {};
    for (const page of pages) {
      entries[`${baseName}-p${String(page.page).padStart(3, "0")}.${EXT[activeFormat]}`] =
        new Uint8Array(await page.blob.arrayBuffer());
    }
    downloadBytes(zipSync(entries, { level: 0 }), `${baseName}-images.zip`, "application/zip");
  };

  const totalSize = pages.reduce((n, p) => n + p.blob.size, 0);

  return (
    <div className="space-y-4">
      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="🖼️"
          title="Drop the PDF you want as images"
          hint="Rendered on your device · nothing is uploaded"
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
                  clearPages();
                }}
              >
                Choose another
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dpi">Resolution</Label>
                <Select
                  id="dpi"
                  value={String(scale)}
                  onChange={(e) => setScale(Number(e.target.value))}
                >
                  {DPI_OPTIONS.map((option) => (
                    <option key={option.scale} value={option.scale}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              {!fixedFormat ? (
                <div>
                  <Label htmlFor="img-format">Image format</Label>
                  <Select
                    id="img-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as Format)}
                  >
                    <option value="image/png">PNG — lossless, larger</option>
                    <option value="image/jpeg">JPG — smaller, lossy</option>
                    <option value="image/webp">WebP — smallest</option>
                  </Select>
                </div>
              ) : null}

              {activeFormat !== "image/png" ? (
                <div className="sm:col-span-2">
                  <Label htmlFor="img-quality" hint={`${quality}%`}>
                    Quality
                  </Label>
                  <Slider
                    id="img-quality"
                    min={30}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </div>
              ) : null}
            </div>

            {file.pageCount > 50 ? (
              <p className="mt-4 rounded-xl bg-[var(--sun-soft)] px-3 py-2 text-xs font-bold">
                ⚠️ {file.pageCount} pages at this resolution will take a while and use a lot of
                memory. Consider extracting the pages you need first.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="cherry" onClick={run} disabled={busy}>
                {busy ? "Rendering…" : `Convert to ${EXT[activeFormat].toUpperCase()}`}
              </Button>
              {pages.length > 1 ? (
                <Button tone="grass" onClick={downloadAll}>
                  Download all as .zip
                </Button>
              ) : null}
            </div>

            {busy ? (
              <Progress className="mt-4" value={progress} tone="cherry" label="Rendering pages" />
            ) : null}
          </Card>

          {pages.length ? (
            <>
              <SuccessNote>
                {pages.length} image{pages.length === 1 ? "" : "s"} · {formatBytes(totalSize)} total
              </SuccessNote>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {pages.map((page) => (
                  <li key={page.page}>
                    <Card className="overflow-hidden p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page.url}
                        alt={`Page ${page.page}`}
                        loading="lazy"
                        className="h-40 w-full rounded-xl border-2 border-[var(--border)] object-contain"
                      />
                      <p className="mt-2 text-center text-xs font-extrabold">
                        Page {page.page}
                        <span className="block font-semibold text-[var(--muted)]">
                          {page.width}×{page.height} · {formatBytes(page.blob.size)}
                        </span>
                      </p>
                      <Button
                        size="sm"
                        tone="panel"
                        className="mt-2 w-full"
                        onClick={() => downloadOne(page)}
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
          icon="🖼️"
          title="No PDF yet"
          description="Add a PDF and every page becomes a downloadable image."
        />
      )}
    </div>
  );
}
