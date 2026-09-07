"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Slider } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, EmptyState, InfoNote, Progress, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { renderPdfPages, type RenderedPage } from "@/lib/pdf/render";
import { stampImage, downloadBytes, pdfName, PdfError, type StampPlacement } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

const PAGE_LIMIT = 30;

/** A small canvas the visitor draws their signature on with mouse or finger. */
function SignaturePad({
  onChange,
  color,
}: {
  onChange: (dataUrl: string | null) => void;
  color: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const dirty = React.useRef(false);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = point(event);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={640}
        height={220}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full cursor-crosshair touch-none rounded-2xl border-2 border-dashed border-[var(--border)] bg-white"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--muted)]">
          Draw with a mouse, trackpad or finger.
        </p>
        <Button size="sm" tone="ghost" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

export function PdfSign() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [pages, setPages] = React.useState<RenderedPage[]>([]);
  const [rendering, setRendering] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [source, setSource] = React.useState<"draw" | "upload">("draw");
  const [signature, setSignature] = React.useState<string | null>(null);
  const [inkColor, setInkColor] = React.useState("#12233a");
  const [width, setWidth] = React.useState(24);
  const [placements, setPlacements] = React.useState<StampPlacement[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Uint8Array | null>(null);

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
            `This document has ${file.pageCount} pages. Signing previews up to ${PAGE_LIMIT} — extract the page you need to sign first.`,
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

  const uploadSignature = async (uploaded: File[]) => {
    const image = uploaded[0];
    if (!image) return;
    if (!image.type.startsWith("image/")) {
      setError("Upload a PNG with a transparent background for the cleanest result.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSignature(String(reader.result));
    reader.readAsDataURL(image);
  };

  const place = (pageIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (!signature) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPlacements((prev) => [
      ...prev,
      {
        pageIndex,
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
        widthFraction: width / 100,
      },
    ]);
  };

  const apply = async () => {
    if (!file || !signature || !placements.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(signature);
      const pngBytes = await response.arrayBuffer();
      const bytes = await stampImage(file.bytes, pngBytes, placements);
      setResult(bytes);
      track("tool_complete", { tool: "pdf-sign", placements: placements.length });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The signature could not be applied.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="✍️">
        <strong>This places a visual signature, not a cryptographic one.</strong> It draws your
        signature image onto the page, which is what most everyday forms and agreements ask for. It
        does not create a digital certificate and cannot prove who signed — if you need a legally
        verifiable e-signature with an audit trail, use a dedicated e-signature service.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="✍️"
          title="Drop the PDF you need to sign"
          hint="Your document and signature never leave your device"
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
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">
                📄 {file.name} · {file.pageCount} page{file.pageCount === 1 ? "" : "s"}
              </p>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  reset();
                  setPages([]);
                  setPlacements([]);
                  setResult(null);
                }}
              >
                Choose another
              </Button>
            </div>

            <Tabs
              ariaLabel="Signature source"
              value={source}
              onChange={(v) => setSource(v as "draw" | "upload")}
              items={[
                { id: "draw", label: "Draw it" },
                { id: "upload", label: "Upload an image" },
              ]}
            />

            <div className="mt-4">
              {source === "draw" ? (
                <>
                  <div className="mb-3 flex items-center gap-3">
                    <Label htmlFor="ink" className="mb-0">
                      Ink colour
                    </Label>
                    <input
                      id="ink"
                      type="color"
                      value={inkColor}
                      onChange={(e) => setInkColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded-xl border-2 border-[var(--border)] bg-transparent"
                    />
                  </div>
                  <SignaturePad onChange={setSignature} color={inkColor} />
                </>
              ) : (
                <FileDrop
                  onFiles={uploadSignature}
                  accept="image/png,image/jpeg"
                  multiple={false}
                  icon="🖼️"
                  title="Drop a signature image"
                  hint="A PNG with a transparent background works best"
                />
              )}
            </div>

            {signature ? (
              <div className="mt-4">
                <Label htmlFor="sig-width" hint={`${width}% of page width`}>
                  Signature size
                </Label>
                <Slider
                  id="sig-width"
                  min={8}
                  max={60}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
                <p className="mt-2 rounded-xl bg-[var(--sky-soft)] px-3 py-2 text-sm font-bold">
                  ✍️ Now click on a page below to place it. Click a placed signature to remove it.
                </p>
              </div>
            ) : null}
          </Card>

          <div className="space-y-4">
            {pages.map((page, pageIndex) => (
              <Card key={page.page} className="p-3">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Page {page.page}
                </p>
                <div
                  className={`relative mx-auto max-w-2xl ${signature ? "cursor-copy" : ""}`}
                  onClick={(e) => place(pageIndex, e)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.url}
                    alt={`Page ${page.page}`}
                    draggable={false}
                    className="w-full rounded-xl border-2 border-[var(--border)] bg-white"
                  />
                  {placements
                    .map((placement, index) => ({ placement, index }))
                    .filter(({ placement }) => placement.pageIndex === pageIndex)
                    .map(({ placement, index }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={index}
                        src={signature ?? ""}
                        alt={`Signature ${index + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlacements((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute cursor-pointer"
                        style={{
                          left: `${placement.x * 100}%`,
                          top: `${placement.y * 100}%`,
                          width: `${placement.widthFraction * 100}%`,
                        }}
                      />
                    ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              tone="cherry"
              onClick={apply}
              disabled={busy || !signature || !placements.length}
            >
              {busy ? "Signing…" : `Apply signature (${placements.length})`}
            </Button>
            <Button
              tone="ghost"
              onClick={() => setPlacements([])}
              disabled={!placements.length}
            >
              Clear placements
            </Button>
          </div>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>Signed · {formatBytes(result.length)}</SuccessNote>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result, pdfName(file.name, "signed"))}
              >
                Download signed PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : null}

      {!file && !loading ? (
        <EmptyState
          icon="✍️"
          title="No PDF yet"
          description="Add a PDF, draw your signature, then click where it should go."
        />
      ) : null}
    </div>
  );
}
