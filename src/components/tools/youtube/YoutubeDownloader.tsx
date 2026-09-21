"use client";

import * as React from "react";
import Image from "next/image";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { ErrorState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import {
  CONTAINER_LABEL,
  availableContainers,
  defaultOption,
  isSilent,
  optionLabel,
  optionsFor,
  suggestedFilename,
  type Container,
  type MediaOption,
} from "@/lib/youtube/formats";
import { parseYouTubeUrl, watchUrl } from "@/lib/youtube/url";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

interface VideoInfo {
  videoId: string;
  title: string;
  author: string;
  authorUrl: string;
  thumbnail: string;
}

interface OptionsState {
  options: MediaOption[];
  provider: { id: string; name: string; termsUrl: string | null } | null;
  /** Set when the deployment has no provider, which is the shipped state. */
  notConfigured: string | null;
}

type Phase = "idle" | "looking-up" | "ready" | "downloading";

export function YoutubeDownloader() {
  const [url, setUrl] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [video, setVideo] = React.useState<VideoInfo | null>(null);
  const [formats, setFormats] = React.useState<OptionsState | null>(null);
  const [container, setContainer] = React.useState<Container | null>(null);
  const [optionId, setOptionId] = React.useState<string | null>(null);
  const [permitted, setPermitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const parsed = React.useMemo(() => parseYouTubeUrl(url), [url]);
  // A fresh [] each render would make every list below recompute forever.
  const options = React.useMemo(() => formats?.options ?? [], [formats]);
  const containers = React.useMemo(() => availableContainers(options), [options]);
  const shown = container ? optionsFor(options, container) : [];
  const chosen = shown.find((o) => o.id === optionId) ?? null;

  React.useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 3000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function reset() {
    setVideo(null);
    setFormats(null);
    setContainer(null);
    setOptionId(null);
    setError(null);
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      setError("Your browser would not let the page read the clipboard. Paste into the box instead.");
    }
  }

  async function lookUp(value: string) {
    const link = parseYouTubeUrl(value);
    if (!link) {
      setError("That does not look like a YouTube link. Paste one from youtube.com or youtu.be.");
      return;
    }

    reset();
    setPhase("looking-up");
    track("tool_open", { tool: "youtube-downloader" });

    try {
      const response = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(value)}`);
      const data = (await response.json()) as VideoInfo & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "That video could not be looked up.");
      setVideo({ ...data, videoId: link.videoId });

      // What can actually be downloaded is a separate question from what the
      // video is, so the answer is fetched separately and may well be "nothing".
      const formatsResponse = await fetch(`/api/youtube/options?id=${link.videoId}`);
      const formatsData = (await formatsResponse.json()) as {
        options?: MediaOption[];
        provider?: OptionsState["provider"];
        error?: string;
        code?: string;
      };

      if (formatsResponse.status === 501 || formatsData.code === "provider_not_configured") {
        setFormats({ options: [], provider: null, notConfigured: formatsData.error ?? "" });
      } else if (!formatsResponse.ok) {
        setFormats({ options: [], provider: null, notConfigured: null });
        setError(formatsData.error ?? "The download provider could not be reached.");
      } else {
        const list = formatsData.options ?? [];
        setFormats({ options: list, provider: formatsData.provider ?? null, notConfigured: null });
        const first = availableContainers(list)[0] ?? null;
        setContainer(first);
        setOptionId(first ? (defaultOption(list, first)?.id ?? null) : null);
      }
      setPhase("ready");
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "That video could not be looked up.");
    }
  }

  async function download() {
    if (!video || !chosen) return;
    setPhase("downloading");
    setError(null);
    try {
      const response = await fetch("/api/youtube/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId: video.videoId, optionId: chosen.id }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "That file could not be prepared.");

      const anchor = document.createElement("a");
      anchor.href = data.url;
      anchor.download = suggestedFilename(video.title, chosen);
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setFlash("Your download has started.");
      track("tool_complete", { tool: "youtube-downloader" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be prepared.");
    } finally {
      setPhase("ready");
    }
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------ the link ------------------------------ */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookUp(url);
        }}
        className="space-y-2"
      >
        <Label hint={parsed ? `Video ${parsed.videoId}` : undefined}>YouTube link</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            aria-label="YouTube link"
          />
          <div className="flex gap-2">
            <Button type="button" tone="panel" onClick={paste} className="shrink-0">
              Paste
            </Button>
            <Button type="submit" tone="grass" disabled={!parsed || phase === "looking-up"} className="shrink-0">
              {phase === "looking-up" ? "Looking up…" : "Check link"}
            </Button>
          </div>
        </div>
        {url && !parsed ? (
          <p className="text-xs font-semibold text-[var(--cherry)]">
            Not a YouTube link yet — paste one from youtube.com, youtu.be or a Shorts URL.
          </p>
        ) : null}
      </form>

      {error ? <ErrorState message={error} /> : null}
      {flash ? <SuccessNote>{flash}</SuccessNote> : null}

      {video ? (
        <>
          <VideoCard video={video} />

          <PermissionGate checked={permitted} onChange={setPermitted} />

          {/* --------------------------- media formats --------------------------- */}
          <section aria-labelledby="formats-heading" className="space-y-3">
            <h2 id="formats-heading" className="text-lg font-extrabold">
              Video and audio
            </h2>

            {formats?.notConfigured !== null && formats?.notConfigured !== undefined ? (
              <NotConfigured videoId={video.videoId} message={formats.notConfigured} />
            ) : containers.length === 0 ? (
              <InfoNote icon="ℹ️">
                The connected provider reported no downloadable formats for this video.
              </InfoNote>
            ) : (
              <>
                <div>
                  <Label>Format</Label>
                  <div className="flex flex-wrap gap-2">
                    {containers.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={container === value}
                        onClick={() => {
                          setContainer(value);
                          setOptionId(defaultOption(options, value)?.id ?? null);
                        }}
                        className={cn(
                          "rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors",
                          container === value
                            ? "border-[var(--grass)] bg-[var(--grass-soft)]"
                            : "border-[var(--border)] hover:bg-[var(--panel)]",
                        )}
                      >
                        {CONTAINER_LABEL[value]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label hint="only what this video actually has">Quality</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {shown.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={optionId === option.id}
                        onClick={() => setOptionId(option.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                          optionId === option.id
                            ? "border-[var(--grass)] bg-[var(--grass-soft)]"
                            : "border-[var(--border)] hover:bg-[var(--panel)]",
                        )}
                      >
                        <span className="text-sm font-extrabold">
                          {optionLabel(option)}
                          {isSilent(option) ? (
                            <span className="ml-2 rounded-md bg-[var(--fire-soft)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--fire-dark)]">
                              no sound
                            </span>
                          ) : null}
                        </span>
                        {option.approxBytes ? (
                          <span className="text-xs font-semibold text-[var(--muted)]">
                            {formatBytes(option.approxBytes)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  tone="grass"
                  size="lg"
                  className="w-full"
                  disabled={!permitted || !chosen || phase === "downloading"}
                  onClick={download}
                >
                  {phase === "downloading"
                    ? "Preparing your file…"
                    : chosen
                      ? `Download ${optionLabel(chosen)} ${chosen.container.toUpperCase()}`
                      : "Choose a format"}
                </Button>
                {!permitted ? (
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    Confirm you have the right to download this video first.
                  </p>
                ) : null}
                {formats?.provider ? (
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    Media served by {formats.provider.name}.{" "}
                    {formats.provider.termsUrl ? (
                      <a href={formats.provider.termsUrl} className="underline" rel="noopener nofollow" target="_blank">
                        Their terms
                      </a>
                    ) : null}
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section aria-labelledby="thumb-heading" className="space-y-2">
            <h2 id="thumb-heading" className="text-lg font-extrabold">
              Just want the cover image?
            </h2>
            <p className="text-sm font-semibold text-[var(--muted)]">
              DO101 has a tool for that, and it does the job better than this page could: every size
              the site publishes, re-encoded to PNG, WebP or JPG if you want, fetched straight from
              YouTube by your own browser.
            </p>
            <ButtonLink href="/tools/thumbnail-grabber" tone="sky" size="sm">
              Open the Thumbnail Grabber
            </ButtonLink>
          </section>

        </>
      ) : null}
    </div>
  );
}

function VideoCard({ video }: { video: VideoInfo }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4 sm:flex-row">
      {video.thumbnail ? (
        <Image
          src={video.thumbnail}
          alt=""
          width={240}
          height={135}
          unoptimized
          className="h-auto w-full rounded-xl border-2 border-[var(--border)] object-cover sm:w-60"
        />
      ) : null}
      <div className="min-w-0">
        <p className="text-base font-extrabold leading-snug">{video.title || "Untitled video"}</p>
        {video.author ? (
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{video.author}</p>
        ) : null}
        <a
          href={watchUrl(video.videoId)}
          target="_blank"
          rel="noopener"
          className="mt-2 inline-block text-xs font-extrabold text-[var(--sky)] underline"
        >
          Open on YouTube ↗
        </a>
      </div>
    </div>
  );
}

function PermissionGate({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors",
        checked ? "border-[var(--grass)] bg-[var(--grass-soft)]" : "border-[var(--fire)] bg-[var(--fire-soft)]",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--grass)]"
      />
      <span className="text-sm font-semibold">
        <strong className="block text-sm font-extrabold">
          I have the right to download this video.
        </strong>
        It is my own upload, it is public domain or openly licensed, or the rights holder has given
        me permission. Downloading someone else&rsquo;s video without permission infringes their
        copyright and breaks YouTube&rsquo;s Terms of Service.
      </span>
    </label>
  );
}

/**
 * The shipped state: no provider, said plainly, with the routes YouTube itself
 * supports rather than a dead button.
 */
function NotConfigured({ videoId, message }: { videoId: string; message: string }) {
  return (
    <div className="space-y-3 rounded-2xl border-2 border-[var(--sky)] bg-[var(--sky-soft)] p-4">
      <p className="text-sm font-extrabold">Video and audio downloads are not available here</p>
      <p className="text-sm font-semibold">
        {message ||
          "This DO101 deployment has no media download provider connected, so video and audio downloads are not available."}
      </p>
      <p className="text-sm font-semibold">
        YouTube serves its media behind access controls, and its Terms of Service do not permit
        working around them. DO101 will not do that, so there is no hidden ripper behind this page.
        These are the routes that do work:
      </p>
      <ul className="space-y-2">
        <li className="rounded-xl bg-[var(--bg)] px-3 py-2">
          <p className="text-sm font-extrabold">It is your own video</p>
          <p className="text-xs font-semibold text-[var(--muted)]">
            YouTube Studio has an official download for every video on your channel, at the
            resolution you uploaded.
          </p>
          <ButtonLink
            href="https://studio.youtube.com"
            tone="panel"
            size="sm"
            className="mt-2"
            target="_blank"
            rel="noopener"
          >
            Open YouTube Studio ↗
          </ButtonLink>
        </li>
        <li className="rounded-xl bg-[var(--bg)] px-3 py-2">
          <p className="text-sm font-extrabold">You want it offline on your phone</p>
          <p className="text-xs font-semibold text-[var(--muted)]">
            YouTube Premium downloads videos for offline playback inside the app, which is the
            supported way to watch without a connection.
          </p>
        </li>
        <li className="rounded-xl bg-[var(--bg)] px-3 py-2">
          <p className="text-sm font-extrabold">Someone else owns it</p>
          <p className="text-xs font-semibold text-[var(--muted)]">
            Ask them. Many creators will send you the original file, and a Creative Commons licence
            on a video still does not remove YouTube&rsquo;s own terms about how you get hold of it.
          </p>
        </li>
      </ul>
      <p className="text-xs font-semibold text-[var(--muted)]">
        Running DO101 yourself? The interface is wired to a provider interface — see{" "}
        <code className="rounded bg-[var(--panel)] px-1 py-0.5">src/lib/youtube/provider.ts</code>.
        Supply a lawful source and the selectors above come to life. Video id{" "}
        <code className="rounded bg-[var(--panel)] px-1 py-0.5">{videoId}</code>.
      </p>
    </div>
  );
}
