/**
 * What can be downloaded, and how it is described.
 *
 * The rule this file exists to enforce: the format and quality choices shown
 * to a visitor are only ever the ones a configured provider has actually
 * reported for that specific video. Nothing here invents a 4K option, or a
 * WAV option, because the interface has a button for it. If no provider is
 * configured there are no options, and the UI says so.
 */

export type Container = "mp4" | "mp3" | "wav";
export type MediaKind = "video" | "audio";

export interface MediaOption {
  /** The provider's own identifier for this exact rendition. */
  id: string;
  container: Container;
  kind: MediaKind;
  /** Video height in pixels, for video renditions only. */
  height?: number;
  /** Audio bitrate, for audio renditions only. */
  bitrateKbps?: number;
  /** Size in bytes when the provider knows it. Never estimated here. */
  approxBytes?: number;
  /** False for a video-only rendition that would download with no sound. */
  hasAudio?: boolean;
}

export const CONTAINER_LABEL: Record<Container, string> = {
  mp4: "MP4 video",
  mp3: "MP3 audio",
  wav: "WAV audio",
};

/**
 * The video heights this interface knows how to name.
 *
 * A provider is free to report others; anything not listed is still offered,
 * labelled by its raw height rather than dropped.
 */
export const KNOWN_HEIGHTS: { height: number; label: string }[] = [
  { height: 2160, label: "4K · 2160p" },
  { height: 1440, label: "1440p" },
  { height: 1080, label: "1080p" },
  { height: 720, label: "720p" },
  { height: 480, label: "480p" },
  { height: 360, label: "360p" },
  { height: 240, label: "240p" },
  { height: 144, label: "144p" },
];

export function heightLabel(height: number): string {
  return KNOWN_HEIGHTS.find((q) => q.height === height)?.label ?? `${height}p`;
}

export function optionLabel(option: MediaOption): string {
  if (option.kind === "video") {
    return option.height ? heightLabel(option.height) : "Video";
  }
  return option.bitrateKbps ? `${option.bitrateKbps} kbps` : CONTAINER_LABEL[option.container];
}

/** Containers a provider reported something for, in a stable order. */
export function availableContainers(options: MediaOption[]): Container[] {
  const order: Container[] = ["mp4", "mp3", "wav"];
  const present = new Set(options.map((o) => o.container));
  return order.filter((c) => present.has(c));
}

/**
 * The renditions for one container, best first.
 *
 * Video sorts by height, audio by bitrate, so the list reads the way people
 * expect a quality menu to read.
 */
export function optionsFor(options: MediaOption[], container: Container): MediaOption[] {
  return options
    .filter((o) => o.container === container)
    .sort((a, b) => (b.height ?? b.bitrateKbps ?? 0) - (a.height ?? a.bitrateKbps ?? 0));
}

/** The one to pre-select: the best rendition that still carries sound. */
export function defaultOption(options: MediaOption[], container: Container): MediaOption | null {
  const list = optionsFor(options, container);
  return list.find((o) => o.kind === "audio" || o.hasAudio !== false) ?? list[0] ?? null;
}

export function suggestedFilename(title: string, option: MediaOption): string {
  const stem =
    title
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .toLowerCase() || "video";
  const quality = option.kind === "video" && option.height ? `-${option.height}p` : "";
  return `${stem}${quality}.${option.container}`;
}

/**
 * A rendition that carries no audio track.
 *
 * Above 1080p, YouTube serves video and audio as separate streams, so a
 * provider that does not mux them will hand back a silent file. Saying so
 * before the download is the difference between a tool and a complaint.
 */
export function isSilent(option: MediaOption): boolean {
  return option.kind === "video" && option.hasAudio === false;
}
