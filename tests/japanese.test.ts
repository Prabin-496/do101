import { describe, expect, it } from "vitest";
import {
  hasJapanese, isKana, isKanji, kanaToRomaji, romajiToKana,
  toHiragana, toKatakana, typingSteps, typingString,
} from "../src/lib/japanese/kana";
import { annotate, kanjiIn } from "../src/lib/japanese/annotate";
import { KANJI, WORDS } from "../src/lib/japanese/dictionary";
import { splitForTranslation, worthTranslating } from "../src/lib/japanese/translate";

describe("kana to romaji", () => {
  it("romanises everyday words in modified Hepburn", () => {
    const cases: Record<string, string> = {
      こんにちは: "konnichiha",
      ありがとう: "arigatou",
      とうきょう: "toukyou",
      にほんご: "nihongo",
      でんしゃ: "densha",
      しゃしん: "shashin",
      ふじさん: "fujisan",
      つづく: "tsuzuku",
    };
    for (const [kana, romaji] of Object.entries(cases)) {
      expect(kanaToRomaji(kana), kana).toBe(romaji);
    }
  });

  it("doubles the consonant after a small tsu", () => {
    expect(kanaToRomaji("がっこう")).toBe("gakkou");
    expect(kanaToRomaji("きって")).toBe("kitte");
    expect(kanaToRomaji("いっしょ")).toBe("issho");
    expect(kanaToRomaji("ちょっと")).toBe("chotto");
  });

  it("writes っち as tchi, following Hepburn", () => {
    expect(kanaToRomaji("まっちゃ")).toBe("matcha");
  });

  it("marks syllabic n before a vowel so it cannot be misread", () => {
    // Without the apostrophe "kinen" would be read ki-ne-n rather than kin-en.
    expect(kanaToRomaji("きんえん")).toBe("kin'en");
    expect(kanaToRomaji("しんぶん")).toBe("shinbun");
  });

  it("holds the vowel across the katakana long mark", () => {
    expect(kanaToRomaji("ラーメン")).toBe("raamen");
    expect(kanaToRomaji("コーヒー")).toBe("koohii");
  });

  it("leaves anything that is not kana untouched", () => {
    expect(kanaToRomaji("ABC 123")).toBe("ABC 123");
    expect(kanaToRomaji("日本")).toBe("日本");
  });
});

describe("romaji to kana", () => {
  it("converts the way a Japanese IME does", () => {
    const cases: Record<string, string> = {
      konnichiwa: "こんにちわ",
      nihongo: "にほんご",
      gakkou: "がっこう",
      kitte: "きって",
      sensei: "せんせい",
      denwa: "でんわ",
      kanji: "かんじ",
      arigatou: "ありがとう",
    };
    for (const [romaji, kana] of Object.entries(cases)) {
      expect(romajiToKana(romaji), romaji).toBe(kana);
    }
  });

  it("treats nn before a vowel as ん plus a new syllable", () => {
    // This is why typing "konnichiwa" gives こんにちわ, not こんいちわ.
    expect(romajiToKana("konnichiha")).toBe("こんにちは");
    expect(romajiToKana("annai")).toBe("あんない");
  });

  it("makes a small tsu from a doubled consonant, including tch", () => {
    expect(romajiToKana("matcha")).toBe("まっちゃ");
    expect(romajiToKana("chotto")).toBe("ちょっと");
  });

  it("accepts the alternative spellings an IME accepts", () => {
    expect(romajiToKana("si")).toBe("し");
    expect(romajiToKana("tu")).toBe("つ");
    expect(romajiToKana("hu")).toBe("ふ");
    expect(romajiToKana("sya")).toBe("しゃ");
  });

  it("round-trips through romaji and back", () => {
    for (const word of ["にほんご", "がっこう", "でんしゃ", "ありがとう", "きって"]) {
      expect(romajiToKana(kanaToRomaji(word)), word).toBe(word);
    }
  });

  it("can produce katakana", () => {
    expect(romajiToKana("ramen", true)).toBe("ラメン");
    expect(romajiToKana("ko-hi-", true)).toBe("コーヒー");
  });
});

describe("script conversion", () => {
  it("converts between the syllabaries and leaves the rest alone", () => {
    expect(toKatakana("すし")).toBe("スシ");
    expect(toHiragana("スシ")).toBe("すし");
    expect(toKatakana("日本のすし")).toBe("日本ノスシ");
  });

  it("identifies scripts", () => {
    expect(isKana("あ")).toBe(true);
    expect(isKana("ア")).toBe(true);
    expect(isKanji("日")).toBe(true);
    expect(isKanji("あ")).toBe(false);
    expect(hasJapanese("hello")).toBe(false);
    expect(hasJapanese("hello 日本")).toBe(true);
  });
});

describe("typing guide", () => {
  it("gives keystrokes that an IME would accept", () => {
    expect(typingString("がっこう")).toBe("gakkou");
    // ん is always typed "nn", which is unambiguous wherever it appears.
    expect(typingString("こんにちは")).toBe("konnnichiha");
  });

  it("does not pretend kanji can be typed directly", () => {
    const steps = typingSteps("日本語");
    expect(steps).toHaveLength(1);
    expect(steps[0].keys).toBe("");
    expect(steps[0].note).toMatch(/reading/i);
  });

  it("offers alternative spellings where they exist", () => {
    const shi = typingSteps("し")[0];
    expect(shi.keys).toBe("shi");
    expect(shi.alternatives).toContain("si");
  });
});

describe("reading annotation", () => {
  it("prefers the longest dictionary match", () => {
    // 日本人 must not be read as 日 + 本 + 人.
    const result = annotate("日本人");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].reading).toBe("にほんじん");
    expect(result.romaji).toBe("nihonjin");
  });

  it("reads kana exactly and marks it as exact", () => {
    const result = annotate("ありがとう");
    expect(result.tokens[0].source).toBe("kana");
    expect(result.hiragana).toBe("ありがとう");
  });

  it("marks a lone kanji reading as approximate rather than certain", () => {
    const result = annotate("鉛");
    const token = result.tokens[0];
    // Not in the bundled list, so nothing is invented.
    expect(token.source).toBe("unknown");
    expect(token.reading).toBe("");
    expect(result.unknown).toContain("鉛");
  });

  it("never claims to be complete when a reading was guessed", () => {
    expect(annotate("ありがとう").complete).toBe(true);
    // 山 is a dictionary word, so its reading is reliable.
    expect(annotate("山").complete).toBe(true);
    // 村 is only in the single-kanji list, so the reading is a standalone guess.
    expect(annotate("村").complete).toBe(false);
    expect(annotate("村").tokens[0].source).toBe("kanji");
  });

  it("keeps punctuation and Latin text unchanged", () => {
    const result = annotate("Hello、日本！");
    expect(result.hiragana).toContain("Hello");
    expect(result.hiragana).toContain("、");
    expect(result.hiragana).toContain("！");
  });

  it("produces all three scripts for a mixed sentence", () => {
    const result = annotate("私は学生です");
    expect(result.hiragana).toBe("わたしはがくせいです");
    expect(result.katakana).toBe("ワタシハガクセイデス");
    // は is the topic particle here, so it is read "wa" rather than "ha".
    expect(result.romaji.replace(/\s+/g, "")).toBe("watashiwagakuseidesu");
  });

it("reads the three irregular particles as they are pronounced", () => {
    // Written は/へ/を, pronounced wa/e/o when they act as particles.
    expect(annotate("私は学生です").romaji).toContain("watashi wa");
    expect(annotate("日本語を勉強します").romaji).toContain("nihongo o");
    expect(annotate("東京へ行きます").romaji).toContain("toukyou e");
  });

  it("does not mistake は inside a word for a particle", () => {
    // はな is a word, not a particle, so it stays "hana".
    expect(annotate("はな").romaji).toBe("hana");
    expect(annotate("はやい").romaji).toBe("hayai");
  });

  it("lists the kanji it recognises", () => {
    const found = kanjiIn("日本語を勉強します");
    expect(found.map((k) => k.kanji)).toContain("日");
    expect(found.map((k) => k.kanji)).toContain("語");
  });
});

describe("dictionary integrity", () => {
  it("gives every word a kana-only reading", () => {
    for (const entry of WORDS) {
      expect(entry.reading, entry.word).toMatch(/^[ぁ-ゖー]+$/);
      expect(entry.meaning, entry.word).toBeTruthy();
    }
  });

  it("stores on readings in katakana and kun readings in hiragana", () => {
    for (const entry of KANJI) {
      for (const on of entry.on) expect(on, `${entry.kanji} on`).toMatch(/^[ァ-ヺー]+$/);
      for (const kun of entry.kun) expect(kun, `${entry.kanji} kun`).toMatch(/^[ぁ-ゖー]+$/);
      expect(entry.meaning, entry.kanji).toBeTruthy();
    }
  });

  it("holds a single kanji character per kanji entry", () => {
    for (const entry of KANJI) {
      expect([...entry.kanji], entry.kanji).toHaveLength(1);
    }
  });

  it("lists no duplicate words or kanji", () => {
    const words = WORDS.map((w) => w.word);
    const kanji = KANJI.map((k) => k.kanji);
    expect(new Set(words).size, "duplicate words").toBe(words.length);
    expect(new Set(kanji).size, "duplicate kanji").toBe(kanji.length);
  });
});

describe("translation chunking", () => {
  it("leaves short text as one request", () => {
    expect(splitForTranslation("Hello there")).toEqual(["Hello there"]);
    expect(splitForTranslation("   ")).toEqual([]);
  });

  it("splits long text on sentence boundaries", () => {
    const sentence = "This is a reasonably long sentence used for testing. ";
    const chunks = splitForTranslation(sentence.repeat(20));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(480);
  });

  it("keeps every word when it splits", () => {
    const original = "One. Two. Three. ".repeat(40);
    const rejoined = splitForTranslation(original).join(" ").replace(/\s+/g, " ").trim();
    expect(rejoined).toBe(original.replace(/\s+/g, " ").trim());
  });

  it("breaks a single sentence that is longer than the limit", () => {
    const chunks = splitForTranslation("word ".repeat(300));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(480);
  });
});

describe("whole-sentence readings", () => {
  /**
   * Real sentences, with the reading and romanisation a learner should see.
   * Each one previously came out wrong in a different way — a greeting
   * colliding with a date, a missing word splitting into single kanji, an
   * inflected verb breaking apart — so they stay here as regressions.
   */
  const CASES: Array<[japanese: string, kana: string, romaji: string]> = [
    [
      "私は毎日日本語を勉強しています。",
      "わたしはまいにちにほんごをべんきょうしています。",
      "watashi wa mainichi nihongo o benkyou shiteimasu。",
    ],
    ["最寄りの駅はどこですか。", "もよりのえきはどこですか。", "moyori no eki wa dokodesuka。"],
    // 今日は must read "kyou wa" (today), not "konnichiha" (hello).
    ["今日は天気がいいですね。", "きょうはてんきがいいですね。", "kyou wa tenki ga iidesune。"],
    [
      "この電車は東京へ行きますか。",
      "このでんしゃはとうきょうへいきますか。",
      "kono densha wa toukyou e ikimasu ka。",
    ],
    // 彼女 is one word; reading it as 彼 + 女 gives "onna" and loses the meaning.
    [
      "彼女は大学で科学を教えています。",
      "かのじょはだいがくでかがくをおしえています。",
      "kanojo wa daigaku de kagaku o oshieteimasu。",
    ],
    // 行きました is an inflection of 行く, not 行 followed by きました.
    [
      "友達と映画を見に行きました。",
      "ともだちとえいがをみにいきました。",
      "tomodachi to eiga o mi ni ikimashita。",
    ],
    // 三時 is "sanji", not 三 followed by 時 read as "toki".
    ["会議は三時に始まります。", "かいぎはさんじにはじまります。", "kaigi wa sanji ni hajimarimasu。"],
  ];

  it.each(CASES)("reads %s", (japanese, kana, romaji) => {
    const result = annotate(japanese);
    expect(result.hiragana).toBe(kana);
    expect(result.romaji).toBe(romaji);
  });

  it("leaves nothing unread in these sentences", () => {
    for (const [japanese] of CASES) {
      expect(annotate(japanese).unknown, japanese).toEqual([]);
    }
  });

  it("reads inflections of a verb it only knows in dictionary form", () => {
    // 書く is listed; none of these forms are.
    for (const [text, reading] of [
      ["書きます", "かきます"],
      ["書きました", "かきました"],
      ["書かない", "かかない"],
      ["書いています", "かいています"],
    ] as const) {
      expect(annotate(text).hiragana, text).toBe(reading);
    }
  });

  it("does not let okurigana swallow a following particle", () => {
    // 見に行く is 見 + に + 行く, so the ending stops at the particle.
    const tokens = annotate("見に行く").tokens;
    expect(tokens.map((t) => t.surface)).toEqual(["見", "に", "行く"]);
  });
});

describe("translation cache", () => {
  it("skips fragments too short to be worth a request", () => {
    expect(worthTranslating("", "en-ja")).toBe(false);
    expect(worthTranslating("t", "en-ja")).toBe(false);
    expect(worthTranslating("go", "en-ja")).toBe(true);
    // A single kanji is a whole word, so Japanese needs a lower bar.
    expect(worthTranslating("駅", "ja-en")).toBe(true);
  });
});
