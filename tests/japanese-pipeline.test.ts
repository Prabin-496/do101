import { beforeAll, describe, expect, it } from "vitest";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "@sglkc/kuromoji";
import { analyse } from "../src/lib/japanese/annotate";
import { hasJapanese } from "../src/lib/japanese/kana";
import { stripRuby } from "../src/lib/japanese/ruby";
import { readFileSync } from "node:fs";

/**
 * The reading pipeline, against the Japanese that exposed it.
 *
 * Every expectation here started as a reported defect: words read one kanji at
 * a time (従業員 → "gyōin"), ruby annotations romanised twice
 * ("muzuka（muzuka）shi"), conjugations split into morphemes
 * ("kangae rare te i mashi ta"), and kanji left sitting inside the romaji.
 */

/** The sentence the reader asked to be used as the acceptance case. */
const SENTENCE =
  "近年、在宅勤務を導入している企業が増えていますが、これに伴い、従業員の働き方に対する意識も変化しています。";

/** A real announcement, with inline ruby as it is actually written. */
const PARAGRAPH = `最近、在宅勤務を導入する企業が増（ふ）えています。
それに伴（ともな）い、職場での自己管理の難（むずか）しさが課題として広まっています。
近年、従業員の意識は大きく変化しており、新たな取り組みが求（もと）められています。
ウィツ株式会社では、生成AI研究会を通じて、WITS全体のAI活用を進めています。`;

describe("the reading pipeline", () => {
  let tokenizer: Tokenizer<IpadicFeatures>;

  beforeAll(async () => {
    tokenizer = await new Promise((resolve, reject) => {
      kuromoji
        .builder({ dicPath: "./node_modules/@sglkc/kuromoji/dict" })
        .build((error, built) => (error ? reject(error) : resolve(built)));
    });
  }, 60_000);

  const read = (text: string) => analyse(text, { tokenizer });

  it("reads a multi-kanji word as one word, not as its characters", () => {
    for (const [word, romaji] of [
      ["在宅勤務", "zaitaku kinmu"],
      ["導入", "dōnyū"],
      ["従業員", "jūgyōin"],
      ["取り組み", "torikumi"],
      ["職場", "shokuba"],
      ["自己管理", "jiko kanri"],
      ["困難", "konnan"],
      ["発生", "hassei"],
      ["近年", "kinnen"],
      ["新たな", "aratana"],
      ["社員", "shain"],
      ["新入社員", "shinnyū shain"],
      ["最近", "saikin"],
      ["実際", "jissai"],
      ["難しさ", "muzukashisa"],
    ] as const) {
      expect(read(word).romaji, word).toBe(romaji);
    }
  });

  it("keeps a conjugated verb in one piece", () => {
    for (const [word, romaji] of [
      ["増えています", "fueteimasu"],
      ["考えられていました", "kangaerareteimashita"],
      ["広まっています", "hiromatteimasu"],
      ["増えている", "fueteiru"],
      ["求められています", "motomerareteimasu"],
      ["している", "shiteiru"],
    ] as const) {
      expect(read(word).romaji, word).toBe(romaji);
    }
  });

  describe("the acceptance sentence", () => {
    it("contains no Japanese character in the romaji", () => {
      const romaji = read(SENTENCE).romaji;
      expect(hasJapanese(romaji), romaji).toBe(false);
    });

    it("contains no unresolved marker", () => {
      expect(read(SENTENCE).romaji).not.toContain("?");
      expect(read(SENTENCE).unresolved).toEqual([]);
    });

    it("segments it into the expected words", () => {
      const surfaces = read(SENTENCE)
        .tokens.map((t) => t.surface)
        .filter((surface) => /[^\s、。]/.test(surface) && surface !== "、" && surface !== "。");
      // IPADIC splits 在宅勤務 into its two nouns and reads them 在宅 + 勤務,
      // which is the same reading either way; what matters is that a
      // conjugation stays whole and a particle stays separate.
      for (const word of [
        "近年", "在宅", "勤務", "を", "導入", "している", "企業", "が",
        "増えています", "これ", "に", "伴い", "従業員", "の", "働き方",
        "対する", "意識", "も", "変化", "しています",
      ]) {
        expect(surfaces, word).toContain(word);
      }
    });

    it("reads it correctly end to end", () => {
      expect(read(SENTENCE).romaji).toBe(
        "kinnen、zaitaku kinmu o dōnyū shiteiru kigyō ga fueteimasu ga、" +
          "kore ni tomonai、jūgyōin no hatarakikata ni taisuru ishiki mo henka shiteimasu。",
      );
    });
  });

  describe("the real paragraph", () => {
    const lines = PARAGRAPH.split("\n");

    it("never lets a kanji into the romaji", () => {
      for (const line of lines) {
        const romaji = read(line).romaji;
        expect(hasJapanese(romaji), line).toBe(false);
      }
    });

    it("never prints an unresolved marker", () => {
      for (const line of lines) {
        expect(read(line).romaji, line).not.toContain("?");
      }
    });

    it("never repeats a ruby reading or leaves its brackets behind", () => {
      const romaji = lines.map((line) => read(line).romaji).join(" ");
      // "muzuka（muzuka）shi" and "ma（fu）eteiru" were the reported shapes.
      expect(romaji).not.toMatch(/[（）()]/);
      // The reported shapes: the kanji read on its own, then the annotation
      // romanised again right after it. A generic "no repeated syllable" rule
      // cannot be used here — 生成 is legitimately "seisei".
      for (const broken of [
        "muzuka（muzuka）shi", "muzukamuzuka", "muzuka muzuka",
        "tomona（tomona）tte", "tomonatomona",
        "ma（fu）eteiru", "mafu", "zōfu", "mafueteiru",
        "moto（moto）", "motomoto merare",
      ]) {
        expect(romaji, broken).not.toContain(broken);
      }
      expect(romaji).toContain("fueteimasu");
      expect(romaji).toContain("muzukashisa");
      expect(romaji).toContain("tomonai");
      expect(romaji).toContain("motomerareteimasu");
    });

    it("never splits a word into single characters", () => {
      const romaji = lines.map((line) => read(line).romaji).join(" ");
      expect(romaji).toContain("torikumi");
      expect(romaji).not.toContain("to ri kumi");
      expect(romaji).toContain("kabushikigaisha");
    });

    it("leaves Latin text, acronyms and punctuation alone", () => {
      const romaji = read(lines[3]).romaji;
      expect(romaji).toContain("AI");
      expect(romaji).toContain("WITS");
      expect(romaji).toContain("。");
    });
  });

  it("reads a compound particle as a particle plus a word", () => {
    // IPADIC stores these whole, which produced "nitaisuru" and "wotsūjite".
    expect(read("に対する").romaji).toBe("ni taisuru");
    expect(read("を通じて").romaji).toBe("o tsūjite");
  });

  describe("inline ruby", () => {
    it("takes the annotation out and keeps it as the reading", () => {
      const { text, readings, found } = stripRuby("増（ふ）えている");
      expect(text).toBe("増えている");
      expect(found).toBe(true);
      expect(readings.get(0)).toEqual({ surface: "増", reading: "ふ" });
    });

    it("leaves ordinary brackets alone", () => {
      // Not ruby: no kanji in front, or the contents are not kana.
      for (const text of ["（笑）", "これ(see below)は", "会議（10時）"]) {
        expect(stripRuby(text).text, text).toBe(text);
      }
    });

    it("uses the author's reading when the analyser has nothing", () => {
      // No tokenizer at all: the annotation is the only reading available.
      const romaji = analyse("難（むずか）しさ").romaji;
      expect(romaji).not.toMatch(/[（）]/);
      expect(romaji).toContain("muzuka");
    });
  });

  it("does not let CSS lowercase the romaji it just got right", () => {
    // The analyser preserved "AI" and "WITS" correctly, and a `lowercase`
    // utility class on the romaji elements flattened them to "ai" and "wits"
    // anyway. No amount of testing the analyser catches that, so the rendering
    // is asserted here instead.
    const component = readFileSync(
      "src/components/tools/japanese/JapaneseTranslator.tsx",
      "utf8",
    );
    expect(component).not.toContain("lowercase");
  });

  it("never puts a kanji in the romaji even with no analyser at all", () => {
    for (const line of [SENTENCE, ...PARAGRAPH.split("\n")]) {
      expect(hasJapanese(analyse(line).romaji), line).toBe(false);
    }
  });
});
