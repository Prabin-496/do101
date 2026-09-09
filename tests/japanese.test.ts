import { describe, expect, it } from "vitest";
import {
  hasJapanese, isKana, isKanji, kanaToRomaji, romajiToKana,
  toHiragana, toKatakana, typingSteps, typingString,
} from "../src/lib/japanese/kana";
import { analyse, analyseLines, kanjiIn } from "../src/lib/japanese/annotate";
import { KANJI, WORDS } from "../src/lib/japanese/dictionary";
import { splitForTranslation, worthTranslating } from "../src/lib/japanese/translate";
import { checkPoliteness, toMasuForm } from "../src/lib/japanese/politeness";

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
    const result = analyse("日本人");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].reading).toBe("にほんじん");
    expect(result.romaji).toBe("nihonjin");
  });

  it("reads kana exactly and marks it as exact", () => {
    const result = analyse("ありがとう");
    expect(result.tokens[0].source).toBe("kana");
    expect(result.hiragana).toBe("ありがとう");
  });

  it("marks a lone kanji reading as approximate rather than certain", () => {
    const result = analyse("鉛");
    const token = result.tokens[0];
    // Not in the bundled list, so nothing is invented.
    expect(token.source).toBe("unresolved");
    expect(token.reading).toBe("");
    expect(result.unresolved).toContain("鉛");
  });

  it("never claims to be complete when a reading was guessed", () => {
    expect(analyse("ありがとう").complete).toBe(true);
    // 山 is a dictionary word, so its reading is reliable.
    expect(analyse("山").complete).toBe(true);
    // 村 is only in the single-kanji list, so the reading is a standalone guess.
    expect(analyse("村").complete).toBe(false);
    expect(analyse("村").tokens[0].source).toBe("kanji");
  });

  it("keeps punctuation and Latin text unchanged", () => {
    const result = analyse("Hello、日本！");
    expect(result.hiragana).toContain("Hello");
    expect(result.hiragana).toContain("、");
    expect(result.hiragana).toContain("！");
  });

  it("produces all three scripts for a mixed sentence", () => {
    const result = analyse("私は学生です");
    expect(result.hiragana).toBe("わたしはがくせいです");
    expect(result.katakana).toBe("ワタシハガクセイデス");
    // は is the topic particle here, so it is read "wa" rather than "ha".
    expect(result.romaji.replace(/\s+/g, "")).toBe("watashiwagakuseidesu");
  });

it("reads the three irregular particles as they are pronounced", () => {
    // Written は/へ/を, pronounced wa/e/o when they act as particles.
    expect(analyse("私は学生です").romaji).toContain("watashi wa");
    expect(analyse("日本語を勉強します").romaji).toContain("nihongo o");
    expect(analyse("東京へ行きます").romaji).toContain("tōkyō e");
  });

  it("does not mistake は inside a word for a particle", () => {
    // はな is a word, not a particle, so it stays "hana".
    expect(analyse("はな").romaji).toBe("hana");
    expect(analyse("はやい").romaji).toBe("hayai");
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
      "watashi wa mainichi nihongo o benkyō shiteimasu。",
    ],
    ["最寄りの駅はどこですか。", "もよりのえきはどこですか。", "moyori no eki wa dokodesuka。"],
    // 今日は must read "kyou wa" (today), not "konnichiha" (hello).
    ["今日は天気がいいですね。", "きょうはてんきがいいですね。", "kyō wa tenki ga iidesune。"],
    [
      "この電車は東京へ行きますか。",
      "このでんしゃはとうきょうへいきますか。",
      "kono densha wa tōkyō e ikimasu ka。",
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
    const result = analyse(japanese);
    expect(result.hiragana).toBe(kana);
    expect(result.romaji).toBe(romaji);
  });

  it("leaves nothing unread in these sentences", () => {
    for (const [japanese] of CASES) {
      expect(analyse(japanese).unresolved, japanese).toEqual([]);
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
      expect(analyse(text).hiragana, text).toBe(reading);
    }
  });

  it("does not let okurigana swallow a following particle", () => {
    // 見に行く is 見 + に + 行く, so the ending stops at the particle.
    const tokens = analyse("見に行く").tokens;
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

/**
 * The bug this suite exists for.
 *
 * 私はこの会社の新入社員です was read as "watashi wa kono kaisha no atara hai
 * yashiro 員 desu": the parser fell through to per-character kun readings
 * before ever trying 新入社員 as vocabulary, and 員 — which had no entry at all
 * — leaked into the romaji as a raw kanji.
 */
describe("compound recognition", () => {
  const HAS_KANJI = /[一-鿿]/;

  it("reads 新入社員 as vocabulary rather than four separate kanji", () => {
    const result = analyse("私はこの会社の新入社員です");
    expect(result.romaji).toBe("watashi wa kono kaisha no shinnyū shain desu");
    expect(result.hiragana).toBe("わたしはこのかいしゃのしんにゅうしゃいんです");
  });

  it("never leaves 員 in the romaji", () => {
    for (const text of ["新入社員", "会社員", "社員", "正社員", "私はこの会社の新入社員です"]) {
      expect(analyse(text).romaji, text).not.toContain("員");
    }
  });

  it("puts no kanji at all into the romaji, whatever the input", () => {
    const corpus = [
      "私はこの会社の新入社員です",
      "彼女は大学で科学を教えています。",
      "来週の月曜日に東京へ出張します。",
      "この書類を課長に提出しました。",
      "駅の近くに新しい喫茶店ができました。",
      // Deliberately obscure, to exercise the unresolved path.
      "檸檬と葡萄を買いました。",
      "鬱蒼とした森を歩く。",
    ];
    for (const text of corpus) {
      expect(HAS_KANJI.test(analyse(text).romaji), text).toBe(false);
    }
  });

  it("marks a character it cannot read instead of passing it through", () => {
    const result = analyse("檸檬");
    expect(result.unresolved.length).toBeGreaterThan(0);
    expect(HAS_KANJI.test(result.romaji)).toBe(false);
    expect(result.romaji).toContain("?");
    // The original is still available, just kept separately from the reading.
    expect(result.tokens.map((t) => t.surface).join("")).toBe("檸檬");
  });

  it("reads 30 common compounds correctly", () => {
    const COMPOUNDS: Array<[word: string, reading: string, romaji: string]> = [
      ["新入社員", "しんにゅうしゃいん", "shinnyū shain"],
      ["会社", "かいしゃ", "kaisha"],
      ["日本語", "にほんご", "nihongo"],
      ["勉強", "べんきょう", "benkyō"],
      ["今日", "きょう", "kyō"],
      ["大学生", "だいがくせい", "daigakusei"],
      ["社員", "しゃいん", "shain"],
      ["会議室", "かいぎしつ", "kaigishitsu"],
      ["電話番号", "でんわばんごう", "denwabangō"],
      ["図書館", "としょかん", "toshokan"],
      ["自転車", "じてんしゃ", "jitensha"],
      ["新幹線", "しんかんせん", "shinkansen"],
      ["飛行機", "ひこうき", "hikōki"],
      ["郵便局", "ゆうびんきょく", "yūbinkyoku"],
      ["高校生", "こうこうせい", "kōkōsei"],
      ["留学生", "りゅうがくせい", "ryūgakusei"],
      ["天気予報", "てんきよほう", "tenkiyohō"],
      ["誕生日", "たんじょうび", "tanjōbi"],
      ["月曜日", "げつようび", "getsuyōbi"],
      ["日曜日", "にちようび", "nichiyōbi"],
      ["喫茶店", "きっさてん", "kissaten"],
      ["美術館", "びじゅつかん", "bijutsukan"],
      ["冷蔵庫", "れいぞうこ", "reizōko"],
      ["携帯電話", "けいたいでんわ", "keitaidenwa"],
      ["履歴書", "りれきしょ", "rirekisho"],
      ["打ち合わせ", "うちあわせ", "uchiawase"],
      ["出張", "しゅっちょう", "shutchō"],
      ["残業", "ざんぎょう", "zangyō"],
      ["給料", "きゅうりょう", "kyūryō"],
      ["確認", "かくにん", "kakunin"],
      ["説明", "せつめい", "setsumei"],
      ["経済", "けいざい", "keizai"],
      ["環境", "かんきょう", "kankyō"],
      ["文化", "ぶんか", "bunka"],
    ];

    for (const [word, reading, romaji] of COMPOUNDS) {
      const result = analyse(word);
      expect(result.hiragana, `${word} reading`).toBe(reading);
      expect(result.romaji, `${word} romaji`).toBe(romaji);
    }
  });

  it("reads 12 conjugated forms correctly", () => {
    const CONJUGATED: Array<[word: string, reading: string, romaji: string]> = [
      ["行きました", "いきました", "ikimashita"],
      ["食べました", "たべました", "tabemashita"],
      ["見ています", "みています", "miteimasu"],
      ["飲みませんでした", "のみませんでした", "nomimasendeshita"],
      ["読んでいます", "よんでいます", "yondeimasu"],
      ["書かない", "かかない", "kakanai"],
      ["話しました", "はなしました", "hanashimashita"],
      ["働いています", "はたらいています", "hataraiteimasu"],
      ["始まります", "はじまります", "hajimarimasu"],
      ["終わりました", "おわりました", "owarimashita"],
      ["覚えています", "おぼえています", "oboeteimasu"],
      ["忘れました", "わすれました", "wasuremashita"],
    ];

    for (const [word, reading, romaji] of CONJUGATED) {
      const result = analyse(word);
      expect(result.hiragana, `${word} reading`).toBe(reading);
      expect(result.romaji, `${word} romaji`).toBe(romaji);
    }
  });

  it("prefers vocabulary over a per-character reading at every position", () => {
    // If the fallback ever ran first, these would come out as kun readings.
    const result = analyse("会社");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].source).toBe("word");
  });

  it("falls back to on'yomi inside a compound, not kun'yomi", () => {
    // 新製品 is not in the vocabulary as one word, so it is segmented; the
    // leftover 新 must read シン, not あたら.
    const result = analyse("新製品");
    expect(result.hiragana).toBe("しんせいひん");
    expect(result.romaji).not.toContain("atara");
  });

  it("still uses kun'yomi for a kanji standing on its own", () => {
    // 村 is only in the single-kanji list; alone it takes its kun reading.
    expect(analyse("村").hiragana).toBe("むら");
  });

  it("keeps furigana, romaji and typing derived from the same analysis", () => {
    const result = analyse("私はこの会社の新入社員です");
    // The kana line is exactly the token readings concatenated.
    expect(result.tokens.map((t) => t.reading).join("")).toBe(result.hiragana);
    // The romaji is the token romaji, so the two can never disagree.
    expect(result.romaji.replace(/\s+/g, "")).toBe(
      result.tokens.map((t) => t.romaji).join(""),
    );
    // The typing guide comes from the same readings.
    expect(result.typing).toBe(result.tokens.map((t) => t.typing).join(""));
  });

  it("reports the kanji it met from the same pass", () => {
    const result = analyse("新入社員");
    expect(result.kanji.map((k) => k.kanji)).toEqual(["新", "入", "社", "員"]);
  });
});

describe("line independence", () => {
  it("analyses each line without the others affecting it", () => {
    const lines = analyseLines("私は学生です\n今日は暑い");
    expect(lines).toHaveLength(2);
    expect(lines[0].hiragana).toBe("わたしはがくせいです");
    expect(lines[1].hiragana).toBe("きょうはあつい");
  });

  it("gives the same reading for a line alone as within a block", () => {
    const alone = analyse("会議は三時に始まります。");
    const [, second] = analyseLines("こんにちは\n会議は三時に始まります。");
    expect(second.hiragana).toBe(alone.hiragana);
    expect(second.romaji).toBe(alone.romaji);
  });

  it("keeps blank lines without inventing content for them", () => {
    const lines = analyseLines("私\n\n学生");
    expect(lines).toHaveLength(3);
    expect(lines[1].tokens).toEqual([]);
    expect(lines[1].romaji).toBe("");
  });
});

/**
 * Word-level analysis before kanji-level fallback.
 *
 * Every case here previously came out wrong by reading the kanji one at a time:
 * 信者 as しんしゃ rather than しんじゃ, 国際 as くにさい because 国 has a
 * one-character dictionary entry carrying its kun reading, 開発 as かい？ because
 * 発 was missing entirely.
 */
describe("word-level readings", () => {
  const CASES: Array<[text: string, kana: string, romaji: string]> = [
    ["実業", "じつぎょう", "jitsugyō"],
    ["沢氏", "さわし", "sawashi"],
    ["友作", "ともさく", "tomosaku"],
    ["信者", "しんじゃ", "shinja"],
    ["総額", "そうがく", "sōgaku"],
    ["1億円", "いちおくえん", "ichioku-en"],
    ["与える", "あたえる", "ataeru"],
    ["配分", "はいぶん", "haibun"],
    ["注目", "ちゅうもく", "chūmoku"],
    ["簡単に", "かんたんに", "kantan ni"],
    ["申請すると", "しんせいすると", "shinsei suru to"],
    ["情報", "じょうほう", "jōhō"],
    ["危険", "きけん", "kiken"],
    ["開発環境", "かいはつかんきょう", "kaihatsu kankyō"],
    ["国際関係", "こくさいかんけい", "kokusai kankei"],
    ["経済成長", "けいざいせいちょう", "keizai seichō"],
  ];

  it.each(CASES)("reads %s", (text, kana, romaji) => {
    const result = analyse(text);
    expect(result.hiragana).toBe(kana);
    expect(result.romaji).toBe(romaji);
  });

  it("puts no question mark in the romaji for any of them", () => {
    for (const [text] of CASES) {
      expect(analyse(text).romaji, text).not.toContain("?");
      expect(analyse(text).unresolved, text).toEqual([]);
    }
  });

  it("reads a compound from its on'yomi, not the kun reading of a single-kanji entry", () => {
    // 国 alone is くに, but 国際 is こくさい — the entry must not win here.
    expect(analyse("国際").hiragana).toBe("こくさい");
    // Standing alone it still reads くに.
    expect(analyse("国").hiragana).toBe("くに");
  });

  it("merges neighbouring fallback characters into one word", () => {
    // 開発 is not in the vocabulary as a pair of characters to be read apart.
    const result = analyse("経済成長");
    expect(result.tokens.map((t) => t.surface)).toEqual(["経済", "成長"]);
  });
});

describe("Hepburn romanisation", () => {
  it("writes long vowels with macrons", () => {
    for (const [text, romaji] of [
      ["東京", "tōkyō"],
      ["学校", "gakkō"],
      ["空港", "kūkō"],
      ["環境", "kankyō"],
      ["勉強", "benkyō"],
      ["情報", "jōhō"],
    ] as const) {
      expect(analyse(text).romaji, text).toBe(romaji);
    }
  });

  it("leaves ei and ii alone, as Hepburn does", () => {
    expect(analyse("先生").romaji).toBe("sensei");
    expect(analyse("大学生").romaji).toBe("daigakusei");
  });

  it("does not put a macron across a verb ending", () => {
    // 思う is omou: the う is the verb ending, not a long vowel.
    expect(analyse("思う").romaji).toBe("omou");
    expect(analyse("使う").romaji).toBe("tsukau");
  });

  it("keeps the typing guide in keystroke spelling, not macrons", () => {
    // You cannot type "ō"; the typing line has to stay typeable.
    const result = analyse("東京");
    expect(result.romaji).toBe("tōkyō");
    expect(result.typing).toBe("toukyou");
  });
});

describe("politeness", () => {
  it("spots plain form and rewrites it into ですます", () => {
    for (const [plain, polite] of [
      ["私は学生だ。", "私は学生です。"],
      ["毎日日本語を勉強する。", "毎日日本語を勉強します。"],
      ["駅へ行く。", "駅へ行きます。"],
      ["水を飲む。", "水を飲みます。"],
      ["この本は面白い。", "この本は面白いです。"],
      ["彼は先生ではない。", "彼は先生ではありません。"],
    ] as const) {
      const report = checkPoliteness(plain);
      expect(report.register, plain).toBe("plain");
      expect(report.polite, plain).toBe(polite);
    }
  });

  it("leaves text that is already polite alone", () => {
    for (const text of ["私は学生です。", "駅へ行きます。", "お願いします。"]) {
      const report = checkPoliteness(text);
      expect(report.register, text).toBe("polite");
      expect(report.polite, text).toBeNull();
    }
  });

  it("declines to rewrite what it cannot do confidently", () => {
    // Past-tense plain forms need the verb reconstructed, which is beyond
    // these rules — so nothing is changed rather than changed wrongly.
    const report = checkPoliteness("昨日映画を見た。");
    expect(report.polite).toBeNull();
  });

  it("conjugates godan and ichidan verbs differently", () => {
    expect(toMasuForm("行く")).toBe("行きます");
    expect(toMasuForm("飲む")).toBe("飲みます");
    expect(toMasuForm("話す")).toBe("話します");
    // 見る is ichidan and drops る; 帰る is godan and shifts it.
    expect(toMasuForm("見る")).toBe("見ます");
    expect(toMasuForm("帰る")).toBe("帰ります");
    expect(toMasuForm("する")).toBe("します");
  });

  it("handles an empty document", () => {
    const report = checkPoliteness("");
    expect(report.register).toBe("unknown");
    expect(report.sentences).toEqual([]);
  });
});

describe("numerals and counters", () => {
  it("reads digits together with their magnitude and counter", () => {
    for (const [text, kana, romaji] of [
      ["1億円", "いちおくえん", "ichioku-en"],
      ["3人", "さんにん", "san-nin"],
      ["5000円", "ごせんえん", "gosen-en"],
      ["12歳", "じゅうにさい", "jūni-sai"],
    ] as const) {
      expect(analyse(text).hiragana, text).toBe(kana);
      expect(analyse(text).romaji, text).toBe(romaji);
    }
  });

  it("leaves a bare number as it is", () => {
    expect(analyse("2026").romaji).toBe("2026");
  });
});

describe("on'yomi gemination", () => {
  it("geminates where the rule applies", () => {
    for (const [text, kana] of [
      ["設定", "せってい"],
      ["実行", "じっこう"],
      ["決定", "けってい"],
      ["出発", "しゅっぱつ"],
    ] as const) {
      expect(analyse(text).hiragana, text).toBe(kana);
    }
  });

  it("does not geminate where it does not", () => {
    // く only geminates before the か row, so 学生 stays がくせい, and べ is not
    // a trigger at all, so 特別 stays とくべつ.
    expect(analyse("特別").hiragana).toBe("とくべつ");
    expect(analyse("学生").hiragana).toBe("がくせい");
    expect(analyse("開発").hiragana).toBe("かいはつ");
  });
});
