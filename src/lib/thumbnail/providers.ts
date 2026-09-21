/**
 * Where each provider keeps its cover images.
 *
 * Pure URL building, kept apart from the fetching so the rules can be tested
 * without a network. Nothing here guesses whether a size exists — that is
 * settled by asking for it, because YouTube answers 404 for the sizes a
 * video does not have.
 */
import type { Source } from "./sources";

export interface Candidate {
  /** Stable key, used for React lists and for the downloaded file name. */
  key: string;
  label: string;
  url: string;
  /** The size it should come back as, before the real one is measured. */
  expected?: { w: number; h: number };
  /** Shown next to the size when there is something worth knowing. */
  note?: string;
}

/* --------------------------------- YouTube -------------------------------- */

const YOUTUBE_HOST = "https://i.ytimg.com/vi";

/**
 * Every cover YouTube generates, largest first.
 *
 * The 4:3 ones are a historical hangover: YouTube still renders them at the
 * old aspect and pads a widescreen video with black bars, which is the usual
 * reason somebody downloads a cover and wonders why it looks wrong.
 */
const YOUTUBE_SIZES: { name: string; label: string; w: number; h: number; note?: string }[] = [
  { name: "maxresdefault", label: "Max", w: 1280, h: 720 },
  { name: "sddefault", label: "SD", w: 640, h: 480, note: "4:3 — black bars on a widescreen video" },
  { name: "hqdefault", label: "High", w: 480, h: 360, note: "4:3 — black bars on a widescreen video" },
  { name: "mqdefault", label: "Medium", w: 320, h: 180 },
  { name: "default", label: "Small", w: 120, h: 90, note: "4:3 — black bars on a widescreen video" },
];

export function youtubeCandidates(id: string): Candidate[] {
  return YOUTUBE_SIZES.map((size) => ({
    key: size.name,
    label: size.label,
    url: `${YOUTUBE_HOST}/${id}/${size.name}.jpg`,
    expected: { w: size.w, h: size.h },
    note: size.note,
  }));
}

/* ---------------------------------- Vimeo --------------------------------- */

/** The widths worth offering. Vimeo scales to whatever is asked for. */
const VIMEO_WIDTHS = [1920, 1280, 640, 295];

/**
 * Vimeo's CDN encodes the size in the path, as `-d_1280` or `-d_295x166`.
 *
 * Swapping that segment is how a bigger copy is requested without another
 * round trip to oEmbed for every size.
 */
export function vimeoVariants(thumbnailUrl: string): Candidate[] {
  if (!/-d_\d+(x\d+)?/.test(thumbnailUrl)) {
    // An unfamiliar URL shape: offer exactly what oEmbed gave, unaltered.
    return [{ key: "original", label: "Original", url: thumbnailUrl }];
  }

  return VIMEO_WIDTHS.map((width) => ({
    key: `w${width}`,
    label: `${width}px wide`,
    url: thumbnailUrl.replace(/-d_\d+(x\d+)?/, `-d_${width}`),
  }));
}

/* --------------------------------- oEmbed --------------------------------- */

/**
 * Both providers publish an oEmbed endpoint with permissive CORS, which is
 * the supported, documented way to ask for a title and an author — no
 * scraping involved.
 */
export function oEmbedUrl(source: Source): string {
  if (source.provider === "youtube") {
    const url = new URL("https://www.youtube.com/oembed");
    url.searchParams.set("url", source.canonical);
    url.searchParams.set("format", "json");
    return url.toString();
  }

  const url = new URL("https://vimeo.com/api/oembed.json");
  url.searchParams.set("url", source.canonical);
  // Asking for a wide one makes oEmbed hand back the largest cover it has.
  url.searchParams.set("width", String(VIMEO_WIDTHS[0]));
  return url.toString();
}

export interface Meta {
  title: string;
  author: string;
  authorUrl: string;
  /** Vimeo reports its cover here; YouTube's are at predictable URLs. */
  thumbnailUrl?: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseOEmbed(raw: unknown): Meta {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    title: str(data.title),
    author: str(data.author_name),
    authorUrl: str(data.author_url),
    thumbnailUrl: str(data.thumbnail_url) || undefined,
  };
}

/** A safe, descriptive file name for a saved cover. */
export function fileName(source: Source, meta: Meta | null, key: string, extension: string): string {
  const stem = (meta?.title || `${source.provider}-${source.id}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem || source.id}-${key}.${extension}`;
}
