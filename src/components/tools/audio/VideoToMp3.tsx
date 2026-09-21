"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button, buttonClass } from "@/components/ui/Button";
import { FileDrop } from "@/components/ui/FileDrop";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { ErrorState, InfoNote, Progress, SuccessNote } from "@/components/ui/Feedback";
import {
  BITRATES,
  DEFAULT_BITRATE,
  EncodeCancelled,
  MAX_BYTES,
  TARGET_SAMPLE_RATE,
  WARN_BYTES,
  describeDecodeError,
  encodeMp3,
  estimateBytes,
  formatBytes,
  formatTime,
  mp3Name,
  resolveTrim,
  type Bitrate,
} from "@/lib/audio/mp3";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

type Phase = "idle" | "decoding" | "ready" | "encoding" | "done";

interface Decoded {
  channels: Float32Array[];
  sampleRate: number;
  duration: number;
}

interface Result {
  url: string;
  name: string;
  size: number;
  seconds: number;
}

const ACCEPT =
  "video/*,audio/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.mp3";

const BITRATE_NOTES: Record<Bitrate, string> = {
  128: "Smallest · fine for speech",
  192: "Recommended",
  256: "High quality",
  320: "Best · largest file",
};

/** Decodes any audio the browser understands, resampled to 44.1 kHz. */
async function decodeAudioFile(file: File): Promise<Decoded> {
  const data = await file.arrayBuffer();
  // An offline context needs no speakers and no tap to start, and it
  // resamples whatever it decodes to its own rate.
  const context = new OfflineAudioContext(1, 1, TARGET_SAMPLE_RATE);
  const buffer = await context.decodeAudioData(data);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  return { channels, sampleRate: buffer.sampleRate, duration: buffer.duration };
}

export function VideoToMp3() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [kbps, setKbps] = React.useState<Bitrate>(DEFAULT_BITRATE);
  const [mono, setMono] = React.useState(false);
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /** The decoded samples can be hundreds of megabytes, so they live outside state. */
  const decodedRef = React.useRef<Decoded | null>(null);
  const cancelRef = React.useRef(false);
  /** Every object URL made, so none outlive the page. */
  const urlsRef = React.useRef<string[]>([]);

  React.useEffect(
    () => () => {
      cancelRef.current = true;
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const makeUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  };

  const releaseUrl = (url: string | null | undefined) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    urlsRef.current = urlsRef.current.filter((u) => u !== url);
  };

  const reset = () => {
    cancelRef.current = true;
    decodedRef.current = null;
    releaseUrl(sourceUrl);
    releaseUrl(result?.url);
    setFile(null);
    setSourceUrl(null);
    setResult(null);
    setError(null);
    setStart("");
    setEnd("");
    setDuration(0);
    setProgress(0);
    setPhase("idle");
  };

  const pick = async (files: File[]) => {
    const chosen = files[0];
    if (!chosen) return;
    reset();
    if (chosen.size > MAX_BYTES) {
      setError(
        `That file is ${formatBytes(chosen.size)}. Browsers cannot hold more than about 2 GB in memory, so trim or compress the video first.`,
      );
      return;
    }

    cancelRef.current = false;
    setFile(chosen);
    setSourceUrl(makeUrl(chosen));
    setPhase("decoding");
    track("tool_open", { tool: "video-to-mp3", action: "file" });

    try {
      const decoded = await decodeAudioFile(chosen);
      if (cancelRef.current) return;
      decodedRef.current = decoded;
      setDuration(decoded.duration);
      setPhase("ready");
    } catch (err) {
      if (cancelRef.current) return;
      const outOfMemory = err instanceof RangeError || (err instanceof Error && /memory/i.test(err.message));
      setError(
        outOfMemory
          ? "Your browser ran out of memory reading this file. Try a shorter video, or close other tabs and retry."
          : describeDecodeError(chosen.name),
      );
      setPhase("idle");
    }
  };

  const trim = duration ? resolveTrim(start, end, duration) : null;
  const seconds = trim?.ok ? trim.end - trim.start : 0;

  const convert = async () => {
    const decoded = decodedRef.current;
    if (!decoded || !file || !trim?.ok) return;
    cancelRef.current = false;
    releaseUrl(result?.url);
    setResult(null);
    setError(null);
    setProgress(0);
    setPhase("encoding");

    try {
      const parts = await encodeMp3({
        channels: decoded.channels,
        sampleRate: decoded.sampleRate,
        kbps,
        mono,
        start: trim.start,
        end: trim.end,
        onProgress: (f) => setProgress(f * 100),
        cancelled: () => cancelRef.current,
      });
      const blob = new Blob(parts as BlobPart[], { type: "audio/mpeg" });
      setResult({ url: makeUrl(blob), name: mp3Name(file.name), size: blob.size, seconds: trim.end - trim.start });
      setPhase("done");
      track("tool_complete", { tool: "video-to-mp3", kbps, mono });
    } catch (err) {
      if (err instanceof EncodeCancelled) {
        setPhase("ready");
        return;
      }
      setError("Encoding failed part-way through. Try a lower quality or a shorter section.");
      setPhase("ready");
    }
  };

  const isVideo = file?.type.startsWith("video/") ?? false;
  const busy = phase === "decoding" || phase === "encoding";

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDrop
          onFiles={pick}
          accept={ACCEPT}
          multiple={false}
          icon="🎵"
          title="Drop a video or audio file"
          hint="MP4, MOV, WebM, M4A, WAV and more — it never leaves your device"
        />
        {error ? <ErrorState message={error} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {formatBytes(file.size)}
              {duration ? ` · ${formatTime(duration)} long` : ""}
            </p>
          </div>
          <Button tone="ghost" size="sm" onClick={reset}>
            Choose another file
          </Button>
        </div>

        {sourceUrl ? (
          isVideo ? (
            <video
              src={sourceUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-72 w-full rounded-2xl bg-black"
            />
          ) : (
            <audio src={sourceUrl} controls preload="metadata" className="w-full" />
          )
        ) : null}

        {file.size > WARN_BYTES && phase === "decoding" ? (
          <InfoNote icon="⏳">
            This is a big file. Reading it can take a minute and a lot of memory — keep this tab in
            front until it finishes.
          </InfoNote>
        ) : null}

        {phase === "decoding" ? (
          <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-extrabold text-[var(--muted)]">
            <span className="do-bob inline-block">🎧</span> Reading the audio track…
          </p>
        ) : null}
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {duration ? (
        <Card className="space-y-5 p-4 sm:p-5">
          <fieldset>
            <legend className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Quality
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BITRATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={kbps === rate}
                  onClick={() => setKbps(rate)}
                  disabled={busy}
                  className={cn(
                    "rounded-2xl border-2 px-3 py-2.5 text-left transition-colors",
                    kbps === rate
                      ? "border-[var(--grass)] bg-[var(--grass-soft)]"
                      : "border-[var(--border)] hover:bg-[var(--panel)]",
                  )}
                >
                  <span className="block text-sm font-extrabold">{rate} kbps</span>
                  <span className="block text-[11px] font-semibold text-[var(--muted)]">
                    {BITRATE_NOTES[rate]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="mp3-start" hint="optional">
                Start at
              </Label>
              <Input
                id="mp3-start"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                placeholder="0:00"
                inputMode="decimal"
                autoComplete="off"
                disabled={busy}
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="mp3-end" hint="optional">
                End at
              </Label>
              <Input
                id="mp3-end"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                placeholder={formatTime(duration)}
                inputMode="decimal"
                autoComplete="off"
                disabled={busy}
                className="font-mono"
              />
            </div>
          </div>

          <Toggle
            checked={mono}
            onChange={setMono}
            label="Mono"
            description="One channel instead of two. Half the size, and all a lecture, podcast or voice note needs."
          />

          {trim && !trim.ok ? (
            <p className="text-sm font-extrabold text-[var(--cherry)]">{trim.error}</p>
          ) : (
            <p className="text-sm font-semibold text-[var(--muted)]">
              {formatTime(seconds)} of audio → about{" "}
              <strong className="text-[var(--ink)]">{formatBytes(estimateBytes(seconds, kbps))}</strong> MP3
            </p>
          )}

          {phase === "encoding" ? (
            <div className="space-y-3">
              <Progress value={progress} label="Converting to MP3" />
              <Button tone="panel" size="sm" onClick={() => (cancelRef.current = true)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              tone="grass"
              size="lg"
              className="w-full"
              onClick={convert}
              disabled={!trim?.ok || busy}
            >
              {phase === "done" ? "Convert again with these settings" : "Convert to MP3"}
            </Button>
          )}
        </Card>
      ) : null}

      {result ? (
        <Card className="space-y-4 p-4 sm:p-5">
          <SuccessNote>
            Your MP3 is ready — {formatTime(result.seconds)}, {formatBytes(result.size)}.
          </SuccessNote>
          <audio src={result.url} controls className="w-full" />
          <a href={result.url} download={result.name} className={buttonClass("sky", "lg", "w-full text-center")}>
            ⬇️ Download {result.name}
          </a>
        </Card>
      ) : null}
    </div>
  );
}
