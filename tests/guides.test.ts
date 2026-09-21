import { describe, it, expect } from "vitest";
import { GUIDES, getGuide, guidePath } from "@/lib/guides/guides";
import { getTool } from "@/lib/tools/tool-registry";
import sitemap from "@/app/sitemap";
import { GET as llms } from "@/app/llms.txt/route";
import { absoluteUrl } from "@/lib/site";

/**
 * How-to guides exist to catch specific searches and hand the reader to a
 * tool. A guide that points at a missing tool, duplicates another guide's
 * query, or is too thin to be worth indexing does more harm than good.
 */

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe("how-to guides", () => {
  it("has unique slugs, headings and titles", () => {
    for (const key of ["slug", "heading", "seoTitle", "seoDescription"] as const) {
      const values = GUIDES.map((g) => g[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("uses URL-safe slugs", () => {
    for (const g of GUIDES) expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("points every guide at a real tool", () => {
    const missing = GUIDES.filter((g) => !getTool(g.tool)).map((g) => g.slug);
    expect(missing).toEqual([]);
  });

  it("links only to guides that exist, never to itself", () => {
    for (const g of GUIDES) {
      for (const slug of g.related) {
        expect(getGuide(slug), `${g.slug} → ${slug}`).toBeDefined();
        expect(slug).not.toBe(g.slug);
      }
    }
  });

  it("is linked from at least one other guide", () => {
    const inbound = new Set(GUIDES.flatMap((g) => g.related));
    expect(GUIDES.filter((g) => !inbound.has(g.slug)).map((g) => g.slug)).toEqual([]);
  });

  it("answers in one quotable paragraph", () => {
    for (const g of GUIDES) {
      const n = words(g.answer);
      expect(n, g.slug).toBeGreaterThanOrEqual(35);
      expect(n, g.slug).toBeLessThanOrEqual(80);
    }
  });

  it("has enough substance to be worth indexing", () => {
    for (const g of GUIDES) {
      const body = [g.answer, ...g.steps, ...g.sections.flatMap((s) => s.paragraphs), ...g.faqs.map((f) => f.a)];
      expect(words(body.join(" ")), g.slug).toBeGreaterThanOrEqual(300);
      expect(g.steps.length, g.slug).toBeGreaterThanOrEqual(3);
      expect(g.faqs.length, g.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps titles and descriptions inside what search results display", () => {
    for (const g of GUIDES) {
      expect(g.seoTitle.length, g.slug).toBeLessThanOrEqual(75);
      expect(g.seoDescription.length, g.slug).toBeLessThanOrEqual(170);
    }
  });

  it("is in the sitemap and llms.txt", async () => {
    const urls = new Set(sitemap().map((e) => e.url));
    const text = await llms().text();
    expect(urls.has(absoluteUrl("/how-to"))).toBe(true);
    for (const g of GUIDES) {
      expect(urls.has(absoluteUrl(guidePath(g))), g.slug).toBe(true);
      expect(text.includes(absoluteUrl(guidePath(g))), g.slug).toBe(true);
    }
  });
});
