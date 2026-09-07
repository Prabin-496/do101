import type { NewsItem } from "./types";

/**
 * Turning 75 feeds into one readable list.
 *
 * Two problems have to be solved: the same story appears in several feeds, and
 * a single prolific publisher can otherwise fill the whole page. Both are
 * handled here so the ranking logic stays pure and testable.
 */

/** Titles differ by punctuation and source suffixes; compare the words only. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+[–—|-]\s+[^–—|-]{1,40}$/u, "") // trailing " – Publisher"
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(the|a|an|of|for|to|in|on|and|is|are|as|at|by|with|from)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same article syndicated under different tracking parameters. */
export function normalizeLink(link: string): string {
  try {
    const url = new URL(link);
    url.hash = "";
    url.search = "";
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return link;
  }
}

export function dedupe(items: NewsItem[]): NewsItem[] {
  const seenLinks = new Set<string>();
  const seenTitles = new Set<string>();
  const out: NewsItem[] = [];

  for (const item of items) {
    const linkKey = normalizeLink(item.link);
    const titleKey = normalizeTitle(item.title);

    if (seenLinks.has(linkKey)) continue;
    // Very short titles normalise down to almost nothing; only dedupe real ones.
    if (titleKey.length > 18 && seenTitles.has(titleKey)) continue;

    seenLinks.add(linkKey);
    if (titleKey.length > 18) seenTitles.add(titleKey);
    out.push(item);
  }

  return out;
}

export function byRecency(a: NewsItem, b: NewsItem): number {
  // Items without a date sort last rather than to 1970.
  if (a.publishedAt === null && b.publishedAt === null) return 0;
  if (a.publishedAt === null) return 1;
  if (b.publishedAt === null) return -1;
  return b.publishedAt - a.publishedAt;
}

/**
 * Interleaves so no publisher appears more than `maxRun` times in a row.
 * Chronological order is otherwise preserved.
 */
export function diversify(items: NewsItem[], maxRun = 2): NewsItem[] {
  const queue = [...items];
  const out: NewsItem[] = [];
  let lastSource = "";
  let run = 0;

  while (queue.length) {
    let index = 0;
    if (run >= maxRun) {
      const alternative = queue.findIndex((item) => item.sourceId !== lastSource);
      // If every remaining item is from the same source, accept the run.
      if (alternative >= 0) index = alternative;
    }

    const [item] = queue.splice(index, 1);
    run = item.sourceId === lastSource ? run + 1 : 1;
    lastSource = item.sourceId;
    out.push(item);
  }

  return out;
}

/**
 * Drops entries that carry no information: placeholder titles, link dumps and
 * the one-word posts some high-volume community feeds emit.
 */
export function isReadable(item: NewsItem): boolean {
  const title = item.title.trim();
  if (title.length < 15) return false;
  if (/^\[[^\]]*\]$/.test(title)) return false; // "[Boost]"
  if (!/\p{L}/u.test(title)) return false;
  // At least two words, so "Update" and "Weekly" alone do not make the list.
  if (title.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length < 3) return false;
  return true;
}

/**
 * Caps how many items any single publisher contributes.
 *
 * Some feeds publish a handful of pieces a day and some publish hundreds. Left
 * alone, the busiest community feed fills the page and the page stops being
 * worth reading. The cap keeps the mix wide without dropping anyone entirely.
 */
export function capPerSource(items: NewsItem[], max: number): NewsItem[] {
  const counts = new Map<string, number>();
  const out: NewsItem[] = [];

  for (const item of items) {
    const used = counts.get(item.sourceId) ?? 0;
    if (used >= max) continue;
    counts.set(item.sourceId, used + 1);
    out.push(item);
  }
  return out;
}

export function rankItems(
  items: NewsItem[],
  limit?: number,
  { maxPerSource = 4 }: { maxPerSource?: number } = {},
): NewsItem[] {
  const clean = items.filter(isReadable);
  const ordered = dedupe(clean.sort(byRecency));
  const balanced = capPerSource(ordered, maxPerSource);
  // maxRun of 1: never two consecutive items from the same publisher.
  const ranked = diversify(balanced, 1);
  return limit ? ranked.slice(0, limit) : ranked;
}

/** "3 hours ago" without pulling in a date library. */
export function timeAgo(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return "recently";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));

  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
