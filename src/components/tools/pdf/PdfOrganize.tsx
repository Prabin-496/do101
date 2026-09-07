"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, EmptyState, Progress, SuccessNote } from "@/components/ui/Feedback";
import { renderPdfPages } from "@/lib/pdf/render";
import { usePdfFiles } from "./usePdfFile";
import { selectPages, rotatePages, downloadBytes, pdfName, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { cn } from "@/lib/utils/cn";

interface PageCard {
  /** Index in the original document. */
  source: number;
  url: string;
  rotation: 0 | 90 | 180 | 270;
  deleted: boolean;
}

const THUMBNAIL_LIMIT = 200;

/**
 * Visual page organiser: see every page as a thumbnail, then drag, rotate or
 * delete it. Far easier to get right than typing "3,1,2,7-9" into a box.
 */
export function PdfOrganize() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [pages, setPages] = React.useState<PageCard[]>([]);
  const [rendering, setRendering] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Uint8Array | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);

  const file = files[0];

  const urlsRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    urlsRef.current = pages.map((p) => p.url);
  }, [pages]);
  React.useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Thumbnails are generated once, when a document is loaded.
  React.useEffect(() => {
    if (!file) return;
    let cancelled = false;

    const run = async () => {
      setRendering(true);
      setProgress(0);
      setError(null);
      try {
        if (file.pageCount > THUMBNAIL_LIMIT) {
          throw new PdfError(
            `This document has ${file.pageCount} pages. The organiser previews up to ${THUMBNAIL_LIMIT} — split it first, or use the page tools that take ranges.`,
          );
        }
        const rendered = await renderPdfPages(file.bytes, {
          scale: 0.45,
          format: "image/jpeg",
          quality: 0.7,
          onProgress: (done, total) => !cancelled && setProgress((done / total) * 100),
        });
        if (cancelled) {
          rendered.forEach((p) => URL.revokeObjectURL(p.url));
          return;
        }
        setPages(
          rendered.map((p) => ({ source: p.page - 1, url: p.url, rotation: 0, deleted: false })),
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof PdfError ? err.message : "The pages could not be previewed.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [file, setError]);

  const kept = pages.filter((p) => !p.deleted);

  const move = (from: number, to: number) => {
    setPages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const update = (index: number, patch: Partial<PageCard>) =>
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const apply = async () => {
    if (!file || !kept.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Reorder and drop first, then apply rotations to the new positions.
      let bytes = await selectPages(file.bytes, kept.map((p) => p.source));

      const byAngle = new Map<number, number[]>();
      kept.forEach((page, index) => {
        if (page.rotation === 0) return;
        const list = byAngle.get(page.rotation) ?? [];
        list.push(index);
        byAngle.set(page.rotation, list);
      });
      for (const [angle, indices] of byAngle) {
        bytes = await rotatePages(
          bytes.slice().buffer as ArrayBuffer,
          indices,
          angle as 90 | 180 | 270,
        );
      }

      setResult(bytes);
      track("tool_complete", { tool: "pdf-organize", pages: kept.length });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The document could not be rebuilt.");
    } finally {
      setBusy(false);
    }
  };

  const deletedCount = pages.length - kept.length;
  const changed =
    deletedCount > 0 ||
    pages.some((p, i) => p.source !== i || p.rotation !== 0);

  return (
    <div className="space-y-4">
      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="🗂️"
          title="Drop the PDF you want to organise"
          hint="Every page is previewed so you can see what you are doing · nothing is uploaded"
        />
      ) : null}

      {loading ? <p className="text-sm font-extrabold text-[var(--muted)]">Reading…</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {rendering ? (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-extrabold">Rendering page previews…</p>
          <Progress value={progress} tone="cherry" />
        </Card>
      ) : null}

      {file && pages.length ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-extrabold">
              📄 {file.name} · {kept.length} of {pages.length} pages kept ·{" "}
              {formatBytes(file.size)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                tone="panel"
                onClick={() => setPages((prev) => prev.map((p) => ({ ...p, deleted: false })))}
                disabled={!deletedCount}
              >
                Restore deleted
              </Button>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  reset();
                  setPages([]);
                  setResult(null);
                }}
              >
                Choose another
              </Button>
            </div>
          </Card>

          <p className="text-xs font-semibold text-[var(--muted)]">
            Drag a page to move it, or use the arrows. Rotate and delete apply to that page only.
          </p>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pages.map((page, index) => (
              <li
                key={`${page.source}-${index}`}
                draggable
                onDragStart={() => setDragging(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging !== null && dragging !== index) move(dragging, index);
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
              >
                <Card
                  className={cn(
                    "p-2 transition-opacity",
                    page.deleted && "opacity-40",
                    dragging === index && "opacity-60",
                  )}
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.url}
                      alt={`Page ${page.source + 1}`}
                      loading="lazy"
                      className="h-40 w-full rounded-xl border-2 border-[var(--border)] bg-white object-contain transition-transform"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                    <span className="absolute left-1 top-1 rounded-lg bg-[var(--ink)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--bg)]">
                      {index + 1}
                      {page.source !== index ? ` (was ${page.source + 1})` : ""}
                    </span>
                    {page.deleted ? (
                      <span className="absolute inset-0 grid place-items-center rounded-xl bg-[var(--cherry-soft)]/80 text-sm font-extrabold">
                        Deleted
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-1">
                    <Button
                      size="sm"
                      tone="panel"
                      aria-label={`Move page ${index + 1} earlier`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      ←
                    </Button>
                    <Button
                      size="sm"
                      tone="panel"
                      aria-label={`Move page ${index + 1} later`}
                      disabled={index === pages.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      →
                    </Button>
                    <Button
                      size="sm"
                      tone="panel"
                      aria-label={`Rotate page ${index + 1}`}
                      onClick={() =>
                        update(index, {
                          rotation: (((page.rotation + 90) % 360) as 0 | 90 | 180 | 270),
                        })
                      }
                    >
                      ↻
                    </Button>
                    <Button
                      size="sm"
                      tone={page.deleted ? "grass" : "ghost"}
                      aria-label={
                        page.deleted ? `Restore page ${index + 1}` : `Delete page ${index + 1}`
                      }
                      onClick={() => update(index, { deleted: !page.deleted })}
                    >
                      {page.deleted ? "↺" : "✕"}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button tone="cherry" onClick={apply} disabled={busy || !kept.length || !changed}>
              {busy ? "Rebuilding…" : `Apply changes (${kept.length} pages)`}
            </Button>
            {!changed ? (
              <p className="self-center text-sm font-semibold text-[var(--muted)]">
                Move, rotate or delete a page to enable this.
              </p>
            ) : null}
          </div>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                Rebuilt with {kept.length} page{kept.length === 1 ? "" : "s"} ·{" "}
                {formatBytes(result.length)}
              </SuccessNote>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result, pdfName(file.name, "organised"))}
              >
                Download PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : null}

      {!file && !loading ? (
        <EmptyState
          icon="🗂️"
          title="No PDF yet"
          description="Add a PDF and every page appears as a thumbnail you can drag, rotate or delete."
        />
      ) : null}
    </div>
  );
}
