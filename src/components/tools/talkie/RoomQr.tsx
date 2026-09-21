"use client";

import * as React from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { Button } from "@/components/ui/Button";
import { normalizeRoomCode } from "@/lib/talkie/protocol";

/**
 * Pulls a room code out of whatever a QR code said: an invite link with
 * `?room=`, or a bare code. Returns "" when it is neither.
 */
export function roomFromQrText(text: string): string {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const room = url.searchParams.get("room");
    return room ? normalizeRoomCode(room) : "";
  } catch {
    /* not a link — maybe a bare code */
  }
  const code = normalizeRoomCode(trimmed);
  return code.length >= 4 && code.length <= 8 ? code : "";
}

/** Decodes the first QR code in a drawable, or returns null. */
function decode(ctx: CanvasRenderingContext2D, width: number, height: number): string | null {
  const image = ctx.getImageData(0, 0, width, height);
  return jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/* ------------------------------ showing one ------------------------------ */

/**
 * The invite link as a QR code, with ways to hand it on: scan it off the
 * screen, save it as a picture, or send it through the phone's share sheet.
 */
export function RoomQr({ room, link }: { room: string; link: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [shareNote, setShareNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !link) return;
    // Drawn straight onto the canvas so there is no state to set here.
    void QRCode.toCanvas(canvas, link, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 480,
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then(() => {
        // qrcode pins an inline pixel size; let the classes size it instead.
        canvas.style.width = "";
        canvas.style.height = "";
      })
      .catch(() => {});
  }, [link]);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/png");
    });

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talkiegenz-${room}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    setShareNote(null);
    const text = `Join my TalkieGenZ channel — code ${room}`;
    try {
      const blob = await toBlob();
      const file = blob ? new File([blob], `talkiegenz-${room}.png`, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "TalkieGenZ",
          text: `${text}\n${link}`,
          files: [file],
        });
      } else if (typeof navigator.share === "function") {
        await navigator.share({ title: "TalkieGenZ", text, url: link });
      } else {
        await navigator.clipboard.writeText(`${text}\n${link}`);
        setShareNote("No share sheet here, so the invite was copied instead.");
      }
    } catch (err) {
      // Closing the share sheet is not an error worth showing.
      if (err instanceof Error && err.name === "AbortError") return;
      setShareNote("Sharing did not work here. Save the QR picture or copy the link instead.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`QR code that joins channel ${room}`}
        className="h-44 w-44 shrink-0 rounded-2xl border-2 border-[var(--border)] bg-white"
      />
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-sm font-extrabold">Scan to join</p>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
          Friends point their phone camera at this, or you send them the picture. Opening it drops
          them straight into channel <span className="font-mono">{room}</span>.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button tone="grape" size="sm" onClick={share}>
            Share QR
          </Button>
          <Button tone="panel" size="sm" onClick={download}>
            Save picture
          </Button>
        </div>
        {shareNote ? (
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">{shareNote}</p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ reading one ------------------------------ */

type ScanState = "starting" | "scanning" | "error";

/**
 * Reads a room QR code with the camera, or from a saved picture of one.
 * Calls `onCode` once with the room code it found.
 */
export function RoomQrScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<ScanState>("starting");
  const [message, setMessage] = React.useState<string | null>(null);

  // The latest callback, without restarting the camera when it changes.
  const onCodeRef = React.useRef(onCode);
  React.useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState >= 2 && video.videoWidth) {
        // A smaller frame decodes faster and QR codes survive the downscale.
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const text = decode(ctx, canvas.width, canvas.height);
        const code = text ? roomFromQrText(text) : "";
        if (code) {
          stopped = true;
          onCodeRef.current(code);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const start = async () => {
      if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
        setState("error");
        setMessage("This browser cannot use the camera. Upload a picture of the QR code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setState("scanning");
        frame = requestAnimationFrame(tick);
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        setState("error");
        setMessage(
          name === "NotAllowedError"
            ? "Camera permission was refused. Upload a picture of the QR code instead, or type the code."
            : name === "NotFoundError"
              ? "No camera was found. Upload a picture of the QR code instead."
              : "The camera could not be started. Upload a picture of the QR code instead.",
        );
      }
    };
    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const readFile = async (file: File) => {
    setMessage(null);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const text = decode(ctx, canvas.width, canvas.height);
      const code = text ? roomFromQrText(text) : "";
      if (code) onCodeRef.current(code);
      else setMessage("No TalkieGenZ QR code was found in that picture.");
    } catch {
      setMessage("That file could not be read as a picture.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
          aria-label="Camera view for scanning a QR code"
        />
        {state === "scanning" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80"
          />
        ) : null}
        {state !== "scanning" ? (
          <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm font-extrabold text-white/80">
            {state === "starting" ? "Starting the camera…" : "📷 No camera"}
          </p>
        ) : null}
      </div>

      <p className="text-xs font-semibold text-[var(--muted)]">
        {message ??
          (state === "scanning"
            ? "Hold the QR code inside the square. It joins as soon as it reads."
            : "The camera picture never leaves your device.")}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void readFile(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button tone="panel" size="sm" onClick={() => fileRef.current?.click()}>
          Upload QR picture
        </Button>
        <Button tone="ghost" size="sm" onClick={onClose}>
          Type the code instead
        </Button>
      </div>
    </div>
  );
}
