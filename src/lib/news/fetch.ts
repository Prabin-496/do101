import "server-only";
import { NEWS_SOURCES, sourcesFor } from "./sources";
import { parseFeed } from "./parse";
import { rankItems } from "./rank";
import type { FeedResult, NewsCategory, NewsItem, NewsSource } from "./types";

/**
 * Reads every configured feed, server side.
 *
 * Cost control, because DO101 must stay free to run:
 * - Responses go through Next's data cache with a 20 minute revalidation, so a
 *   burst of visitors triggers one fetch per feed, not one per visitor.
 * - Each feed gets an 8 second timeout and its own try/catch, so one slow or
 *   broken publisher cannot delay or fail the page.
 * - Only the first 20 items per feed are kept.
 *
 * Nothing is stored: there is no database and no scheduled job. The page is
 * regenerated on demand, at most once per revalidation window.
 */

export const REVALIDATE_SECONDS = 1200;
const FEED_TIMEOUT_MS = 8000;
const ITEMS_PER_FEED = 20;

const USER_AGENT =
  "Mozilla/5.0 (compatible; DO101NewsReader/1.0; +https://do101.online/news/sources)";

async function fetchFeed(source: NewsSource): Promise<FeedResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      next: { revalidate: REVALIDATE_SECONDS, tags: ["news"] },
    });

    if (!response.ok) {
      return { sourceId: source.id, items: [], ok: false, error: `HTTP ${response.status}` };
    }

    const xml = await response.text();
    const items = parseFeed(xml, source, ITEMS_PER_FEED);
    return {
      sourceId: source.id,
      items,
      ok: items.length > 0,
      error: items.length === 0 ? "No items parsed" : undefined,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    return {
      sourceId: source.id,
      items: [],
      ok: false,
      error: name === "AbortError" ? "Timed out" : name,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface NewsFeedSnapshot {
  items: NewsItem[];
  /** How many feeds answered, so the page can be honest about coverage. */
  sourcesOk: number;
  sourcesTotal: number;
  failures: Array<{ sourceId: string; error: string }>;
  fetchedAt: number;
}

export async function getNews(
  category: NewsCategory | "all" = "all",
  limit?: number,
): Promise<NewsFeedSnapshot> {
  const sources = sourcesFor(category);

  // allSettled, so a single rejected promise cannot take the page down.
  const settled = await Promise.allSettled(sources.map(fetchFeed));
  const results: FeedResult[] = settled.map((outcome, i) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : { sourceId: sources[i].id, items: [], ok: false, error: "Failed" },
  );

  const items = rankItems(
    results.flatMap((r) => r.items),
    limit,
  );

  return {
    items,
    sourcesOk: results.filter((r) => r.ok).length,
    sourcesTotal: sources.length,
    failures: results
      .filter((r) => !r.ok)
      .map((r) => ({ sourceId: r.sourceId, error: r.error ?? "Unknown" })),
    fetchedAt: Date.now(),
  };
}

export function totalSources(): number {
  return NEWS_SOURCES.length;
}
