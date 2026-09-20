import { kanaToHepburn } from "./kana";

/**
 * Japanese numerals and counters.
 *
 * Counters are where Japanese numbers stop being arithmetic. 一人 is ひとり and
 * 二人 is ふたり, neither of which is the number plus the counter; 三日 is みっか;
 * 一分 is いっぷん but 二分 is にふん; 九月 is くがつ while 九日 is ここのか. None of
 * that is derivable, so the irregular forms are tabulated and everything else
 * falls out of a general rule.
 *
 * Both digit and kanji numerals go through here, which is what stopped 3人
 * being read correctly while 三人 was not.
 */

const DIGIT_KANA = ["ゼロ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];

const KANJI_DIGITS: Record<string, number> = {
  〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** Magnitudes, smallest first within a group. */
const KANJI_SMALL: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const KANJI_LARGE: Record<string, number> = { 万: 10000, 億: 100000000, 兆: 1000000000000 };

const MAGNITUDE_KANA: Record<number, string> = {
  10: "じゅう", 100: "ひゃく", 1000: "せん", 10000: "まん",
  100000000: "おく", 1000000000000: "ちょう",
};

/** Sound changes in the hundreds and thousands. */
const HUNDREDS: Record<number, string> = { 3: "さんびゃく", 6: "ろっぴゃく", 8: "はっぴゃく" };
const THOUSANDS: Record<number, string> = { 3: "さんぜん", 8: "はっせん" };

interface CounterSpec {
  /** Reading when the number is regular. */
  base: string;
  /**
   * Whole count-words that do not follow the rule, keyed by value. Entries for
   * 1–10 also drive the tens: 11分 is じゅう + いっぷん.
   */
  irregular?: Record<number, string>;
  meaning: string;
}

const COUNTERS: Record<string, CounterSpec> = {
  人: { base: "にん", irregular: { 1: "ひとり", 2: "ふたり", 4: "よにん" }, meaning: "people" },
  日: {
    base: "にち",
    irregular: {
      1: "ついたち", 2: "ふつか", 3: "みっか", 4: "よっか", 5: "いつか",
      6: "むいか", 7: "なのか", 8: "ようか", 9: "ここのか", 10: "とおか",
      14: "じゅうよっか", 20: "はつか", 24: "にじゅうよっか",
    },
    meaning: "days, day of the month",
  },
  分: {
    base: "ふん",
    irregular: { 1: "いっぷん", 3: "さんぷん", 4: "よんぷん", 6: "ろっぷん", 8: "はっぷん", 10: "じゅっぷん" },
    meaning: "minutes",
  },
  月: {
    base: "がつ",
    irregular: {
      1: "いちがつ", 2: "にがつ", 3: "さんがつ", 4: "しがつ", 5: "ごがつ", 6: "ろくがつ",
      7: "しちがつ", 8: "はちがつ", 9: "くがつ", 10: "じゅうがつ",
      11: "じゅういちがつ", 12: "じゅうにがつ",
    },
    meaning: "month of the year",
  },
  時: { base: "じ", irregular: { 4: "よじ", 7: "しちじ", 9: "くじ" }, meaning: "o'clock" },
  回: { base: "かい", irregular: { 1: "いっかい", 6: "ろっかい", 8: "はっかい", 10: "じゅっかい" }, meaning: "times" },
  本: { base: "ほん", irregular: { 1: "いっぽん", 3: "さんぼん", 6: "ろっぽん", 8: "はっぽん", 10: "じゅっぽん" }, meaning: "long thin objects" },
  杯: { base: "はい", irregular: { 1: "いっぱい", 3: "さんばい", 6: "ろっぱい", 8: "はっぱい", 10: "じゅっぱい" }, meaning: "cupfuls" },
  匹: { base: "ひき", irregular: { 1: "いっぴき", 3: "さんびき", 6: "ろっぴき", 8: "はっぴき", 10: "じゅっぴき" }, meaning: "small animals" },
  階: { base: "かい", irregular: { 1: "いっかい", 3: "さんがい", 6: "ろっかい", 8: "はっかい", 10: "じゅっかい" }, meaning: "floors" },
  個: { base: "こ", irregular: { 1: "いっこ", 6: "ろっこ", 8: "はっこ", 10: "じゅっこ" }, meaning: "items" },
  冊: { base: "さつ", irregular: { 1: "いっさつ", 8: "はっさつ", 10: "じゅっさつ" }, meaning: "books" },
  歳: { base: "さい", irregular: { 1: "いっさい", 8: "はっさい", 10: "じゅっさい", 20: "はたち" }, meaning: "years old" },
  才: { base: "さい", irregular: { 1: "いっさい", 8: "はっさい", 10: "じゅっさい", 20: "はたち" }, meaning: "years old" },
  年: { base: "ねん", irregular: { 4: "よねん", 7: "しちねん", 9: "くねん" }, meaning: "years" },
  円: { base: "えん", meaning: "yen" },
  番: { base: "ばん", meaning: "number in a sequence" },
  枚: { base: "まい", meaning: "flat objects" },
  台: { base: "だい", meaning: "machines and vehicles" },
  名: { base: "めい", meaning: "people (formal)" },
  度: { base: "ど", meaning: "times, degrees" },
  件: { base: "けん", meaning: "matters, cases" },
  軒: { base: "けん", irregular: { 1: "いっけん", 6: "ろっけん", 8: "はっけん", 10: "じゅっけん" }, meaning: "houses" },
  秒: { base: "びょう", meaning: "seconds" },
  週: { base: "しゅう", meaning: "weeks" },
  部: { base: "ぶ", meaning: "copies, sections" },
  割: { base: "わり", meaning: "tenths, percent" },
};

/** Multi-character counters, checked before the single-character table. */
const LONG_COUNTERS: Array<[surface: string, spec: CounterSpec]> = [
  ["ヶ月", { base: "かげつ", irregular: { 1: "いっかげつ", 6: "ろっかげつ", 8: "はっかげつ", 10: "じゅっかげつ" }, meaning: "months (duration)" }],
  ["か月", { base: "かげつ", irregular: { 1: "いっかげつ", 6: "ろっかげつ", 8: "はっかげつ", 10: "じゅっかげつ" }, meaning: "months (duration)" }],
  ["箇月", { base: "かげつ", irregular: { 1: "いっかげつ", 6: "ろっかげつ", 8: "はっかげつ", 10: "じゅっかげつ" }, meaning: "months (duration)" }],
  ["時間", { base: "じかん", irregular: { 4: "よじかん" }, meaning: "hours" }],
  ["週間", { base: "しゅうかん", irregular: { 1: "いっしゅうかん", 8: "はっしゅうかん", 10: "じゅっしゅうかん" }, meaning: "weeks" }],
  ["日間", { base: "にちかん", meaning: "days (duration)" }],
  ["人前", { base: "にんまえ", meaning: "servings" }],
];

/** Reads a number below 10,000. */
function smallNumberKana(value: number): string {
  if (value === 0) return "";
  if (value < 10) return DIGIT_KANA[value];

  let out = "";
  const thousands = Math.floor(value / 1000);
  const hundreds = Math.floor((value % 1000) / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;

  if (thousands) {
    out += THOUSANDS[thousands] ?? (thousands === 1 ? "せん" : `${DIGIT_KANA[thousands]}せん`);
  }
  if (hundreds) {
    out += HUNDREDS[hundreds] ?? (hundreds === 1 ? "ひゃく" : `${DIGIT_KANA[hundreds]}ひゃく`);
  }
  if (tens) out += tens === 1 ? "じゅう" : `${DIGIT_KANA[tens]}じゅう`;
  if (ones) out += DIGIT_KANA[ones];
  return out;
}

/** Reads any number the tool will realistically meet. */
export function numberToKana(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value === 0) return "ゼロ";
  let remaining = value;
  let out = "";
  for (const magnitude of [1000000000000, 100000000, 10000]) {
    const count = Math.floor(remaining / magnitude);
    if (count > 0) {
      out += smallNumberKana(count) + MAGNITUDE_KANA[magnitude];
      remaining -= count * magnitude;
    }
  }
  return out + smallNumberKana(remaining);
}

interface ParsedNumeral {
  value: number;
  length: number;
  /**
   * True when the numeral has to be spelled out even with no counter after it.
   * A bare year — 2024 — is left as digits, but 1億 is part of a word and has
   * to be read いちおく.
   */
  spelled: boolean;
}

/** Reads a numeral written in ASCII or full-width digits. */
function parseDigits(text: string, index: number): ParsedNumeral | null {
  const match = /^[0-9０-９]+/.exec(text.slice(index));
  if (!match) return null;
  const normalised = match[0].replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
  let value = Number(normalised);
  if (!Number.isFinite(value)) return null;
  let length = match[0].length;

  // Digits and magnitude kanji mix freely in ordinary writing: 1億円, 3万人,
  // 5千円. The magnitude has to be taken with the digits rather than left for
  // the character-level rules, which read it as a word of its own — 1億円 came
  // out "1いちおくえん", with the 1 stranded in front of its own reading.
  while (length < text.length - index) {
    const char = text[index + length];
    const magnitude = KANJI_LARGE[char] ?? KANJI_SMALL[char];
    if (magnitude === undefined) break;
    value *= magnitude;
    length += 1;
  }

  return { value, length, spelled: length > match[0].length };
}

/**
 * Reads a numeral written in kanji.
 *
 * Handles the positional system: 二千三百 is 2300, and a bare 十 is 10 rather
 * than a missing digit.
 */
function parseKanjiNumeral(text: string, index: number): ParsedNumeral | null {
  let i = index;
  let total = 0;
  let group = 0;
  let current = 0;
  let seen = false;

  while (i < text.length) {
    const char = text[i];
    if (KANJI_DIGITS[char] !== undefined) {
      current = KANJI_DIGITS[char];
      seen = true;
      i += 1;
      continue;
    }
    if (KANJI_SMALL[char] !== undefined) {
      group += (current || 1) * KANJI_SMALL[char];
      current = 0;
      seen = true;
      i += 1;
      continue;
    }
    if (KANJI_LARGE[char] !== undefined) {
      total += (group + current || 1) * KANJI_LARGE[char];
      group = 0;
      current = 0;
      seen = true;
      i += 1;
      continue;
    }
    break;
  }

  if (!seen) return null;
  return { value: total + group + current, length: i - index, spelled: true };
}

/** The count word for a value and counter, applying the irregular forms. */
export function countWord(value: number, spec: CounterSpec): string {
  const irregular = spec.irregular ?? {};
  if (irregular[value]) return irregular[value];

  const ones = value % 10;
  if (value > 10) {
    // 11分 is じゅう + いっぷん: the irregular form of the last digit carries.
    if (ones !== 0 && irregular[ones]) {
      return numberToKana(value - ones) + irregular[ones];
    }
    // 20分 is に + じゅっぷん, built from the irregular form of ten.
    if (ones === 0 && value < 100 && irregular[10]) {
      return numberToKana(value / 10) + irregular[10];
    }
  }
  return numberToKana(value) + spec.base;
}

export interface NumeralReading {
  surface: string;
  kana: string;
  romaji: string;
  meaning?: string;
}

/**
 * Matches a numeral and any counter attached to it.
 *
 * Returns null when there is no counter and no magnitude, so a bare year like
 * 2026 is left as digits rather than spelled out.
 */
export function matchNumeral(text: string, index: number): NumeralReading | null {
  const digits = parseDigits(text, index);
  const kanji = digits ? null : parseKanjiNumeral(text, index);
  const parsed = digits ?? kanji;
  if (!parsed) return null;

  const after = index + parsed.length;

  for (const [surface, spec] of LONG_COUNTERS) {
    if (!text.startsWith(surface, after)) continue;
    const kana = countWord(parsed.value, spec);
    return {
      surface: text.slice(index, after + surface.length),
      kana,
      romaji: hyphenate(numberToKana(parsed.value), kana),
      meaning: spec.meaning,
    };
  }

  const counterChar = after < text.length ? text[after] : "";
  const spec = COUNTERS[counterChar];
  if (spec) {
    const kana = countWord(parsed.value, spec);
    return {
      surface: text.slice(index, after + 1),
      kana,
      romaji: hyphenate(numberToKana(parsed.value), kana),
      meaning: spec.meaning,
    };
  }

  // No counter. Kanji numerals already read correctly on their own; digits are
  // only spelled out when a magnitude kanji makes them part of a word.
  if (parsed.spelled) {
    return {
      surface: text.slice(index, after),
      kana: numberToKana(parsed.value),
      romaji: kanaToHepburn(numberToKana(parsed.value)),
    };
  }
  return null;
}

/**
 * Hepburn hyphenates a counter off the number it follows: ichioku-en.
 *
 * The split is found by taking the number's own reading off the front of the
 * count word, which keeps irregular forms whole — ひとり is one unit, not
 * ひと plus り.
 */
function hyphenate(numberKana: string, countKana: string): string {
  if (countKana.startsWith(numberKana) && countKana.length > numberKana.length) {
    const suffix = countKana.slice(numberKana.length);
    return `${kanaToHepburn(numberKana)}-${kanaToHepburn(suffix)}`;
  }
  return kanaToHepburn(countKana);
}
