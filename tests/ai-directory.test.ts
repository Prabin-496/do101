import { describe, it, expect } from "vitest";
import { AI_TOOLS, toolsInCategory, AI_TOOL_COUNT } from "@/lib/ai-directory/tools";
import { AI_CATEGORIES, categoryMeta } from "@/lib/ai-directory/types";

describe("AI tool directory", () => {
  it("has unique ids and URLs", () => {
    expect(new Set(AI_TOOLS.map((t) => t.id)).size).toBe(AI_TOOLS.length);
    expect(new Set(AI_TOOLS.map((t) => t.url)).size).toBe(AI_TOOLS.length);
  });

  it("links every tool over https", () => {
    for (const tool of AI_TOOLS) {
      expect(tool.url.startsWith("https://"), tool.name).toBe(true);
    }
  });

  it("uses only known categories", () => {
    const known = AI_CATEGORIES.map((c) => c.id);
    for (const tool of AI_TOOLS) {
      expect(known, tool.name).toContain(tool.category);
      for (const extra of tool.alsoIn ?? []) {
        expect(known, `${tool.name} secondary`).toContain(extra);
      }
    }
  });

  it("gives every tool a summary, a maker and a reason to pick it", () => {
    for (const tool of AI_TOOLS) {
      expect(tool.summary.length, tool.name).toBeGreaterThan(20);
      expect(tool.bestFor.length, tool.name).toBeGreaterThan(15);
      expect(tool.maker.length, tool.name).toBeGreaterThan(1);
    }
  });

  it("fills every category with at least two tools", () => {
    for (const category of AI_CATEGORIES) {
      expect(toolsInCategory(category.id).length, category.label).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes secondary categories when filtering", () => {
    // Claude's primary category is chat, but it is also listed under code.
    expect(toolsInCategory("code").map((t) => t.id)).toContain("claude");
  });

  it("records a valid free-tier state for every tool", () => {
    for (const tool of AI_TOOLS) {
      expect(["yes", "limited", "trial", "no"], tool.name).toContain(tool.freeTier);
    }
  });

  it("publishes no prices, ratings or rankings", () => {
    // The directory deliberately carries no data DO101 has not verified.
    const serialised = JSON.stringify(AI_TOOLS);
    expect(serialised).not.toMatch(/\$\d/);
    expect(serialised).not.toMatch(/"(rating|stars|reviews|rank|score)"/i);
    for (const tool of AI_TOOLS) {
      expect(Object.keys(tool)).not.toContain("price");
      expect(Object.keys(tool)).not.toContain("rating");
    }
  });

  it("gives every category guidance rather than just a label", () => {
    for (const category of AI_CATEGORIES) {
      expect(category.guidance.length, category.label).toBeGreaterThan(60);
      expect(categoryMeta(category.id).label).toBe(category.label);
    }
  });

  it("counts what it says it counts", () => {
    expect(AI_TOOL_COUNT).toBe(AI_TOOLS.length);
    expect(AI_TOOL_COUNT).toBeGreaterThanOrEqual(40);
  });
});
