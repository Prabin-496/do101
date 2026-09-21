import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TOOLS } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory } from "@/lib/tools/types";
import { categoryHref, HUB_CATEGORIES, toolBreadcrumbs } from "@/lib/tools/links";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema } from "@/lib/seo/structured-data";
import sitemap from "@/app/sitemap";
import { GET as llms } from "@/app/llms.txt/route";
import { absoluteUrl } from "@/lib/site";

/**
 * Site-wide SEO invariants.
 *
 * Each of these was found broken by an audit, in bulk, across dozens of pages.
 * They are cheap to check and expensive to rediscover, so they are checked on
 * every run instead.
 */

const pageFile = (route: string) => path.join("src/app", route, "page.tsx");

describe("every tool is a real, reachable page", () => {
  it("has a page file behind every registered route", () => {
    const missing = TOOLS.filter((t) => !fs.existsSync(pageFile(t.route))).map((t) => t.route);
    expect(missing).toEqual([]);
  });

  it("is linked from at least one other tool where the link is actually rendered", () => {
    // RelatedTools renders the first four. An entry fifth in the list is a link
    // nobody — and no crawler — ever sees.
    const inbound = new Set(TOOLS.flatMap((t) => t.related.slice(0, 4)));
    const orphans = TOOLS.filter((t) => !inbound.has(t.id)).map((t) => t.id);
    expect(orphans).toEqual([]);
  });

  it("builds its JSON-LD breadcrumbs from the shared helper, never a query URL", () => {
    const offenders = TOOLS.filter((t) => {
      const src = fs.readFileSync(pageFile(t.route), "utf8");
      return src.includes("tools?category=") || (src.includes("breadcrumbSchema([") && t.route.startsWith("/tools/"));
    }).map((t) => t.id);
    expect(offenders).toEqual([]);
  });
});

describe("category hubs", () => {
  it("gives every category with two or more tools a real landing page", () => {
    const counts = new Map<ToolCategory, number>();
    for (const t of TOOLS) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    for (const [category, count] of counts) {
      if (count < 2) continue;
      expect(categoryHref(category), category).not.toContain("?");
    }
  });

  it("has a page file for every hub the links point at", () => {
    for (const category of HUB_CATEGORIES) {
      const file = pageFile(`/tools/${CATEGORY_META[category].slug}`);
      expect(fs.existsSync(file), file).toBe(true);
    }
  });

  it("makes the visible breadcrumb and the category link agree", () => {
    for (const tool of TOOLS) {
      const crumbs = toolBreadcrumbs(tool);
      expect(crumbs).toHaveLength(3);
      expect(crumbs[1].href).toBe(categoryHref(tool.category));
      expect(crumbs[2].href).toBe(tool.route);
    }
  });
});

describe("what search engines and assistants are handed", () => {
  it("lists every tool and every hub in the sitemap", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const tool of TOOLS) expect(urls.has(absoluteUrl(tool.route)), tool.route).toBe(true);
    for (const category of HUB_CATEGORIES) {
      expect(urls.has(absoluteUrl(categoryHref(category))), category).toBe(true);
    }
  });

  it("puts every tool in llms.txt, whatever its category", async () => {
    const text = await llms().text();
    const missing = TOOLS.filter((t) => !text.includes(absoluteUrl(t.route))).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it("gives every tool its own preview image, in the metadata and the schema", () => {
    for (const tool of TOOLS) {
      const meta = toolMetadata(tool);
      const images = meta.openGraph?.images as Array<{ url: string }>;
      expect(images[0].url).toBe(absoluteUrl(`/og/${tool.id}`));
      expect(toolSchema(tool).image).toBe(absoluteUrl(`/og/${tool.id}`));
    }
  });

  it("never claims a rating it has not measured", () => {
    for (const tool of TOOLS) {
      const schema = toolSchema(tool);
      expect(schema).not.toHaveProperty("aggregateRating");
      expect(schema).not.toHaveProperty("review");
    }
  });
});
