import { describe, it, expect } from "vitest";
import { parseFeed, toExcerpt, parseDate } from "@/lib/news/parse";
import {
  normalizeTitle,
  normalizeLink,
  dedupe,
  diversify,
  capPerSource,
  isReadable,
  rankItems,
  timeAgo,
} from "@/lib/news/rank";
import { NEWS_SOURCES, sourceById, sourcesFor } from "@/lib/news/sources";
import { CATEGORY_ORDER } from "@/lib/news/types";
import type { NewsItem, NewsSource } from "@/lib/news/types";

const source: NewsSource = {
  id: "test",
  name: "Test Feed",
  url: "https://example.com/feed",
  site: "https://example.com",
  category: "tech",
};

const item = (over: Partial<NewsItem> = {}): NewsItem => ({
  id: Math.random().toString(36),
  title: "A perfectly ordinary headline about something",
  link: "https://example.com/a",
  excerpt: "",
  publishedAt: Date.now(),
  sourceId: "test",
  sourceName: "Test Feed",
  category: "tech",
  ...over,
});

describe("feed parsing", () => {
  it("parses an RSS 2.0 feed", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <title>Example</title>
      <item>
        <title>First story about technology</title>
        <link>https://example.com/first</link>
        <description>Some summary text here.</description>
        <pubDate>Wed, 01 Jan 2025 10:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;
    const items = parseFeed(xml, source);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("First story about technology");
    expect(items[0].link).toBe("https://example.com/first");
    expect(items[0].excerpt).toBe("Some summary text here.");
    expect(items[0].publishedAt).toBe(Date.parse("2025-01-01T10:00:00Z"));
  });

  it("parses an Atom feed where the link is an attribute", () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>An Atom entry about science</title>
        <link rel="alternate" href="https://example.com/atom-entry"/>
        <summary>Atom summary.</summary>
        <updated>2025-02-03T08:30:00Z</updated>
      </entry>
    </feed>`;
    const items = parseFeed(xml, source);
    expect(items).toHaveLength(1);
    expect(items[0].link).toBe("https://example.com/atom-entry");
    expect(items[0].publishedAt).toBe(Date.parse("2025-02-03T08:30:00Z"));
  });

  it("handles CDATA and strips HTML from the excerpt", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title><![CDATA[Headline with <em>markup</em> inside]]></title>
      <link>https://example.com/cdata</link>
      <description><![CDATA[<p>Hello <strong>world</strong></p>]]></description>
    </item></channel></rss>`;
    const items = parseFeed(xml, source);
    expect(items[0].title).toBe("Headline with markup inside");
    expect(items[0].excerpt).toBe("Hello world");
  });

  it("skips items with no usable link", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Missing its link entirely</title></item>
      <item><title>Has a good link here</title><link>https://example.com/ok</link></item>
    </channel></rss>`;
    expect(parseFeed(xml, source)).toHaveLength(1);
  });

  it("falls back to a guid when it is a URL", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title>Story identified only by guid</title>
      <guid>https://example.com/from-guid</guid>
    </item></channel></rss>`;
    expect(parseFeed(xml, source)[0].link).toBe("https://example.com/from-guid");
  });

  it("returns an empty array rather than throwing on malformed XML", () => {
    expect(parseFeed("<rss><channel><item>broken", source)).toEqual([]);
    expect(parseFeed("", source)).toEqual([]);
  });

  it("respects the item limit", () => {
    const items = Array.from(
      { length: 40 },
      (_, i) => `<item><title>Story number ${i} in the feed</title><link>https://example.com/${i}</link></item>`,
    ).join("");
    expect(parseFeed(`<rss><channel>${items}</channel></rss>`, source, 20)).toHaveLength(20);
  });
});

describe("excerpts and dates", () => {
  it("cuts long text at a word boundary", () => {
    const excerpt = toExcerpt("word ".repeat(200), 50);
    expect(excerpt.length).toBeLessThanOrEqual(51);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).not.toMatch(/wor…$/);
  });

  it("leaves short text untouched", () => {
    expect(toExcerpt("Short and sweet.")).toBe("Short and sweet.");
  });

  it("rejects dates that are unparseable, far future or implausibly old", () => {
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate(new Date(Date.now() + 10 * 86_400_000).toUTCString())).toBeNull();
    expect(parseDate("Mon, 01 Jan 1990 00:00:00 GMT")).toBeNull();
  });
});

describe("de-duplication", () => {
  it("treats URLs differing only by tracking parameters as the same story", () => {
    expect(normalizeLink("https://www.example.com/story?utm_source=rss#top")).toBe(
      "example.com/story",
    );
    const items = [
      item({ link: "https://example.com/story?utm_source=rss" }),
      item({ link: "https://www.example.com/story", title: "Completely different words here" }),
    ];
    expect(dedupe(items)).toHaveLength(1);
  });

  it("matches the same headline across publishers", () => {
    expect(normalizeTitle("OpenAI Launches a New Model — The Verge")).toBe(
      "openai launches new model",
    );
    const items = [
      item({ title: "OpenAI Launches a New Model", link: "https://a.com/1" }),
      item({ title: "OpenAI launches a new model!", link: "https://b.com/2" }),
    ];
    expect(dedupe(items)).toHaveLength(1);
  });

  it("keeps genuinely different stories", () => {
    const items = [
      item({ title: "Apple announces a new laptop today", link: "https://a.com/1" }),
      item({ title: "Google announces a new phone today", link: "https://b.com/2" }),
    ];
    expect(dedupe(items)).toHaveLength(2);
  });

  it("does not collapse short headlines that normalise to almost nothing", () => {
    const items = [
      item({ title: "The AI of the day", link: "https://a.com/1" }),
      item({ title: "The AI of the day", link: "https://b.com/2" }),
    ];
    expect(dedupe(items)).toHaveLength(2);
  });
});

describe("balancing the feed", () => {
  it("caps how many items one publisher contributes", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      item({ sourceId: "loud", link: `https://loud.com/${i}` }),
    );
    expect(capPerSource(items, 3)).toHaveLength(3);
  });

  it("never places two consecutive items from the same publisher when it can avoid it", () => {
    const items = [
      item({ sourceId: "a", link: "https://a.com/1" }),
      item({ sourceId: "a", link: "https://a.com/2" }),
      item({ sourceId: "b", link: "https://b.com/1" }),
      item({ sourceId: "b", link: "https://b.com/2" }),
    ];
    const spread = diversify(items, 1);
    for (let i = 1; i < spread.length; i++) {
      expect(spread[i].sourceId).not.toBe(spread[i - 1].sourceId);
    }
  });

  it("accepts a run when every remaining item is from one publisher", () => {
    const items = [
      item({ sourceId: "a", link: "https://a.com/1" }),
      item({ sourceId: "a", link: "https://a.com/2" }),
    ];
    expect(diversify(items, 1)).toHaveLength(2);
  });

  it("filters placeholder and one-word headlines", () => {
    expect(isReadable(item({ title: "[Boost]" }))).toBe(false);
    expect(isReadable(item({ title: "Update" }))).toBe(false);
    expect(isReadable(item({ title: "12345 67890 11111" }))).toBe(false);
    expect(isReadable(item({ title: "A genuinely readable headline" }))).toBe(true);
  });

  it("orders newest first and honours the limit", () => {
    const now = Date.now();
    const ranked = rankItems(
      [
        item({ title: "The older story from yesterday", link: "https://a.com/1", publishedAt: now - 90_000 }),
        item({ title: "The newest story just published", link: "https://b.com/2", sourceId: "b", publishedAt: now }),
      ],
      1,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].title).toContain("newest");
  });

  it("sorts undated items last rather than to 1970", () => {
    const ranked = rankItems([
      item({ title: "This one has no date at all", link: "https://a.com/1", publishedAt: null }),
      item({ title: "This one is properly dated", link: "https://b.com/2", sourceId: "b", publishedAt: Date.now() }),
    ]);
    expect(ranked[0].publishedAt).not.toBeNull();
  });
});

describe("relative time", () => {
  const now = Date.parse("2026-01-10T12:00:00Z");
  it("describes recent and older timestamps", () => {
    expect(timeAgo(now - 30_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 hours ago");
    expect(timeAgo(now - 1 * 3_600_000, now)).toBe("1 hour ago");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2 days ago");
    expect(timeAgo(now - 21 * 86_400_000, now)).toBe("3 weeks ago");
  });

  it("handles a missing date without pretending to know", () => {
    expect(timeAgo(null, now)).toBe("recently");
  });
});

describe("source registry", () => {
  it("has unique ids and feed URLs", () => {
    expect(new Set(NEWS_SOURCES.map((s) => s.id)).size).toBe(NEWS_SOURCES.length);
    expect(new Set(NEWS_SOURCES.map((s) => s.url)).size).toBe(NEWS_SOURCES.length);
  });

  it("uses https and a known category everywhere", () => {
    for (const s of NEWS_SOURCES) {
      expect(CATEGORY_ORDER, s.name).toContain(s.category);
      expect(s.url.startsWith("http"), s.name).toBe(true);
      expect(s.site.startsWith("https://"), s.name).toBe(true);
    }
  });

  it("covers every category with at least three sources", () => {
    for (const category of CATEGORY_ORDER) {
      expect(sourcesFor(category).length, category).toBeGreaterThanOrEqual(3);
    }
  });

  it("looks feeds up by id", () => {
    expect(sourceById(NEWS_SOURCES[0].id)?.name).toBe(NEWS_SOURCES[0].name);
    expect(sourceById("not-a-real-source")).toBeUndefined();
  });

  it("returns every source for the all category", () => {
    expect(sourcesFor("all")).toHaveLength(NEWS_SOURCES.length);
  });
});
