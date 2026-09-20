import { beforeAll, describe, expect, it } from "vitest";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "@sglkc/kuromoji";
import { analyse } from "../src/lib/japanese/annotate";
import { hasJapanese } from "../src/lib/japanese/kana";
import { sanitize } from "../src/lib/japanese/sanitize";

/**
 * Input normalization: the one-way gate in front of the analyser.
 *
 * Text reaching these tools has usually been through something else first, and
 * carries the marks of it — a reading in brackets after the word, a footnote
 * number, markdown emphasis. Analysing those artifacts is what produced
 * "zaitaku kinmu（zaitakukinmu）" and "ma（fu）eteiru": the word read properly,
 * then its own annotation read a second time beside it.
 *
 * Every case below is a reported one.
 */

/** The paragraph as reported, with a reading marked on every hard word. */
const FURIGANA = "最近、在宅勤務（ざいたくきんむ）を導入（どうにゅう）する企業（きぎょう）が増（ふ）えているが、それに伴（ともな）って社員（しゃいん）の働き方に対する意識（いしき）も変わりつつある。かつてはオフィスに出社（しゅっしゃ）して働くことが絶対（ぜったい）であると考えられていたが、現在では成果（せいか）さえ出せば場所は問わないという考え方が広がっている。しかし、コミュニケーションの減少（げんしょう）や自己管理（じこかんり）の難（むずか）しさといった新たな課題（かだい）が生じているのも事実（じじつ）である。";

/** The same paragraph with no annotations at all. */
const PLAIN = "最近、在宅勤務を導入する企業が増えているが、それに伴って社員の働き方に対する意識も変わりつつある。かつてはオフィスに出社して働くことが絶対であると考えられていたが、現在では成果さえ出せば場所は問わないという考え方が広がっている。しかし、コミュニケーションの減少や自己管理の難しさといった新たな課題が生じているのも事実である。";

const MARKDOWN = "**在宅勤務**［１］を導入［２］する企業が*増*えている";

describe("input normalization", () => {
  let tokenizer: Tokenizer<IpadicFeatures>;

  beforeAll(async () => {
    tokenizer = await new Promise((resolve, reject) => {
      kuromoji
        .builder({ dicPath: "./node_modules/@sglkc/kuromoji/dict" })
        .build((error, built) => (error ? reject(error) : resolve(built)));
    });
  }, 60_000);

  const read = (text: string) => analyse(text, { tokenizer });

  describe("the reported paragraph, annotated on every hard word", () => {
    it("reads exactly as the same paragraph with no annotations", () => {
      // The annotation carries no information the analyser lacks, so removing
      // it must change nothing. This is the whole invariant in one line.
      expect(read(FURIGANA).romaji).toBe(read(PLAIN).romaji);
    });

    it("produces the expected romaji", () => {
      expect(read(FURIGANA).romaji).toBe(
        "saikin、zaitaku kinmu o dōnyū suru kigyō ga fueteiru ga、" +
          "sore ni tomonatte shain no hatarakikata ni taisuru ishiki mo kawaritsutsu aru。" +
          "katsute wa ofisu ni shussha shite hataraku koto ga zettai de aru to kangaerareteita ga、" +
          "genzai de wa seika sae daseba basho wa towanai to iu kangaekata ga hirogatteiru。" +
          "shikashi、komyunikeeshon no genshō ya jiko kanri no muzukashisa to itta aratana kadai ga " +
          "shōjiteiru no mo jijitsu de aru。",
      );
    });

    it("leaves no artifact of any kind in the romaji", () => {
      const romaji = read(FURIGANA).romaji;
      expect(hasJapanese(romaji), "kanji or kana in romaji").toBe(false);
      expect(romaji, "unresolved marker").not.toContain("?");
      expect(romaji, "brackets").not.toMatch(/[（）()［］[\]]/);
      expect(romaji, "markdown").not.toMatch(/[*_]/);
    });

    it("never reads a word and its own annotation twice", () => {
      const romaji = read(FURIGANA).romaji;
      for (const doubled of [
        "zaitakukinmu", "dounyuu", "kigyou", "mafu", "zōfu",
        "tomonatomona", "muzukamuzuka", "jikokanri jiko",
        "shain shain", "ishiki ishiki",
      ]) {
        expect(romaji, doubled).not.toContain(doubled);
      }
    });

    it("keeps the raw input and the analysed string separate", () => {
      const analysis = read(FURIGANA);
      // The caller still has the untouched input; the analysis records what it
      // actually worked on, so a rendered annotation can never be fed back in.
      expect(analysis.normalized).toBe(PLAIN);
      expect(analysis.normalized).not.toContain("（");
    });
  });

  describe("annotated words in isolation", () => {
    it("reads each one as its source token", () => {
      for (const [annotated, romaji] of [
        ["在宅勤務（ざいたくきんむ）", "zaitaku kinmu"],
        ["導入（どうにゅう）", "dōnyū"],
        ["企業（きぎょう）", "kigyō"],
        ["増（ふ）えている", "fueteiru"],
        ["伴（ともな）って", "tomonatte"],
        ["社員（しゃいん）", "shain"],
        ["意識（いしき）", "ishiki"],
        ["出社（しゅっしゃ）", "shussha"],
        ["絶対（ぜったい）", "zettai"],
        ["成果（せいか）", "seika"],
        ["減少（げんしょう）", "genshō"],
        ["自己管理（じこかんり）", "jiko kanri"],
        ["難（むずか）しさ", "muzukashisa"],
        ["課題（かだい）", "kadai"],
        ["事実（じじつ）", "jijitsu"],
      ] as const) {
        expect(read(annotated).romaji, annotated).toBe(romaji);
      }
    });
  });

  describe("romaji annotations, which are this tool's own output", () => {
    it("strips a bracketed romaji gloss rather than reading it again", () => {
      const romaji = read("在宅勤務（zaitakukinmu）を導入（dounyuu）する").romaji;
      expect(romaji).toBe("zaitaku kinmu o dōnyū suru");
      expect(romaji).not.toContain("zaitakukinmu");
      expect(romaji).not.toContain("dounyuu");
    });
  });

  describe("markdown and footnote artifacts", () => {
    it("removes them without touching the Japanese", () => {
      expect(read(MARKDOWN).romaji).toBe("zaitaku kinmu o dōnyū suru kigyō ga fueteiru");
    });

    it("leaves legitimate brackets and punctuation alone", () => {
      for (const text of ["会議（10時）", "（笑）", "AI（人工知能）"]) {
        expect(sanitize(text).text, text).toBe(text);
      }
      // Not Japanese-adjacent, so not markdown: arithmetic and identifiers.
      expect(sanitize("5 * 3").text).toBe("5 * 3");
      expect(sanitize("snake_case_name").text).toBe("snake_case_name");
    });

    it("reports what it removed rather than hiding it", () => {
      const { removed } = sanitize("在宅勤務（zaitakukinmu）［１］");
      expect(removed).toContain("（zaitakukinmu）");
      expect(removed).toContain("［１］");
    });
  });

  it("holds even with no analyser loaded", () => {
    // The fallback is worse at reading, but must be no worse at normalising.
    const romaji = analyse(FURIGANA).romaji;
    expect(romaji).not.toMatch(/[（）]/);
    expect(romaji).not.toContain("?");
    expect(hasJapanese(romaji)).toBe(false);
  });

  it("reads the short sentence exactly as specified", () => {
    expect(read("私はこの会社の新入社員です").romaji).toBe(
      "watashi wa kono kaisha no shinnyū shain desu",
    );
  });
});
