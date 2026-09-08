/**
 * Kana, romaji and keyboard input.
 *
 * All of this is exact. Japanese kana map to sounds one-to-one, so conversion
 * between hiragana, katakana and romaji is a lookup rather than a guess — which
 * is why this part of the tool carries no caveats, unlike the translation.
 *
 * Romanisation follows modified Hepburn, the system used on Japanese road signs
 * and passports and taught in most courses.
 */

/** Base syllables, longest keys first at match time. */
const BASE: Array<[hiragana: string, katakana: string, romaji: string]> = [
  // Youon (contracted sounds) must be matched before their base kana.
  ["きゃ", "キャ", "kya"], ["きゅ", "キュ", "kyu"], ["きょ", "キョ", "kyo"],
  ["しゃ", "シャ", "sha"], ["しゅ", "シュ", "shu"], ["しょ", "ショ", "sho"],
  ["ちゃ", "チャ", "cha"], ["ちゅ", "チュ", "chu"], ["ちょ", "チョ", "cho"],
  ["にゃ", "ニャ", "nya"], ["にゅ", "ニュ", "nyu"], ["にょ", "ニョ", "nyo"],
  ["ひゃ", "ヒャ", "hya"], ["ひゅ", "ヒュ", "hyu"], ["ひょ", "ヒョ", "hyo"],
  ["みゃ", "ミャ", "mya"], ["みゅ", "ミュ", "myu"], ["みょ", "ミョ", "myo"],
  ["りゃ", "リャ", "rya"], ["りゅ", "リュ", "ryu"], ["りょ", "リョ", "ryo"],
  ["ぎゃ", "ギャ", "gya"], ["ぎゅ", "ギュ", "gyu"], ["ぎょ", "ギョ", "gyo"],
  ["じゃ", "ジャ", "ja"],  ["じゅ", "ジュ", "ju"],  ["じょ", "ジョ", "jo"],
  ["ぢゃ", "ヂャ", "ja"],  ["ぢゅ", "ヂュ", "ju"],  ["ぢょ", "ヂョ", "jo"],
  ["びゃ", "ビャ", "bya"], ["びゅ", "ビュ", "byu"], ["びょ", "ビョ", "byo"],
  ["ぴゃ", "ピャ", "pya"], ["ぴゅ", "ピュ", "pyu"], ["ぴょ", "ピョ", "pyo"],

  // Katakana-only combinations used for loanwords.
  ["", "ヴァ", "va"], ["", "ヴィ", "vi"], ["", "ヴェ", "ve"], ["", "ヴォ", "vo"],
  ["", "ファ", "fa"], ["", "フィ", "fi"], ["", "フェ", "fe"], ["", "フォ", "fo"],
  ["", "ウィ", "wi"], ["", "ウェ", "we"], ["", "ウォ", "wo"],
  ["", "ティ", "ti"], ["", "ディ", "di"], ["", "トゥ", "tu"], ["", "ドゥ", "du"],
  ["", "チェ", "che"], ["", "シェ", "she"], ["", "ジェ", "je"],
  ["", "ヴ", "vu"],

  // Basic syllabary.
  ["あ", "ア", "a"], ["い", "イ", "i"], ["う", "ウ", "u"], ["え", "エ", "e"], ["お", "オ", "o"],
  ["か", "カ", "ka"], ["き", "キ", "ki"], ["く", "ク", "ku"], ["け", "ケ", "ke"], ["こ", "コ", "ko"],
  ["さ", "サ", "sa"], ["し", "シ", "shi"], ["す", "ス", "su"], ["せ", "セ", "se"], ["そ", "ソ", "so"],
  ["た", "タ", "ta"], ["ち", "チ", "chi"], ["つ", "ツ", "tsu"], ["て", "テ", "te"], ["と", "ト", "to"],
  ["な", "ナ", "na"], ["に", "ニ", "ni"], ["ぬ", "ヌ", "nu"], ["ね", "ネ", "ne"], ["の", "ノ", "no"],
  ["は", "ハ", "ha"], ["ひ", "ヒ", "hi"], ["ふ", "フ", "fu"], ["へ", "ヘ", "he"], ["ほ", "ホ", "ho"],
  ["ま", "マ", "ma"], ["み", "ミ", "mi"], ["む", "ム", "mu"], ["め", "メ", "me"], ["も", "モ", "mo"],
  ["や", "ヤ", "ya"], ["ゆ", "ユ", "yu"], ["よ", "ヨ", "yo"],
  ["ら", "ラ", "ra"], ["り", "リ", "ri"], ["る", "ル", "ru"], ["れ", "レ", "re"], ["ろ", "ロ", "ro"],
  ["わ", "ワ", "wa"], ["ゐ", "ヰ", "i"], ["ゑ", "ヱ", "e"], ["を", "ヲ", "wo"],
  ["ん", "ン", "n"],
  ["が", "ガ", "ga"], ["ぎ", "ギ", "gi"], ["ぐ", "グ", "gu"], ["げ", "ゲ", "ge"], ["ご", "ゴ", "go"],
  ["ざ", "ザ", "za"], ["じ", "ジ", "ji"], ["ず", "ズ", "zu"], ["ぜ", "ゼ", "ze"], ["ぞ", "ゾ", "zo"],
  ["だ", "ダ", "da"], ["ぢ", "ヂ", "ji"], ["づ", "ヅ", "zu"], ["で", "デ", "de"], ["ど", "ド", "do"],
  ["ば", "バ", "ba"], ["び", "ビ", "bi"], ["ぶ", "ブ", "bu"], ["べ", "ベ", "be"], ["ぼ", "ボ", "bo"],
  ["ぱ", "パ", "pa"], ["ぴ", "ピ", "pi"], ["ぷ", "プ", "pu"], ["ぺ", "ペ", "pe"], ["ぽ", "ポ", "po"],

  // Small kana, which appear alone only in stylised writing.
  ["ぁ", "ァ", "a"], ["ぃ", "ィ", "i"], ["ぅ", "ゥ", "u"], ["ぇ", "ェ", "e"], ["ぉ", "ォ", "o"],
  ["ゃ", "ャ", "ya"], ["ゅ", "ュ", "yu"], ["ょ", "ョ", "yo"], ["ゎ", "ヮ", "wa"],
];

const SOKUON_HIRAGANA = "っ";
const SOKUON_KATAKANA = "ッ";
const LONG_MARK = "ー";

/** Kana to romaji, longest first so youon win over their base kana. */
const KANA_TO_ROMAJI = new Map<string, string>();
for (const [hiragana, katakana, romaji] of BASE) {
  if (hiragana) KANA_TO_ROMAJI.set(hiragana, romaji);
  if (katakana) KANA_TO_ROMAJI.set(katakana, romaji);
}
const KANA_KEYS = [...KANA_TO_ROMAJI.keys()].sort((a, b) => b.length - a.length);

const HIRAGANA_TO_KATAKANA = new Map<string, string>();
const KATAKANA_TO_HIRAGANA = new Map<string, string>();
for (const [hiragana, katakana] of BASE) {
  if (!hiragana || !katakana) continue;
  HIRAGANA_TO_KATAKANA.set(hiragana, katakana);
  KATAKANA_TO_HIRAGANA.set(katakana, hiragana);
}
HIRAGANA_TO_KATAKANA.set(SOKUON_HIRAGANA, SOKUON_KATAKANA);
KATAKANA_TO_HIRAGANA.set(SOKUON_KATAKANA, SOKUON_HIRAGANA);

export function isHiragana(char: string): boolean {
  return /[ぁ-ゖゝ-ゟ]/.test(char);
}
export function isKatakana(char: string): boolean {
  return /[ァ-ヺー-ヿ]/.test(char);
}
export function isKana(char: string): boolean {
  return isHiragana(char) || isKatakana(char);
}
export function isKanji(char: string): boolean {
  return /[一-鿿㐀-䶿]/.test(char);
}
export function hasJapanese(text: string): boolean {
  return [...text].some((char) => isKana(char) || isKanji(char));
}

/** Consonant a small tsu doubles, taken from the syllable that follows it. */
function doubledConsonant(romaji: string): string {
  if (romaji.startsWith("ch")) return "t"; // Hepburn writes っち as "tchi".
  const first = romaji[0];
  return /[a-z]/.test(first) && !"aiueo".includes(first) ? first : "";
}

/**
 * Kana to Hepburn romaji.
 *
 * Anything that is not kana — kanji, Latin letters, punctuation — passes
 * through unchanged, so the caller can see exactly what could not be read.
 */
export function kanaToRomaji(text: string): string {
  let output = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === SOKUON_HIRAGANA || char === SOKUON_KATAKANA) {
      // Look ahead for the syllable being doubled.
      let next = "";
      for (const key of KANA_KEYS) {
        if (text.startsWith(key, index + 1)) { next = KANA_TO_ROMAJI.get(key)!; break; }
      }
      output += doubledConsonant(next);
      index += 1;
      continue;
    }

    if (char === LONG_MARK) {
      // Repeat the previous vowel, which is how the sound is actually held.
      const previous = output[output.length - 1];
      if (previous && "aiueo".includes(previous)) output += previous;
      index += 1;
      continue;
    }

    let matched = false;
    for (const key of KANA_KEYS) {
      if (!text.startsWith(key, index)) continue;
      let romaji = KANA_TO_ROMAJI.get(key)!;

      // Syllabic ん takes an apostrophe before a vowel or y, so "kin'en" is not
      // read as "ki-ne-n".
      if (romaji === "n" && (key === "ん" || key === "ン")) {
        const after = text.slice(index + key.length);
        for (const nextKey of KANA_KEYS) {
          if (!after.startsWith(nextKey)) continue;
          const nextRomaji = KANA_TO_ROMAJI.get(nextKey)!;
          if (/^[aiueoy]/.test(nextRomaji)) romaji = "n'";
          break;
        }
      }

      output += romaji;
      index += key.length;
      matched = true;
      break;
    }

    if (!matched) {
      output += char;
      index += 1;
    }
  }

  return output;
}

/** Converts between the two syllabaries, leaving everything else alone. */
export function toKatakana(text: string): string {
  return [...text].map((char) => HIRAGANA_TO_KATAKANA.get(char) ?? char).join("");
}
export function toHiragana(text: string): string {
  return [...text].map((char) => KATAKANA_TO_HIRAGANA.get(char) ?? char).join("");
}

/** Romaji spellings an IME accepts, mapped to the kana they produce. */
const ROMAJI_TO_KANA = new Map<string, string>();
for (const [hiragana, , romaji] of BASE) {
  if (!hiragana || ROMAJI_TO_KANA.has(romaji)) continue;
  ROMAJI_TO_KANA.set(romaji, hiragana);
}
/** Alternative spellings every Japanese IME also accepts. */
const ALTERNATIVES: Record<string, string> = {
  si: "し", ti: "ち", tu: "つ", hu: "ふ", zi: "じ", di: "ぢ", du: "づ",
  sya: "しゃ", syu: "しゅ", syo: "しょ", tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ",
  jya: "じゃ", jyu: "じゅ", jyo: "じょ", zya: "じゃ", zyu: "じゅ", zyo: "じょ",
  cya: "ちゃ", cyu: "ちゅ", cyo: "ちょ", nn: "ん", xn: "ん",
  la: "ぁ", li: "ぃ", lu: "ぅ", le: "ぇ", lo: "ぉ",
  xa: "ぁ", xi: "ぃ", xu: "ぅ", xe: "ぇ", xo: "ぉ",
  xya: "ゃ", xyu: "ゅ", xyo: "ょ", xtu: "っ", ltu: "っ",
  wo: "を", fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
};
for (const [romaji, kana] of Object.entries(ALTERNATIVES)) ROMAJI_TO_KANA.set(romaji, kana);

const ROMAJI_KEYS = [...ROMAJI_TO_KANA.keys()].sort((a, b) => b.length - a.length);

/**
 * Romaji to hiragana, following the rules a Japanese IME uses: a doubled
 * consonant becomes a small tsu, "n" before a consonant becomes ん, and a
 * hyphen becomes the long-vowel mark.
 */
export function romajiToKana(text: string, katakana = false): string {
  const lower = text.toLowerCase();
  let output = "";
  let index = 0;

  while (index < lower.length) {
    const char = lower[index];

    // A doubled consonant (other than "nn") is a small tsu, and so is the "t"
    // in "tch" — "matcha" has to come out as まっちゃ.
    if (
      /[a-z]/.test(char) && !"aiueon".includes(char) &&
      (lower[index + 1] === char || (char === "t" && lower.startsWith("tch", index)))
    ) {
      output += "っ";
      index += 1;
      continue;
    }

    if (char === "n") {
      const next = lower[index + 1];
      if (next === "n") {
        // "nn" is ん, but in "nni" the second n starts the next syllable, which
        // is why typing "konnichiwa" produces こんにちは rather than こんいちは.
        const after = lower[index + 2];
        output += "ん";
        index += after && "aiueoy".includes(after) ? 1 : 2;
        continue;
      }
      if (!next || (/[a-z]/.test(next) && !"aiueoy".includes(next)) || next === "'") {
        output += "ん";
        index += next === "'" ? 2 : 1;
        continue;
      }
    }

    if (char === "-") {
      output += LONG_MARK;
      index += 1;
      continue;
    }

    let matched = false;
    for (const key of ROMAJI_KEYS) {
      if (!lower.startsWith(key, index)) continue;
      output += ROMAJI_TO_KANA.get(key)!;
      index += key.length;
      matched = true;
      break;
    }

    if (!matched) {
      output += text[index];
      index += 1;
    }
  }

  return katakana ? toKatakana(output) : output;
}

export interface TypingStep {
  /** The kana this keystroke group produces. */
  kana: string;
  /** What to type on a Japanese IME. */
  keys: string;
  /** Other spellings the IME also accepts. */
  alternatives: string[];
  note?: string;
}

/** Preferred keystrokes for each kana, where they differ from Hepburn. */
const TYPING_OVERRIDES: Record<string, string> = {
  し: "shi", ち: "chi", つ: "tsu", ふ: "fu", じ: "ji", ぢ: "di", づ: "du",
  を: "wo", ん: "nn", ぢゃ: "dya", ぢゅ: "dyu", ぢょ: "dyo",
};

const TYPING_ALTERNATIVES: Record<string, string[]> = {
  し: ["si", "ci"], ち: ["ti"], つ: ["tu"], ふ: ["hu"], じ: ["zi"],
  ん: ["n", "xn"], しゃ: ["sya"], しゅ: ["syu"], しょ: ["syo"],
  ちゃ: ["tya", "cya"], ちゅ: ["tyu"], ちょ: ["tyo"],
  じゃ: ["zya", "jya"], じゅ: ["zyu"], じょ: ["zyo"],
};

/**
 * How to type a piece of Japanese on a keyboard with a Japanese IME.
 *
 * Kanji cannot be typed directly — you type the reading and convert with the
 * space bar — so kanji are reported as needing conversion rather than given
 * keystrokes that would not work.
 */
export function typingSteps(text: string): TypingStep[] {
  const steps: TypingStep[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === SOKUON_HIRAGANA || char === SOKUON_KATAKANA) {
      let next = "";
      for (const key of KANA_KEYS) {
        if (text.startsWith(key, index + 1)) { next = KANA_TO_ROMAJI.get(key)!; break; }
      }
      const consonant = doubledConsonant(next) || "t";
      steps.push({
        kana: char,
        keys: consonant,
        alternatives: ["xtu", "ltu"],
        note: "Type the next consonant twice — the first press makes the small tsu.",
      });
      index += 1;
      continue;
    }

    if (char === LONG_MARK) {
      steps.push({ kana: char, keys: "-", alternatives: [], note: "The hyphen key." });
      index += 1;
      continue;
    }

    if (isKanji(char)) {
      // Group a run of kanji, since they are converted together.
      let run = char;
      while (index + run.length < text.length && isKanji(text[index + run.length])) {
        run += text[index + run.length];
      }
      steps.push({
        kana: run,
        keys: "",
        alternatives: [],
        note: "Type this word's reading in kana, then press space to convert it.",
      });
      index += run.length;
      continue;
    }

    let matched = false;
    for (const key of KANA_KEYS) {
      if (!text.startsWith(key, index)) continue;
      const hiragana = KATAKANA_TO_HIRAGANA.get(key) ?? key;
      const keys = TYPING_OVERRIDES[hiragana] ?? KANA_TO_ROMAJI.get(key)!;
      steps.push({
        kana: key,
        keys,
        alternatives: TYPING_ALTERNATIVES[hiragana] ?? [],
        note: isKatakana(key) ? "Katakana: type it, then press F7 to convert." : undefined,
      });
      index += key.length;
      matched = true;
      break;
    }

    if (!matched) {
      if (char.trim()) {
        steps.push({ kana: char, keys: char, alternatives: [], note: undefined });
      }
      index += 1;
    }
  }

  return steps;
}

/** The full keystroke string for a phrase, for copying. */
export function typingString(text: string): string {
  return typingSteps(text)
    .map((step) => step.keys || `[${step.kana}]`)
    .join("");
}
