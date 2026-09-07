import { describe, it, expect } from "vitest";
import { analyzeText, countSentences, splitWords, keywordDensity } from "@/lib/text/stats";
import { cleanText, DEFAULT_CLEAN_OPTIONS } from "@/lib/text/clean";
import { convertCase } from "@/lib/text/case";
import { diffWords, diffSummary } from "@/lib/text/diff";

describe("word and character counting", () => {
  it("counts words separated by any whitespace", () => {
    expect(splitWords("the quick  brown\nfox")).toHaveLength(4);
  });

  it("treats an empty string as zero words", () => {
    const stats = analyzeText("");
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.paragraphs).toBe(0);
    expect(stats.lines).toBe(0);
  });

  it("treats whitespace-only input as zero words", () => {
    expect(analyzeText("   \n\t  ").words).toBe(0);
  });

  it("counts a hyphenated word as one word", () => {
    expect(analyzeText("well-known problem").words).toBe(2);
  });

  it("separates characters with and without spaces", () => {
    const stats = analyzeText("a b c");
    expect(stats.characters).toBe(5);
    expect(stats.charactersNoSpaces).toBe(3);
  });

  it("counts emoji as one visible character even when built from several code points", () => {
    const stats = analyzeText("👨‍👩‍👧");
    expect(stats.graphemes).toBe(1);
    expect(stats.characters).toBeGreaterThan(1);
  });

  it("counts sentences across . ! and ?", () => {
    expect(countSentences("One. Two! Three? Four")).toBe(4);
  });

  it("estimates reading time at 225 words per minute", () => {
    const text = Array.from({ length: 225 }, () => "word").join(" ");
    expect(analyzeText(text).readingTimeMinutes).toBeCloseTo(1, 5);
  });

  it("ignores stop words in keyword density", () => {
    const keywords = keywordDensity("the cat and the cat sat on the mat");
    expect(keywords[0]).toMatchObject({ word: "cat", count: 2 });
  });
});

describe("text cleaner", () => {
  it("collapses repeated spaces", () => {
    expect(cleanText("a    b", DEFAULT_CLEAN_OPTIONS)).toBe("a b");
  });

  it("trims each line", () => {
    expect(cleanText("  a  \n  b  ", DEFAULT_CLEAN_OPTIONS)).toBe("a\nb");
  });

  it("removes blank lines only when asked", () => {
    const input = "a\n\n\n\nb";
    expect(cleanText(input, DEFAULT_CLEAN_OPTIONS)).toBe("a\n\nb");
    expect(cleanText(input, { ...DEFAULT_CLEAN_OPTIONS, removeBlankLines: true })).toBe("a\nb");
  });

  it("strips zero-width characters", () => {
    expect(cleanText("a​b", DEFAULT_CLEAN_OPTIONS)).toBe("ab");
  });

  it("straightens smart quotes when enabled", () => {
    expect(
      cleanText("“hi” — it’s", { ...DEFAULT_CLEAN_OPTIONS, straightenQuotes: true }),
    ).toBe('"hi" - it\'s');
  });

  it("leaves already-clean text untouched", () => {
    expect(cleanText("clean text", DEFAULT_CLEAN_OPTIONS)).toBe("clean text");
  });
});

describe("case converter", () => {
  const input = "the quick brown fox";

  it("converts to upper and lower", () => {
    expect(convertCase(input, "upper")).toBe("THE QUICK BROWN FOX");
    expect(convertCase("ABC", "lower")).toBe("abc");
  });

  it("keeps minor words lowercase in Title Case", () => {
    expect(convertCase("the lord of the rings", "title")).toBe("The Lord of the Rings");
  });

  it("produces programming cases", () => {
    expect(convertCase(input, "camel")).toBe("theQuickBrownFox");
    expect(convertCase(input, "pascal")).toBe("TheQuickBrownFox");
    expect(convertCase(input, "snake")).toBe("the_quick_brown_fox");
    expect(convertCase(input, "kebab")).toBe("the-quick-brown-fox");
    expect(convertCase(input, "constant")).toBe("THE_QUICK_BROWN_FOX");
  });

  it("splits an existing camelCase identifier correctly", () => {
    expect(convertCase("theQuickBrownFox", "kebab")).toBe("the-quick-brown-fox");
  });

  it("handles empty input", () => {
    expect(convertCase("", "camel")).toBe("");
  });
});

describe("text diff", () => {
  it("reports identical text", () => {
    const summary = diffSummary(diffWords("same text", "same text"));
    expect(summary.identical).toBe(true);
    expect(summary.added).toBe(0);
  });

  it("marks an added word", () => {
    const parts = diffWords("a c", "a b c");
    const summary = diffSummary(parts);
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(0);
  });

  it("marks a removed word", () => {
    const summary = diffSummary(diffWords("a b c", "a c"));
    expect(summary.removed).toBe(1);
  });

  it("honours ignoreCase", () => {
    expect(diffSummary(diffWords("Hello", "hello", { ignoreCase: true })).identical).toBe(true);
    expect(diffSummary(diffWords("Hello", "hello")).identical).toBe(false);
  });

  it("handles one empty side", () => {
    expect(diffSummary(diffWords("", "new words")).added).toBe(2);
  });
});
