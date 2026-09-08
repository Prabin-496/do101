"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { ErrorState, EmptyState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import { imagesToPdf, downloadBytes, PdfError, type PageSize } from "@/lib/pdf/engine";
import { useIsHydrated } from "@/lib/utils/use-local";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

interface Shot {
  id: string;
  file: File;
  url: string;
}

/**
 * Uses the device camera to build a PDF from captured pages.
 *
 * getUserMedia needs a secure context and explicit permission, and the stream
 * is stopped the moment the camera is closed — no frame is kept beyond the
 * shots the visitor deliberately takes, and nothing is uploaded.
 */
export function ScanToPdf() {
  const [shots, setShots] = React.useState<Shot[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Uint8Array | null>(null);
  const [pageSize, setPageSize] = React.useState<PageSize>("a4");
  const [grayscale, setGrayscale] = React.useState(false);
  // Camera support can only be known in the browser, and the server render must
  // not disagree with the first client render — so it is read after hydration.
  const hydrated = useIsHydrated();
  const supported =
    !hydrated
      ? null
      : typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function";

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const shotsRef = React.useRef<Shot[]>([]);
  React.useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  React.useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
    },
    [],
  );

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // The rear camera is the useful one for documents.
          facingMode: { ideal: "environment" },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
      track("tool_open", { tool: "scan-to-pdf", action: "camera-start" });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera permission was refused. Allow it in your browser's site settings, then try again."
          : name === "NotFoundError"
            ? "No camera was found on this device. You can still build a PDF from photos with the Image to PDF tool."
            : "The camera could not be started. It may be in use by another app.",
      );
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    if (grayscale) {
      // A simple luminance pass; scans read better and compress far smaller.
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = luma;
      }
      ctx.putImageData(image, 0, 0);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;

    const file = new File([blob], `scan-${shots.length + 1}.jpg`, { type: "image/jpeg" });
    setShots((prev) => [...prev, { id: `${Date.now()}`, file, url: URL.createObjectURL(blob) }]);
  };

  const remove = (id: string) =>
    setShots((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((s) => s.id !== id);
    });

  const build = async () => {
    if (!shots.length) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await imagesToPdf(
        shots.map((s) => s.file),
        { pageSize, orientation: "auto", margin: pageSize === "fit" ? 0 : 18 },
      );
      setResult(bytes);
      track("tool_complete", { tool: "scan-to-pdf", pages: shots.length });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The PDF could not be built.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="📷">
        The camera stream stays on your device. Frames are only kept when you press capture, the
        camera is released as soon as you close it, and the finished PDF is built in this page —
        nothing is uploaded. Your browser will ask permission first.
      </InfoNote>

      {supported === false ? (
        <ErrorState
          title="No camera access in this browser"
          message="This browser does not expose a camera to web pages, or the page is not on a secure connection. You can still build the same PDF from photos you already have."
          action={
            <a href="/tools/image-to-pdf" className="do-btn do-btn-ghost px-4 py-2 text-xs">
              Use Image to PDF instead
            </a>
          }
        />
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <Card className="p-5">
        <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className={streaming ? "block max-h-[52vh] w-full object-contain" : "hidden"}
          />
          {!streaming ? (
            <div className="grid h-56 place-items-center text-center">
              <div>
                <span aria-hidden className="do-bob block text-5xl">
                  📷
                </span>
                <p className="mt-3 text-sm font-extrabold text-white/80">
                  The camera preview appears here
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!streaming ? (
            <Button tone="cherry" onClick={start} disabled={supported === false}>
              Open camera
            </Button>
          ) : (
            <>
              <Button tone="grass" size="lg" onClick={capture}>
                📸 Capture page
              </Button>
              <Button tone="ghost" onClick={stop}>
                Close camera
              </Button>
            </>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="scan-size">Page size</Label>
            <Select
              id="scan-size"
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
            >
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
              <option value="fit">Fit each photo exactly</option>
            </Select>
          </div>
          <Toggle
            checked={grayscale}
            onChange={setGrayscale}
            label="Capture in grayscale"
            description="Documents read better and the file is much smaller."
          />
        </div>
      </Card>

      {shots.length ? (
        <>
          <p className="text-sm font-extrabold">
            {shots.length} page{shots.length === 1 ? "" : "s"} captured
          </p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {shots.map((shot, i) => (
              <li key={shot.id}>
                <Card className="p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.url}
                    alt={`Captured page ${i + 1}`}
                    className="h-28 w-full rounded-xl border-2 border-[var(--border)] object-cover"
                  />
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold">{i + 1}</span>
                    <Button
                      size="sm"
                      tone="ghost"
                      aria-label={`Remove page ${i + 1}`}
                      onClick={() => remove(shot.id)}
                    >
                      ✕
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button tone="cherry" onClick={build} disabled={busy}>
              {busy ? "Building…" : `Create PDF (${shots.length} pages)`}
            </Button>
            <Button
              tone="ghost"
              onClick={() => {
                shots.forEach((s) => URL.revokeObjectURL(s.url));
                setShots([]);
                setResult(null);
              }}
            >
              Clear all
            </Button>
          </div>
        </>
      ) : (
        <EmptyState
          icon="📄"
          title="No pages captured yet"
          description="Open the camera, line up the page and press capture. Repeat for as many pages as you need."
        />
      )}

      {result ? (
        <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
          <SuccessNote>
            PDF ready — {shots.length} page{shots.length === 1 ? "" : "s"},{" "}
            {formatBytes(result.length)}
          </SuccessNote>
          <Button tone="grass" onClick={() => downloadBytes(result, "do101-scan.pdf")}>
            Download PDF
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
