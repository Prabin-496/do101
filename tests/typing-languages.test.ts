import { describe, expect, it } from "vitest";
import {
  TYPING_LANGUAGES, convertInput, getLanguage,
} from "../src/lib/games/languages";
import { computeTypingStats, generateTypingText } from "../src/lib/games/typing";

const SCRIPT_PATTERN: Record<string, RegExp> = {
  latin: /^[\p{Script=Latin}\p{M}'’-]+$/u,
  kana: /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u,
  cyrillic: /^[\p{Script=Cyrillic}-]+$/u,
  devanagari: /^[\p{Script=Devanagari}\p{M}]+$/u,
  arabic: /^[\p{Script=Arabic}\p{M}]+$/u,
};

describe("typing languages", () => {
  it("gives every language enough material for a test", () => {
    for (const language of TYPING_LANGUAGES) {
      expect(language.words.length, language.name).toBeGreaterThan(80);
      expect(language.sentences.length, language.name).toBeGreaterThanOrEqual(4);
      expect(language.native, language.name).toBeTruthy();
    }
  });

  it("writes every word in the language's own script", () => {
    for (const language of TYPING_LANGUAGES) {
      const pattern = SCRIPT_PATTERN[language.script];
      for (const word of language.words) {
        expect(pattern.test(word), `${language.name}: "${word}"`).toBe(true);
      }
    }
  });

  it("has no blank or duplicated words", () => {
    for (const language of TYPING_LANGUAGES) {
      expect(language.words.some((w) => w.trim() === ""), language.name).toBe(false);
      // Some repetition is fine, but a pool that is mostly repeats is a mistake.
      const unique = new Set(language.words).size;
      expect(unique / language.words.length, language.name).toBeGreaterThan(0.9);
    }
  });

  it("says what a language needs whenever a plain keyboard will not do", () => {
    for (const language of TYPING_LANGUAGES) {
      const needsMore =
        language.script !== "latin" ||
        // A Latin language with diacritics still needs a layout or AltGr.
        language.words.some((word) => /[^\u0000-\u007F]/.test(word));
      expect(Boolean(language.requirement), `${language.name} (needs note: ${needsMore})`)
        .toBe(needsMore);
    }
  });

  it("marks Arabic as right to left and nothing else", () => {
    for (const language of TYPING_LANGUAGES) {
      expect(language.direction, language.name).toBe(language.script === "arabic" ? "rtl" : "ltr");
    }
  });

  it("falls back to English for an unknown id", () => {
    expect(getLanguage("klingon").id).toBe("en");
    expect(getLanguage("ja").id).toBe("ja");
  });
});

describe("input conversion", () => {
  const english = getLanguage("en");
  const japanese = getLanguage("ja");

  it("passes Latin input through untouched", () => {
    expect(convertInput("hello world", english)).toEqual({
      compare: "hello world",
      display: "hello world",
      pending: "",
    });
  });

  it("turns romaji into kana as it is typed", () => {
    expect(convertInput("konnichiha", japanese).compare).toBe("こんにちは");
    expect(convertInput("watashi", japanese).compare).toBe("わたし");
    expect(convertInput("gakkou", japanese).compare).toBe("がっこう");
  });

  it("treats a half-typed syllable as in progress, not as a mistake", () => {
    // "k" is on the way to か; counting it wrong would punish correct typing.
    const partial = convertInput("k", japanese);
    expect(partial.compare).toBe("");
    expect(partial.pending).toBe("k");

    const midway = convertInput("watashik", japanese);
    expect(midway.compare).toBe("わたし");
    expect(midway.pending).toBe("k");
  });

  it("scores a correct Japanese run as fully accurate", () => {
    const target = "わたしはがくせいです";
    const typed = "watashihagakuseidesu";
    const stats = computeTypingStats(target, convertInput(typed, japanese).compare, 10);
    expect(stats.accuracy).toBe(100);
    expect(stats.incorrectChars).toBe(0);
  });

  it("does not count a trailing partial syllable against accuracy", () => {
    const target = "わたしはがくせいです";
    const stats = computeTypingStats(target, convertInput("watashik", japanese).compare, 10);
    expect(stats.incorrectChars).toBe(0);
  });
});

describe("prompt generation", () => {
  it("draws only from the language's own pool", () => {
    for (const language of TYPING_LANGUAGES) {
      const text = generateTypingText(40, 1, language.words);
      for (const word of text.split(" ")) {
        expect(language.words, language.name).toContain(word);
      }
    }
  });

  it("is deterministic for a seed, which Typing Battle depends on", () => {
    expect(generateTypingText(30, 42)).toBe(generateTypingText(30, 42));
    const japanese = getLanguage("ja");
    expect(generateTypingText(30, 7, japanese.words)).toBe(
      generateTypingText(30, 7, japanese.words),
    );
  });

  it("still defaults to English for callers that pass no pool", () => {
    const text = generateTypingText(20, 3);
    expect(/^[a-z ]+$/.test(text)).toBe(true);
  });

  it("produces the requested number of words", () => {
    expect(generateTypingText(25, 5).split(" ")).toHaveLength(25);
  });
});
