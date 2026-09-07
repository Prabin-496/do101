import { describe, it, expect } from "vitest";
import { computeTypingStats, generateTypingText, typingGrade } from "@/lib/games/typing";
import { makeRoomCode, normalizeRoomCode, peerIdFor, explainPeerError } from "@/lib/games/battle";
import { fuzzyScore, searchTools } from "@/lib/tools/search";
import { TOOLS, TOOL_MAP, relatedTools } from "@/lib/tools/tool-registry";

describe("typing statistics", () => {
  it("counts five correct characters as one word", () => {
    // 25 correct characters in 60 seconds → 5 words per minute.
    const target = "a".repeat(25);
    const stats = computeTypingStats(target, target, 60);
    expect(stats.wpm).toBe(5);
  });

  it("scales with elapsed time", () => {
    const target = "a".repeat(25);
    expect(computeTypingStats(target, target, 30).wpm).toBe(10);
  });

  it("ignores wrong characters in net WPM but counts them in raw WPM", () => {
    const stats = computeTypingStats("aaaaa", "aaaXX", 60);
    expect(stats.correctChars).toBe(3);
    expect(stats.incorrectChars).toBe(2);
    expect(stats.wpm).toBeCloseTo(3 / 5, 10);
    expect(stats.rawWpm).toBeCloseTo(1, 10);
  });

  it("computes accuracy as correct over typed", () => {
    expect(computeTypingStats("abcd", "abXd", 60).accuracy).toBe(75);
  });

  it("reports 100% accuracy before anything is typed", () => {
    expect(computeTypingStats("abc", "", 10).accuracy).toBe(100);
  });

  it("returns zero rather than Infinity when no time has passed", () => {
    const stats = computeTypingStats("abc", "abc", 0);
    expect(stats.wpm).toBe(0);
    expect(Number.isFinite(stats.cpm)).toBe(true);
  });

  it("does not count extra characters typed past the target as correct", () => {
    const stats = computeTypingStats("ab", "abcd", 60);
    expect(stats.correctChars).toBe(2);
    expect(stats.incorrectChars).toBe(2);
  });

  it("generates the requested number of words", () => {
    expect(generateTypingText(30).split(" ")).toHaveLength(30);
  });

  it("generates identical text for the same seed", () => {
    // Typing Battle depends on both players deriving the same text.
    expect(generateTypingText(40, 1234)).toBe(generateTypingText(40, 1234));
    expect(generateTypingText(40, 1234)).not.toBe(generateTypingText(40, 5678));
  });

  it("grades speeds sensibly", () => {
    expect(typingGrade(120).label).toBe("Elite");
    expect(typingGrade(45).label).toBe("Average");
    expect(typingGrade(10).label).toBe("Warming up");
  });
});

describe("typing battle room codes", () => {
  it("generates codes of the requested length", () => {
    expect(makeRoomCode(5)).toHaveLength(5);
  });

  it("avoids visually ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(makeRoomCode(8)).not.toMatch(/[IO01]/);
    }
  });

  it("normalises typed codes", () => {
    expect(normalizeRoomCode("  ab-c12 ")).toBe("ABC12");
  });

  it("caps an over-long code", () => {
    expect(normalizeRoomCode("ABCDEFGHIJKL")).toHaveLength(8);
  });

  it("namespaces peer ids so DO101 rooms never collide with other apps", () => {
    expect(peerIdFor("ABC12")).toBe("do101-battle-ABC12");
  });

  it("explains every peer error type in plain language", () => {
    expect(explainPeerError("peer-unavailable")).toMatch(/no one is hosting/i);
    expect(explainPeerError("something-new")).toMatch(/connection failed/i);
  });
});

describe("tool registry and search", () => {
  it("has unique ids and routes", () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.route)).size).toBe(TOOLS.length);
  });

  it("only references related tools that exist", () => {
    for (const tool of TOOLS) {
      for (const id of tool.related) {
        expect(TOOL_MAP[id], `${tool.id} → ${id}`).toBeDefined();
      }
    }
  });

  it("gives every tool SEO metadata within sensible lengths", () => {
    for (const tool of TOOLS) {
      expect(tool.seoTitle.length, tool.id).toBeLessThanOrEqual(70);
      expect(tool.seoDescription.length, tool.id).toBeGreaterThan(70);
      expect(tool.seoDescription.length, tool.id).toBeLessThanOrEqual(170);
    }
  });

  it("gives every tool unique metadata", () => {
    expect(new Set(TOOLS.map((t) => t.seoTitle)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.seoDescription)).size).toBe(TOOLS.length);
  });

  it("scores an exact match above a fuzzy one", () => {
    expect(fuzzyScore("json", "json")).toBeGreaterThan(fuzzyScore("json", "jason bourne"));
  });

  it("returns -1 when the query characters are not present", () => {
    expect(fuzzyScore("zzz", "hello")).toBe(-1);
  });

  it("finds tools by natural phrasing", () => {
    expect(searchTools("compress photo")[0].tool.id).toBe("image-compressor");
    expect(searchTools("make qr")[0].tool.id).toBe("qr-generator");
    expect(searchTools("count words")[0].tool.id).toBe("word-counter");
    expect(searchTools("json")[0].tool.category).toBe("developer");
  });

  it("returns nothing for an empty query", () => {
    expect(searchTools("")).toHaveLength(0);
  });

  it("returns related tools without including the tool itself", () => {
    const related = relatedTools("image-compressor");
    expect(related.length).toBeGreaterThan(0);
    expect(related.map((t) => t.id)).not.toContain("image-compressor");
  });
});
