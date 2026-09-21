/**
 * Reading a YouTube link.
 *
 * People paste every shape of YouTube URL there is — a share link, a shorts
 * link, a link with a timestamp, a link copied out of a playlist, sometimes
 * just the id on its own. All of them are accepted, and anything that is not
 * a YouTube link is rejected clearly rather than half-handled.
 */

export type LinkKind = "video" | "short" | "live" | "embed";

export interface YouTubeLink {
  videoId: string;
  kind: LinkKind;
  /** Present when the link pointed at a moment in the video. */
  startSeconds?: number;
  /** Present when the link was copied from inside a playlist. */
  playlistId?: string;
}

/** YouTube ids are exactly eleven URL-safe characters. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{12,42}$/;

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

export function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

/**
 * Timestamps arrive as `90`, `90s`, or `1h2m3s`.
 */
export function parseStart(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);

  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2] && !match[3])) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function fromPath(pathname: string): { videoId: string; kind: LinkKind } | null {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return null;

  // /shorts/ID, /live/ID, /embed/ID, /v/ID
  const prefixes: Record<string, LinkKind> = {
    shorts: "short",
    live: "live",
    embed: "embed",
    v: "embed",
  };
  const kind = prefixes[parts[0]];
  if (kind && parts[1] && VIDEO_ID.test(parts[1])) {
    return { videoId: parts[1], kind };
  }

  // youtu.be/ID
  if (parts.length === 1 && VIDEO_ID.test(parts[0])) {
    return { videoId: parts[0], kind: "video" };
  }
  return null;
}

/**
 * Parses any YouTube link, or a bare video id.
 *
 * Returns null for anything else — including other video sites, which this
 * tool does not claim to support.
 */
export function parseYouTubeUrl(input: string): YouTubeLink | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // A bare id, which is what people paste when they already know it.
  if (VIDEO_ID.test(trimmed)) return { videoId: trimmed, kind: "video" };

  let url: URL;
  try {
    // A link pasted without a scheme is still a link.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const videoParam = url.searchParams.get("v");
  const base =
    videoParam && VIDEO_ID.test(videoParam)
      ? { videoId: videoParam, kind: "video" as LinkKind }
      : fromPath(url.pathname);

  if (!base) return null;

  const playlist = url.searchParams.get("list");
  const start = parseStart(url.searchParams.get("t") ?? url.searchParams.get("start"));

  return {
    ...base,
    ...(start !== undefined ? { startSeconds: start } : {}),
    ...(playlist && PLAYLIST_ID.test(playlist) ? { playlistId: playlist } : {}),
  };
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
