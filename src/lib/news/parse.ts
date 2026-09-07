import { XMLParser } from "fast-xml-parser";
import type { NewsItem, NewsSource } from "./types";

/**
 * Normalises RSS 2.0, RDF and Atom into one shape.
 *
 * Feeds in the wild are inconsistent: dates appear in three formats, links are
 * sometimes attributes and sometimes text, and summaries arrive as raw HTML.
 * Everything here is defensive — a malformed field is dropped rather than
 * allowed to break a whole feed.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Feed content is frequently wrapped in CDATA with entities inside.
  processEntities: true,
  htmlEntities: true,
});

type Unknown = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Feed values may be a string, a number, or an object with #text. */
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Unknown;
    if (typeof record["#text"] === "string") return record["#text"];
    if (typeof record["@_href"] === "string") return record["@_href"];
  }
  return "";
}

/** Strips markup and collapses whitespace, then trims to a short excerpt. */
export function toExcerpt(html: string, limit = 220): string {
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#3[89];/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= limit) return plain;
  // Cut at a word boundary so the excerpt does not end mid-word.
  return `${plain.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}

export function parseDate(value: unknown): number | null {
  const raw = text(value).trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  // Guard against feeds with clock problems or placeholder dates.
  const now = Date.now();
  if (parsed > now + 2 * 86_400_000) return null;
  if (parsed < Date.parse("2000-01-01")) return null;
  return parsed;
}

/** Atom links are attributes; RSS links are text. Prefer the canonical one. */
function extractLink(entry: Unknown): string {
  const raw = entry.link;

  if (typeof raw === "string") return raw.trim();

  const candidates = asArray(raw as Unknown | Unknown[]);
  const alternate = candidates.find(
    (l) => typeof l === "object" && (l["@_rel"] === "alternate" || l["@_rel"] === undefined),
  );
  const chosen = alternate ?? candidates[0];
  const href = chosen && typeof chosen === "object" ? text(chosen["@_href"] ?? chosen) : text(chosen);
  if (href) return href.trim();

  // RDF feeds and some others fall back to the item guid.
  const guid = text(entry.guid);
  return /^https?:\/\//.test(guid) ? guid.trim() : "";
}

function stableId(link: string, title: string): string {
  const base = link || title;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function parseFeed(xml: string, source: NewsSource, limit = 20): NewsItem[] {
  let document: Unknown;
  try {
    document = parser.parse(xml) as Unknown;
  } catch {
    return [];
  }

  const rss = document.rss as Unknown | undefined;
  const channel = (rss?.channel ?? document["rdf:RDF"] ?? document.channel) as Unknown | undefined;
  const feed = document.feed as Unknown | undefined;

  const entries = [
    ...asArray((channel?.item ?? undefined) as Unknown | Unknown[] | undefined),
    ...asArray((document.item ?? undefined) as Unknown | Unknown[] | undefined),
    ...asArray((feed?.entry ?? undefined) as Unknown | Unknown[] | undefined),
  ];

  const items: NewsItem[] = [];

  for (const entry of entries) {
    const title = toExcerpt(text(entry.title), 200);
    const link = extractLink(entry);
    if (!title || !link || !/^https?:\/\//.test(link)) continue;

    const summarySource =
      entry.description ??
      entry.summary ??
      entry["content:encoded"] ??
      entry.content ??
      "";

    items.push({
      id: stableId(link, title),
      title,
      link,
      excerpt: toExcerpt(text(summarySource)),
      publishedAt:
        parseDate(entry.pubDate) ??
        parseDate(entry.published) ??
        parseDate(entry.updated) ??
        parseDate(entry["dc:date"]),
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
    });

    if (items.length >= limit) break;
  }

  return items;
}
