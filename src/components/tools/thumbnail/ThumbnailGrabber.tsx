"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import { failureMessage, parseSource, type Source } from "@/lib/thumbnail/sources";
import { fileName, type Meta } from "@/lib/thumbnail/providers";
import { GrabError, dedupe, grab, type Cover } from "@/lib/thumbnail/grab";
import {
  FORMAT_LABEL,
  aspectLabel,
  convert,
  copyImage,
  downloadBlob,
  extensionFor,
  formatBytes,
  type ImageFormat,
} from "@/lib/thumbnail/image";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { cn } from "@/lib/utils/cn";

interface Loaded {
  source: Source;
  meta: Meta | null;
  covers: Cover[];
}

const FORMATS: ImageFormat[] = ["original", "png", "webp", "jpeg"];

export function ThumbnailGrabber() {
  const [input, setInput] = React.useState("");
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [format, setFormat] = React.useState<ImageFormat>("original");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const completed = React.useRef(false);
  const requestId = React.useRef(0);

  // One object URL per cover, released when the set is replaced.
  const previews = React.useMemo(
    () => (loaded ? loaded.covers.map((cover) => URL.createObjectURL(cover.blob)) : []),
    [loaded],
  );
  React.useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  React.useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  async function run(raw: string) {
    const parsed = parseSource(raw);
    if (!parsed.ok) {
      setError(failureMessage(parsed.failure));
      setLoaded(null);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const { meta, covers } = await grab(parsed.source);
      if (id !== requestId.current) return;
      setLoaded({ source: parsed.source, meta, covers: dedupe(covers) });
      if (!completed.current) {
        completed.current = true;
        track("tool_complete", { tool: "thumbnail-grabber" });
        recordCompletion();
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setLoaded(null);
      setError(
        err instanceof GrabError
          ? err.message
          : "Could not reach the image server. Check your connection and try again.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      setInput(text);
      await run(text);
    } catch {
      setError("This browser would not let the page read your clipboard. Paste into the box instead.");
    }
  }

  async function save(cover: Cover) {
    setBusyKey(cover.candidate.key);
    try {
      const blob =
        format === "original" ? cover.blob : await convert(cover.blob, format);
      const name = fileName(
        loaded!.source,
        loaded!.meta,
        cover.candidate.key,
        extensionFor(format, blob),
      );
      downloadBlob(blob, name);
      setFlash(`Saved ${name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image could not be saved.");
    } finally {
      setBusyKey(null);
    }
  }

  async function copy(cover: Cover) {
    setBusyKey(cover.candidate.key);
    try {
      await copyImage(cover.blob);
      setFlash("Copied — paste it anywhere.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image could not be copied.");
    } finally {
      setBusyKey(null);
    }
  }

  const biggest = loaded?.covers[0];

  return (
    <div className="space-y-3">
      {/* ------------------------------- the link ------------------------------ */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run(input);
          }}
          placeholder="Paste a YouTube or Vimeo link…"
          aria-label="Video link"
          spellCheck={false}
          className="min-w-[14rem] flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--sky)]"
        />
        <Button tone="panel" size="sm" onClick={() => void pasteFromClipboard()}>
          Paste
        </Button>
        <Button tone="grass" size="sm" disabled={loading} onClick={() => void run(input)}>
          {loading ? "Fetching…" : "Get covers"}
        </Button>
        {loaded ? (
          <Button
            tone="panel"
            size="sm"
            onClick={() => {
              setInput("");
              setLoaded(null);
              setError(null);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {error ? <ErrorState message={error} /> : null}
      {flash ? <SuccessNote>{flash}</SuccessNote> : null}

      {/* -------------------------------- empty -------------------------------- */}
      {!loaded && !loading && !error ? (
        <section className="rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--panel)] px-4 py-10 text-center">
          <p className="text-4xl" aria-hidden>
            🖼
          </p>
          <h2 className="mt-2 text-xl font-extrabold">Grab the cover image off a video</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm font-semibold text-[var(--muted)]">
            Paste a YouTube or Vimeo link and you get every size of its cover image, straight from
            the source, at full resolution. Shorts work too.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-xs font-semibold text-[var(--muted)]">
            The images are fetched by your browser from the video site itself — the link never
            reaches a DO101 server, because there isn&rsquo;t one.
          </p>
        </section>
      ) : null}

      {loading && !loaded ? (
        <div
          className="grid place-items-center rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] px-4 py-16"
          role="status"
        >
          <p className="text-sm font-extrabold text-[var(--muted)]">Looking for covers…</p>
        </div>
      ) : null}

      {/* ------------------------------- results ------------------------------- */}
      {loaded ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="min-w-[12rem]">
              <h2 className="text-lg font-extrabold leading-snug sm:text-xl">
                {loaded.meta?.title || "Cover images"}
              </h2>
              <p className="text-xs font-semibold text-[var(--muted)]">
                {loaded.meta?.author ? (
                  <>
                    by{" "}
                    {loaded.meta.authorUrl ? (
                      <a
                        className="underline"
                        href={loaded.meta.authorUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {loaded.meta.author}
                      </a>
                    ) : (
                      loaded.meta.author
                    )}{" "}
                    ·{" "}
                  </>
                ) : null}
                <a
                  className="underline"
                  href={loaded.source.canonical}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  open the video
                </a>
                {" · "}
                {loaded.covers.length} size{loaded.covers.length === 1 ? "" : "s"} available
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-1">
              <span className="pl-2 pr-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Save as
              </span>
              {FORMATS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={format === option}
                  onClick={() => setFormat(option)}
                  title={
                    option === "original"
                      ? "The provider's own file, byte for byte — nothing re-encoded"
                      : `Re-encode as ${FORMAT_LABEL[option]}`
                  }
                  className={cn(
                    "rounded-xl border-2 px-2.5 py-1.5 text-xs font-extrabold transition-colors",
                    format === option
                      ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                      : "border-transparent text-[var(--muted)] hover:bg-[var(--bg)]",
                  )}
                >
                  {option === "original" ? "Original" : FORMAT_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          {format !== "original" ? (
            <InfoNote icon="ℹ️">
              {FORMAT_LABEL[format]} is re-encoded from the original JPEG in your browser. For the
              sharpest result, and the smallest file, keep <strong>Original</strong>.
            </InfoNote>
          ) : null}

          {biggest && biggest.width < 1280 ? (
            <InfoNote icon="ℹ️">
              The largest cover this video has is {biggest.width}×{biggest.height}. YouTube only
              generates a 1280×720 version for videos uploaded in HD, so there is no bigger one to
              find — anything larger has been upscaled by someone else.
            </InfoNote>
          ) : null}

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loaded.covers.map((cover, index) => {
              const aspect = aspectLabel(cover.width, cover.height);
              const busy = busyKey === cover.candidate.key;
              return (
                <li
                  key={cover.candidate.key}
                  className="flex flex-col overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)]"
                >
                  <div className="grid place-items-center bg-[var(--panel-2)] p-2">
                    {/* Object URLs from the fetched blob, so nothing loads twice. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previews[index]}
                      alt={`${cover.candidate.label} cover, ${cover.width} by ${cover.height} pixels`}
                      width={cover.width}
                      height={cover.height}
                      className="h-36 w-full rounded-lg object-contain"
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div>
                      <p className="text-sm font-extrabold">
                        {cover.candidate.label}
                        <span className="ml-2 font-bold tabular-nums text-[var(--muted)]">
                          {cover.width}×{cover.height}
                        </span>
                      </p>
                      <p className="text-xs font-semibold text-[var(--muted)]">
                        {formatBytes(cover.bytes)}
                        {aspect ? ` · ${aspect}` : ""}
                        {cover.candidate.note ? ` · ${cover.candidate.note}` : ""}
                      </p>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <Button
                        tone="grass"
                        size="sm"
                        disabled={busy}
                        onClick={() => void save(cover)}
                        className="col-span-2"
                      >
                        {busy ? "Working…" : "Download"}
                      </Button>
                      <Button tone="panel" size="sm" disabled={busy} onClick={() => void copy(cover)}>
                        Copy image
                      </Button>
                      <Button
                        tone="panel"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(cover.candidate.url)
                            .then(() => setFlash("Image address copied."))
                            .catch(() => setError("This browser would not let the page use the clipboard."));
                        }}
                      >
                        Copy link
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="px-1 text-xs font-semibold text-[var(--muted)]">
            A cover image belongs to whoever made the video. Saving one here does not give you the
            right to republish it — credit the channel, and get permission before using it
            commercially or as your own artwork.
          </p>
        </div>
      ) : null}
    </div>
  );
}
