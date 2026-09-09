import { KANJI_MAP, WORDS, WORD_MAP, type KanjiEntry, type WordEntry } from "./dictionary";
import { hasJapanese, isKana, isKanji, kanaToRomaji, toHiragana, typingString } from "./kana";

/**
 * Japanese lexical analysis.
 *
 * One pass produces everything the tool shows — furigana, the hiragana and
 * katakana lines, romaji, the typing guide and the kanji cards — so those can
 * never disagree with each other.
 *
 * The order of resolution is the whole design, and getting it wrong is what
 * produced readings like 新入社員 → "atara hai yashiro 員":
 *
 *   1. Multi-character vocabulary, longest match first.
 *   2. Inflected verbs and adjectives, via stems derived from the dictionary.
 *   3. Compound segmentation across a run of kanji, choosing the split that
 *      uses the fewest dictionary words.
 *   4. Only then, per-character readings — and even then using on'yomi inside a
 *      compound, because a run of two or more kanji is read that way. 新入社員
 *      is シン・ニュウ・シャ・イン, not the kun readings あたら・はい・やしろ.
 *
 * Anything that still cannot be resolved is reported as unresolved rather than
 * passed through as raw kanji, so the romaji line never contains characters the
 * reader came here unable to read.
 */

export type TokenSource =
  | "word"
  | "inflected"
  | "compound"
  | "kanji"
  | "kana"
  | "particle"
  | "unresolved"
  | "other";

export type Confidence = "exact" | "reliable" | "approximate" | "unresolved";

export interface Token {
  surface: string;
  /** Reading in hiragana. Empty only when unresolved. */
  reading: string;
  /** Never contains kanji. */
  romaji: string;
  meaning?: string;
  source: TokenSource;
  confidence: Confidence;
  kanji: KanjiEntry[];
  /** Keystrokes on a Japanese IME. */
  typing: string;
  /** True when the reading must be typed and converted rather than typed directly. */
  needsConversion: boolean;
}

export interface Analysis {
  tokens: Token[];
  hiragana: string;
  katakana: string;
  romaji: string;
  typing: string;
  /** Kanji met in the text, in order, deduplicated. */
  kanji: KanjiEntry[];
  /** Characters no reading could be found for. */
  unresolved: string[];
  /** True when every token has a reading and none of them was guessed. */
  complete: boolean;
}

/** Shown in place of a character with no known reading. */
const UNRESOLVED_ROMAJI = "?";
const UNRESOLVED_KANA = "？";

const CONFIDENCE_BY_SOURCE: Record<TokenSource, Confidence> = {
  word: "reliable",
  inflected: "reliable",
  compound: "approximate",
  kanji: "approximate",
  kana: "exact",
  particle: "exact",
  unresolved: "unresolved",
  other: "exact",
};

export const SOURCE_NOTES: Record<TokenSource, string> = {
  word: "A word from the bundled vocabulary — this reading is reliable.",
  inflected: "An inflected form of a word in the vocabulary. The stem reading is reliable.",
  compound: "A compound that is not in the vocabulary, read with the on'yomi of each kanji. Usually right, but compounds sometimes shift sound.",
  kanji: "A single kanji read on its own. Inside a compound word it is often read differently.",
  kana: "Kana reads exactly as written.",
  particle: "A grammatical particle.",
  unresolved: "No reading found for this character, so none is shown rather than a guess.",
  other: "",
};

/* ------------------------------------------------------------------ */
/* Dictionary indexes, built once at module load                       */
/* ------------------------------------------------------------------ */

/** Words written entirely in kanji, usable when segmenting a kanji run. */
const KANJI_WORDS = new Map<string, WordEntry>();
/** Every word, longest first, for the general longest-match pass. */
const ALL_WORD_KEYS: string[] = [];

let longestKanjiWord = 1;

for (const entry of WORDS) {
  if (!ALL_WORD_KEYS.includes(entry.word)) ALL_WORD_KEYS.push(entry.word);
  if ([...entry.word].every(isKanji)) {
    if (!KANJI_WORDS.has(entry.word)) KANJI_WORDS.set(entry.word, entry);
    longestKanjiWord = Math.max(longestKanjiWord, entry.word.length);
  }
}
ALL_WORD_KEYS.sort((a, b) => b.length - a.length);

/**
 * Verb and adjective stems.
 *
 * Japanese inflects by changing the kana after the kanji: 行く becomes 行きます,
 * 行きました, 行かない. Listing every form is hopeless, but the kanji and its
 * reading stay put, so an entry written as "kanji + kana" yields a stem — 行
 * reads い — and whatever kana follows is the ending.
 */
const STEMS = new Map<string, string>();
for (const entry of WORDS) {
  const match = /^([一-鿿]+)([ぁ-ゖ]+)$/.exec(entry.word);
  if (!match) continue;
  const [, kanji, tail] = match;
  if (!entry.reading.endsWith(tail)) continue;
  const stemReading = entry.reading.slice(0, entry.reading.length - tail.length);
  if (!stemReading) continue;
  // The shortest stem wins, which is the plain form rather than a polite one.
  const existing = STEMS.get(kanji);
  if (!existing || stemReading.length < existing.length) STEMS.set(kanji, stemReading);
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

/** The three particles that are not pronounced the way they are written. */
const IRREGULAR_PARTICLES: Record<string, string> = { は: "wa", へ: "e", を: "o" };

/** Particles worth breaking a kana run at, so the romaji stays readable. */
const SPLIT_PARTICLES = new Set(["は", "が", "を", "に", "へ", "と", "で", "も", "の", "や", "か"]);

const PARTICLE_NOTES: Record<string, string> = {
  は: "topic particle — written は, pronounced \"wa\"",
  へ: "direction particle — written へ, pronounced \"e\"",
  を: "object particle — written を, pronounced \"o\"",
  が: "subject particle",
  に: "to, at, in",
  と: "and, with",
  で: "at, by means of",
  も: "also, too",
  の: "possessive / linking particle",
  や: "and (non-exhaustive)",
  か: "question particle",
};

/**
 * Sequences that begin with a particle character but are not particles.
 *
 * です is the copula, not the particle で followed by す, so the particle split
 * has to look ahead before breaking a kana run at で.
 */
const NOT_A_PARTICLE = ["です", "でし", "でしょ", "でござ", "ではあり", "でき"];

/** Kana that end an inflection because they are particles, not okurigana. */
const OKURIGANA_STOP = new Set(["は", "が", "を", "に", "へ", "と", "で", "も", "の", "や"]);

/** Punctuation and spacing, which need no reading. */
const PASSTHROUGH = /[\s、。「」『』・！？…ー〜（）()［］\[\],.!?:;'"“”‘’\-—–/]/;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeToken(partial: Omit<Token, "confidence" | "typing" | "needsConversion" | "kanji"> & {
  kanji?: KanjiEntry[];
}): Token {
  const kanjiChars = [...partial.surface].filter(isKanji);
  const needsConversion = kanjiChars.length > 0;
  return {
    ...partial,
    kanji:
      partial.kanji ??
      kanjiChars.map((c) => KANJI_MAP.get(c)).filter((k): k is KanjiEntry => Boolean(k)),
    confidence: CONFIDENCE_BY_SOURCE[partial.source],
    typing: partial.reading ? typingString(partial.reading) : "",
    needsConversion,
  };
}

/** The reading a kanji takes on its own, preferring kun'yomi. */
function standaloneReading(entry: KanjiEntry): string {
  const kun = entry.kun[0]?.replace(/[.\-–].*$/, "");
  if (kun) return kun;
  const on = entry.on[0];
  return on ? toHiragana(on) : "";
}

/** The reading a kanji takes inside a compound, preferring on'yomi. */
function compoundReading(entry: KanjiEntry): string {
  const on = entry.on[0];
  if (on) return toHiragana(on);
  return entry.kun[0]?.replace(/[.\-–].*$/, "") ?? "";
}

/**
 * Whether the character at this position is really a particle.
 *
 * で is the particle "at, by", but でした and です are the copula — so 飲みません
 * でした is one word, not 飲みません followed by a particle. Both the okurigana
 * scan and the particle split have to agree on this, or the same text would be
 * segmented two different ways.
 */
function isParticleAt(text: string, index: number): boolean {
  const char = text[index];
  if (!SPLIT_PARTICLES.has(char)) return false;
  if (NOT_A_PARTICLE.some((prefix) => text.startsWith(prefix, index))) return false;
  // The て-form of a godan verb voices to で after ん, い or っ — 読んで, 泳いで,
  // 呼んで — so that で belongs to the verb rather than starting a new phrase.
  if (char === "で" && index > 0 && "んいっ".includes(text[index - 1])) return false;
  return true;
}

/** How much of the kana after a stem belongs to the word. */
function okurigana(text: string, from: number): string {
  let taken = "";
  while (from + taken.length < text.length) {
    const at = from + taken.length;
    const char = text[at];
    if (!isKana(char)) break;
    if (OKURIGANA_STOP.has(char) && isParticleAt(text, at)) break;
    taken += char;
  }
  return taken;
}

/* ------------------------------------------------------------------ */
/* Compound segmentation                                               */
/* ------------------------------------------------------------------ */

interface Segment {
  surface: string;
  entry?: WordEntry;
}

/**
 * Splits a run of kanji into the fewest dictionary words possible.
 *
 * Solved as a shortest-path over the run rather than greedily, because greedy
 * left-to-right matching gets 新入社員 wrong whenever a shorter word happens to
 * match first. A dictionary word costs 1 and an unmatched character costs 4, so
 * any segmentation into real words beats falling back character by character.
 */
function segmentKanjiRun(run: string): Segment[] {
  const n = run.length;
  const cost = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const take = new Array<number>(n + 1).fill(1);
  const used = new Array<WordEntry | undefined>(n + 1).fill(undefined);
  cost[n] = 0;

  for (let i = n - 1; i >= 0; i -= 1) {
    // Longest first, so an equal-cost tie resolves to the longer word.
    for (let length = Math.min(longestKanjiWord, n - i); length >= 1; length -= 1) {
      const candidate = run.slice(i, i + length);
      const entry = KANJI_WORDS.get(candidate);
      if (!entry) continue;
      const total = 1 + cost[i + length];
      if (total < cost[i]) {
        cost[i] = total;
        take[i] = length;
        used[i] = entry;
      }
    }
    const fallback = 4 + cost[i + 1];
    if (fallback < cost[i]) {
      cost[i] = fallback;
      take[i] = 1;
      used[i] = undefined;
    }
  }

  const segments: Segment[] = [];
  for (let i = 0; i < n; i += take[i]) {
    segments.push({ surface: run.slice(i, i + take[i]), entry: used[i] });
  }
  return segments;
}

/** Turns a segmented kanji run into tokens. */
function tokensForRun(run: string): Token[] {
  const segments = segmentKanjiRun(run);
  const insideCompound = run.length > 1;

  return segments.map((segment) => {
    if (segment.entry) {
      return makeToken({
        surface: segment.surface,
        reading: segment.entry.reading,
        romaji: kanaToRomaji(segment.entry.reading),
        meaning: segment.entry.meaning,
        source: "word",
      });
    }

    const entry = KANJI_MAP.get(segment.surface);
    const reading = entry
      ? insideCompound
        ? compoundReading(entry)
        : standaloneReading(entry)
      : "";

    if (!reading) {
      return makeToken({
        surface: segment.surface,
        reading: "",
        romaji: UNRESOLVED_ROMAJI,
        meaning: entry?.meaning,
        source: "unresolved",
      });
    }

    return makeToken({
      surface: segment.surface,
      reading,
      romaji: kanaToRomaji(reading),
      meaning: entry?.meaning,
      source: insideCompound ? "compound" : "kanji",
    });
  });
}

/* ------------------------------------------------------------------ */
/* Main pass                                                           */
/* ------------------------------------------------------------------ */

export function analyse(text: string): Analysis {
  const tokens: Token[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (PASSTHROUGH.test(char)) {
      tokens.push(
        makeToken({ surface: char, reading: char, romaji: char, source: "other", kanji: [] }),
      );
      index += 1;
      continue;
    }

    // A particle immediately after a word is split off so it reads correctly:
    // 駅はどこ is "eki wa doko", not "eki hadoko".
    const previous = tokens[tokens.length - 1];
    if (
      isParticleAt(text, index) &&
      previous &&
      previous.source !== "other" &&
      previous.source !== "kana" &&
      previous.source !== "particle"
    ) {
      tokens.push(
        makeToken({
          surface: char,
          reading: char,
          romaji: IRREGULAR_PARTICLES[char] ?? kanaToRomaji(char),
          meaning: PARTICLE_NOTES[char],
          source: "particle",
          kanji: [],
        }),
      );
      index += 1;
      continue;
    }

    // 1. Vocabulary, longest match first. This runs before anything
    //    character-level, which is what keeps 日本人 from becoming 日 + 本 + 人.
    let matched = false;
    for (const key of ALL_WORD_KEYS) {
      if (key.length < 2 || !text.startsWith(key, index)) continue;
      const entry = WORD_MAP.get(key)!;
      tokens.push(
        makeToken({
          surface: key,
          reading: entry.reading,
          romaji: kanaToRomaji(entry.reading),
          meaning: entry.meaning,
          source: "word",
        }),
      );
      index += key.length;
      matched = true;
      break;
    }
    if (matched) continue;

    if (isKanji(char)) {
      let run = "";
      while (index + run.length < text.length && isKanji(text[index + run.length])) {
        run += text[index + run.length];
      }

      // 2. An inflected verb or adjective: a known stem plus its okurigana.
      const stemReading = STEMS.get(run);
      const ending = stemReading ? okurigana(text, index + run.length) : "";
      if (stemReading && ending) {
        const surface = run + ending;
        const reading = stemReading + ending;
        tokens.push(
          makeToken({
            surface,
            reading,
            romaji: kanaToRomaji(reading),
            meaning: WORD_MAP.get(surface)?.meaning,
            source: "inflected",
          }),
        );
        index += surface.length;
        continue;
      }

      // A run whose tail is a stem: 新入社員 has no okurigana, but 会議室で開く
      // style runs end in a verb. Split the trailing stem off when the kana
      // after the run continues it.
      if (run.length > 1) {
        const tail = run[run.length - 1];
        const tailStem = STEMS.get(tail);
        const tailEnding = tailStem ? okurigana(text, index + run.length) : "";
        if (tailStem && tailEnding) {
          tokens.push(...tokensForRun(run.slice(0, -1)));
          const surface = tail + tailEnding;
          const reading = tailStem + tailEnding;
          tokens.push(
            makeToken({
              surface,
              reading,
              romaji: kanaToRomaji(reading),
              meaning: WORD_MAP.get(surface)?.meaning,
              source: "inflected",
            }),
          );
          index += run.length + tailEnding.length;
          continue;
        }
      }

      // 3. Compound segmentation, then per-character readings for the rest.
      tokens.push(...tokensForRun(run));
      index += run.length;
      continue;
    }

    // 4. Single-character vocabulary, after stems so that 分かりません is not
    //    read as 分 ("fun") followed by かりません.
    for (const key of ALL_WORD_KEYS) {
      if (key.length !== 1 || !text.startsWith(key, index)) continue;
      const entry = WORD_MAP.get(key)!;
      tokens.push(
        makeToken({
          surface: key,
          reading: entry.reading,
          romaji: kanaToRomaji(entry.reading),
          meaning: entry.meaning,
          source: "word",
        }),
      );
      index += key.length;
      matched = true;
      break;
    }
    if (matched) continue;

    if (isKana(char)) {
      let run = "";
      while (index + run.length < text.length && isKana(text[index + run.length])) {
        run += text[index + run.length];
      }
      tokens.push(
        makeToken({
          surface: run,
          reading: toHiragana(run),
          romaji: kanaToRomaji(run),
          source: "kana",
          kanji: [],
        }),
      );
      index += run.length;
      continue;
    }

    // Latin letters, digits and anything else pass through untouched.
    let run = "";
    while (
      index + run.length < text.length &&
      !isKana(text[index + run.length]) &&
      !isKanji(text[index + run.length]) &&
      !PASSTHROUGH.test(text[index + run.length])
    ) {
      run += text[index + run.length];
    }
    tokens.push(makeToken({ surface: run, reading: run, romaji: run, source: "other", kanji: [] }));
    index += run.length;
  }

  return summarise(tokens);
}

function summarise(tokens: Token[]): Analysis {
  const unresolved = [
    ...new Set(tokens.filter((t) => t.source === "unresolved").map((t) => t.surface)),
  ];

  const kanji: KanjiEntry[] = [];
  const seenKanji = new Set<string>();
  for (const token of tokens) {
    for (const entry of token.kanji) {
      if (seenKanji.has(entry.kanji)) continue;
      seenKanji.add(entry.kanji);
      kanji.push(entry);
    }
  }

  const hiragana = tokens
    .map((t) => (t.source === "unresolved" ? UNRESOLVED_KANA : t.reading || t.surface))
    .join("");

  const katakana = tokens
    .map((t) =>
      t.source === "unresolved"
        ? UNRESOLVED_KANA
        : t.source === "other"
          ? t.surface
          : toKatakanaLocal(t.reading || t.surface),
    )
    .join("");

  // A space between adjacent readable tokens is what makes a long string
  // legible; punctuation must not be pushed away from the word before it.
  const romaji = tokens
    .map((token, i) => {
      const value = token.source === "unresolved" ? UNRESOLVED_ROMAJI : token.romaji || token.surface;
      const next = tokens[i + 1];
      const spaced = next && token.source !== "other" && next.source !== "other";
      return spaced ? `${value} ` : value;
    })
    .join("")
    .replace(/ +([,.!?、。）)\]])/g, "$1")
    .trim();

  const typing = tokens
    .map((t) => (t.source === "other" ? t.surface : t.typing || UNRESOLVED_ROMAJI))
    .join("");

  return {
    tokens,
    hiragana,
    katakana,
    romaji,
    typing,
    kanji,
    unresolved,
    complete:
      unresolved.length === 0 &&
      !tokens.some((t) => t.confidence === "approximate"),
  };
}

/** Hiragana and katakana blocks are offset by exactly 0x60. */
function toKatakanaLocal(text: string): string {
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x3041 && code <= 0x3096 ? String.fromCharCode(code + 0x60) : char;
    })
    .join("");
}

/**
 * Analyses each line on its own.
 *
 * Lines are independent: nothing from one carries into the next, so a stray
 * fragment on line three cannot change how line one is read or translated.
 */
export function analyseLines(text: string): Analysis[] {
  return text.split("\n").map((line) => analyse(line));
}

/** Every kanji in the text that the bundled list knows about. */
export function kanjiIn(text: string): KanjiEntry[] {
  return analyse(text).kanji;
}

export { hasJapanese };
