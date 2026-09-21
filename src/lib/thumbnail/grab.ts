"use client";

/**
 * Fetching the covers.
 *
 * Both providers send their images with a permissive CORS header, which is
 * the only reason any of this can happen in a browser: the bytes are read
 * directly, measured, and handed to the visitor without passing through a
 * server. DO101 never sees the link or the image.
 *
 * Which sizes exist is settled by asking. YouTube answers 404 for the ones a
 * video does not have — including a 1 KB placeholder body, which is why the
 * status is what gets checked and never the size of the response.
 */
import {
  oEmbedUrl,
  parseOEmbed,
  vimeoVariants,
  youtubeCandidates,
  type Candidate,
  type Meta,
} from "./providers";
import type { Source } from "./sources";

export class GrabError extends Error {}

export interface Cover {
  candidate: Candidate;
  blob: Blob;
  /** Measured from the decoded image, not assumed from the URL. */
  width: number;
  height: number;
  bytes: number;
}

export interface GrabResult {
  meta: Meta | null;
  covers: Cover[];
}

/* -------------------------------- metadata -------------------------------- */

/**
 * The title and channel, best-effort.
 *
 * A failure here is not worth stopping for — the covers are the point, and
 * they are fetched in parallel with this.
 */
export async function fetchMeta(source: Source, signal?: AbortSignal): Promise<Meta | null> {
  try {
    const response = await fetch(oEmbedUrl(source), { signal, headers: { accept: "application/json" } });
    if (!response.ok) return null;
    return parseOEmbed(await response.json());
  } catch {
    return null;
  }
}

/* --------------------------------- images --------------------------------- */

async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return size;
    } catch {
      // Fall through to the <img> route below.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("That image could not be decoded."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Fetches one candidate, or null when the provider does not have that size. */
async function probe(candidate: Candidate, signal?: AbortSignal): Promise<Cover | null> {
  let response: Response;
  try {
    response = await fetch(candidate.url, { signal, mode: "cors" });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return null;
  }
  // 404 is the ordinary answer for a size this video never had.
  if (!response.ok) return null;

  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size === 0) return null;

  try {
    const { width, height } = await measure(blob);
    return { candidate, blob, width, height, bytes: blob.size };
  } catch {
    return null;
  }
}

/* ------------------------------- the whole job ----------------------------- */

async function candidatesFor(source: Source, meta: Meta | null): Promise<Candidate[]> {
  if (source.provider === "youtube") return youtubeCandidates(source.id);

  // Vimeo does not publish predictable cover URLs, so the one oEmbed gives
  // is the starting point and the other sizes are derived from it.
  if (!meta?.thumbnailUrl) {
    throw new GrabError(
      "Vimeo did not return a cover for that video. It may be private, deleted, or restricted to certain sites.",
    );
  }
  return vimeoVariants(meta.thumbnailUrl);
}

/**
 * Everything for one link: the metadata and every cover that exists.
 *
 * The sizes are probed together rather than in turn — there are only a
 * handful and they all come from one CDN, so waiting for each in sequence
 * would treble the time for no benefit.
 */
export async function grab(source: Source, signal?: AbortSignal): Promise<GrabResult> {
  const meta = await fetchMeta(source, signal);
  const candidates = await candidatesFor(source, meta);

  const settled = await Promise.all(candidates.map((candidate) => probe(candidate, signal)));
  const covers = settled.filter((cover): cover is Cover => cover !== null);

  if (!covers.length) {
    throw new GrabError(
      meta
        ? "That video exists but no cover image came back. It may have just been uploaded."
        : "Nothing came back for that link. Check the video is public and the link is right.",
    );
  }

  // Biggest first, which is what almost everybody is here for.
  covers.sort((a, b) => b.width * b.height - a.width * a.height);
  return { meta, covers };
}

/** Drops covers that are the same picture at the same size. */
export function dedupe(covers: Cover[]): Cover[] {
  const seen = new Set<string>();
  return covers.filter((cover) => {
    const key = `${cover.width}x${cover.height}:${cover.bytes}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
