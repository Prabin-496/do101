import { beforeAll, describe, expect, it } from "vitest";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "@sglkc/kuromoji";
import { analyse } from "../src/lib/japanese/annotate";
import { readingSpans } from "../src/lib/japanese/tokenizer";

/**
 * The analyser path, against the Japanese it was added for.
 *
 * Every case here is a reading the bundled vocabulary got wrong or refused —
 * taken from a company announcement, which is the kind of text that runs
 * straight past a learner's word list.
 *
 * In the browser the dictionary is fetched from /kuromoji/dict; here it is read
 * off disk, which is the one difference between the two.
 */
describe("readings from the full dictionary", () => {
  let tokenizer: Tokenizer<IpadicFeatures>;

  beforeAll(async () => {
    tokenizer = await new Promise((resolve, reject) => {
      kuromoji
        .builder({ dicPath: "./node_modules/@sglkc/kuromoji/dict" })
        .build((error, built) => (error ? reject(error) : resolve(built)));
    });
  }, 60_000);

  const read = (text: string) =>
    analyse(text, { readings: readingSpans(text, tokenizer) });

  it("reads what the bundled vocabulary could not", () => {
    for (const [text, romaji] of [
      // Was "sen'ya" — a surname read with on'yomi.
      ["浅野", "asano"],
      // Was "? shiki kaisha" — 株 is not in the bundled kanji list at all.
      ["株式会社", "kabushikigaisha"],
      // Was "to ri kumi mi" — read one character at a time.
      ["取り組み", "torikumi"],
      ["台湾", "taiwan"],
      ["皆さん", "minasan"],
      ["掲げる", "kakageru"],
      ["育成", "ikusei"],
      ["幅広い", "habahiroi"],
      ["実践", "jissen"],
      ["記事", "kiji"],
      ["背景", "haikei"],
      ["機会", "kikai"],
      ["広報", "kōhō"],
    ] as const) {
      expect(read(text).romaji, text).toBe(romaji);
    }
  });

  it("leaves nothing unresolved in a real announcement", () => {
    const text =
      "ウィツ株式会社では、社内の取り組みや社員インタビュー、イベントレポートなどを公式noteで発信しています。";
    const analysis = read(text);
    expect(analysis.unresolved).toEqual([]);
    expect(analysis.romaji).not.toContain("?");
    expect(analysis.hiragana).not.toContain("？");
  });

  it("still romanises a particle by its sound, not its name", () => {
    // IPADIC reads は as ハ. Romanising that "ha" is the mistake the tool exists
    // to prevent, so the particle rule has to survive the analyser.
    expect(read("駅はどこですか").romaji).toContain("wa");
    expect(read("駅はどこですか").romaji).not.toContain("ha ");
  });

  it("marks analyser readings as exact rather than guessed", () => {
    const tokens = read("生成AI研究会").tokens;
    expect(tokens.some((t) => t.confidence === "approximate")).toBe(false);
    // Latin runs have no reading and are passed through untouched.
    expect(tokens.find((t) => t.surface === "AI")?.source).toBe("other");
  });

  it("gives a Latin word inside Japanese its own space", () => {
    // 公式note で was running together as "kōshikinotede".
    expect(read("公式noteで発信").romaji).toContain("kōshiki note de");
  });

  it("still keeps punctuation attached to the word before it", () => {
    expect(read("駅はどこですか。").romaji).not.toContain(" 。");
  });

  it("does not turn punctuation into a spaced-out word", () => {
    // IPADIC calls 「 a 記号 and gives it a reading; that made the romaji read
    // "desu ！ markting" and "「 seisei".
    const romaji = read("です！「生成AI」").romaji;
    expect(romaji).not.toMatch(/ [！「」・。、]/);
    expect(romaji).not.toMatch(/[！「」・] /);
  });

  it("keeps a small tsu doubling across a token boundary", () => {
    // The analyser splits なっている into なっ|て|いる. Romanised apart, the なっ
    // has no following syllable to double and came out "na te iru".
    expect(read("なっている").romaji).toContain("natte");
    expect(read("となった").romaji).toContain("natta");
    expect(read("行ってきます").romaji).toContain("itte");
  });

  it("romanises loanword kana that only exist in katakana", () => {
    // Readings arrive in katakana and are folded to hiragana before they are
    // romanised, so ふぉ needed an entry of its own — スマートフォン was "sumaato fuon".
    // The analyser splits this into スマート|フォン, so the space is its word
    // boundary and not a mistake; what matters is "fon" rather than "fuon".
    expect(read("スマートフォン").romaji).toBe("sumaato fon");
    expect(read("ウェブ").romaji).toBe("webu");
    expect(read("チェック").romaji).toBe("chekku");
  });

  it("falls back to the bundled vocabulary when no analyser is loaded", () => {
    // The whole point of the fallback: still readings, just worse ones.
    expect(analyse("台湾").romaji).toBe("daiwan");
    expect(analyse("台湾", { readings: readingSpans("台湾", null) }).romaji).toBe("daiwan");
  });
});
