import { KANJI_MAP, WORDS, WORD_MAP, type KanjiEntry, type WordEntry } from "./dictionary";
import {
  hasJapanese, isKana, isKanji, kanaToHepburn, kanaToRomaji, toHiragana, typingString,
} from "./kana";
import { matchNumeral } from "./numbers";
import { readingSpans, type ReadingSpan } from "./tokenizer";
import { stripRuby } from "./ruby";
import { sanitize } from "./sanitize";
import type { IpadicFeatures, Tokenizer } from "@sglkc/kuromoji";

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
  | "analyser"
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
  /**
   * The text the tokens were actually derived from: the raw input with
   * annotation artifacts and inline furigana taken out.
   *
   * The caller keeps the raw input for display and never has to reconstruct
   * what was analysed, which is what stops a rendered annotation from being
   * fed back in on the next pass.
   */
  normalized: string;
  /** Annotation artifacts removed before analysis, for the UI to report. */
  removed: string[];
}

/** Shown in place of a character with no known reading. */
const UNRESOLVED_ROMAJI = "?";
const UNRESOLVED_KANA = "？";

const CONFIDENCE_BY_SOURCE: Record<TokenSource, Confidence> = {
  analyser: "exact",
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
  analyser: "Segmented and read by the full-dictionary analyser. This is how the word is actually read here, in this sentence.",
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
 * Words bucketed by first character, longest first within each bucket.
 *
 * The main loop asks "does a word start here?" at every position. Walking the
 * whole list each time is quadratic in the length of the text — nine seconds
 * on 80,000 characters — while a bucket lookup is proportional to the number
 * of words sharing that first character, which is small.
 */
const WORDS_BY_FIRST = new Map<string, string[]>();
for (const key of ALL_WORD_KEYS) {
  const bucket = WORDS_BY_FIRST.get(key[0]);
  if (bucket) bucket.push(key);
  else WORDS_BY_FIRST.set(key[0], [key]);
}

/** Candidate words starting with this character, longest first. */
function candidatesAt(char: string): string[] {
  return WORDS_BY_FIRST.get(char) ?? [];
}

/** The longest vocabulary entry of at least `min` characters starting here. */
function longestWordAt(text: string, index: number, min = 1): string | null {
  for (const key of candidatesAt(text[index])) {
    if (key.length < min) continue;
    if (text.startsWith(key, index)) return key;
  }
  return null;
}

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


/**
 * Gemination in Sino-Japanese compounds.
 *
 * When two on'yomi meet, a final ツ or チ regularly becomes っ before a
 * voiceless consonant, and a following は-row kana hardens to ぱ: 設(セツ) plus
 * 定(テイ) is せってい, not せつてい, and 出(シュツ) plus 発(ハツ) is しゅっぱつ.
 *
 * ク and キ do the same, but only before the か row — 学校 is がっこう while
 * 学生 stays がくせい — so they are handled separately rather than lumped in.
 */
const GEMINATE_AFTER_TSU = /^[かきくけこさしすせそたちつてとはひふへほ]/;
const GEMINATE_AFTER_KU = /^[かきくけこ]/;
const HARDEN: Record<string, string> = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };

function joinCompoundReadings(left: string, right: string): string {
  if (!left || !right) return left + right;
  const last = left[left.length - 1];
  const geminates =
    ((last === "つ" || last === "ち") && GEMINATE_AFTER_TSU.test(right)) ||
    ((last === "く" || last === "き") && GEMINATE_AFTER_KU.test(right));
  if (!geminates) return left + right;
  const head = HARDEN[right[0]] ?? right[0];
  return `${left.slice(0, -1)}っ${head}${right.slice(1)}`;
}


/* ------------------------------------------------------------------ */
/* Rendaku (sequential voicing)                                        */
/* ------------------------------------------------------------------ */

/** The voicing a kana takes as the second element of a native compound. */
const VOICED: Record<string, string> = {
  か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご",
  さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ",
  た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど",
  は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ",
};

/** Kana that are already voiced obstruents, which block further voicing. */
const ALREADY_VOICED = /[がぎぐげござじずぜぞだぢづでどばびぶべぼ]/;

/**
 * Applies sequential voicing to the second half of a native compound.
 *
 * 花 + 火 is はなび, not はなひ. The rule is blocked by Lyman's Law: an element
 * that already contains a voiced obstruent does not take another, which is why
 * 山風 stays やまかぜ rather than becoming やまがぜ.
 */
function rendaku(second: string): string {
  if (!second) return second;
  const head = VOICED[second[0]];
  if (!head) return second;
  if (ALREADY_VOICED.test(second)) return second;
  return head + second.slice(1);
}

/** The iteration mark, which repeats the character before it. */
const ITERATION_MARK = "々";

/**
 * Reads a repeated kanji written with 々.
 *
 * 人々 is ひとびと: the kun reading twice, with the second voiced. Reading it as
 * a Sino compound would give じんじん, and leaving 々 alone put a character into
 * the romaji line that no reader could pronounce.
 */
function readIteration(kanji: string): string | null {
  const entry = KANJI_MAP.get(kanji);
  if (!entry) return null;
  const kun = entry.kun[0]?.replace(/[.\-–].*$/, "");
  if (!kun) return null;
  return kun + rendaku(kun);
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
function segmentKanjiRun(run: string, insideCompound: boolean): Segment[] {
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
      // A one-character entry holds the reading that character takes alone —
      // 国 is "kuni". Inside a compound it takes its on'yomi instead, so 国際
      // is "kokusai" and not "kunisai". Skip it and let the fallback read it.
      if (insideCompound && length === 1 && (KANJI_MAP.get(candidate)?.on.length ?? 0) > 0) {
        continue;
      }
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

/**
 * Turns a segmented kanji run into tokens.
 *
 * Characters that fall through to a per-character reading are merged back into
 * one token when they sit next to each other, because they are one compound:
 * 開発 should read "kaihatsu" as a unit rather than "kai hatsu" as two.
 */
function tokensForRun(run: string): Token[] {
  // A repetition pair is its own unit, read from the kun reading twice with
  // the second voiced: 人々 is ひとびと, never じんじん.
  const mark = run.indexOf(ITERATION_MARK);
  if (mark > 0) {
    const out: Token[] = [];
    const base = run[mark - 1];
    const before = run.slice(0, mark - 1);
    const after = run.slice(mark + 1);
    if (before) for (const token of tokensForRun(before)) out.push(token);

    const repeated = readIteration(base);
    if (repeated) {
      out.push(
        makeToken({
          surface: base + ITERATION_MARK,
          reading: repeated,
          romaji: kanaToRomaji(repeated),
          meaning: KANJI_MAP.get(base)?.meaning,
          source: "word",
        }),
      );
    } else {
      // No kun reading to repeat, so read it as the doubled kanji it stands for.
      for (const token of tokensForRun(base + base)) out.push(token);
    }
    if (after) for (const token of tokensForRun(after)) out.push(token);
    return out;
  }
  // A leading 々 has nothing to repeat.
  if (mark === 0) {
    return [
      makeToken({
        surface: run[0],
        reading: "",
        romaji: UNRESOLVED_ROMAJI,
        source: "unresolved",
      }),
      ...(run.length > 1 ? tokensForRun(run.slice(1)) : []),
    ];
  }

  const insideCompound = run.length > 1;
  const segments = segmentKanjiRun(run, insideCompound);
  const tokens: Token[] = [];

  let pending: { surface: string; reading: string; resolved: boolean } | null = null;

  const flush = () => {
    if (!pending) return;
    const { surface, reading, resolved } = pending;
    pending = null;
    if (!resolved) {
      tokens.push(
        makeToken({
          surface,
          reading: "",
          romaji: UNRESOLVED_ROMAJI,
          meaning: KANJI_MAP.get(surface)?.meaning,
          source: "unresolved",
        }),
      );
      return;
    }
    const source = insideCompound ? "compound" : "kanji";
    tokens.push(
      makeToken({
        surface,
        reading,
        // A compound read from its kanji is still one word, so it takes the
        // macron form like any other.
        romaji: source === "compound" ? kanaToHepburn(reading) : kanaToRomaji(reading),
        meaning: surface.length === 1 ? KANJI_MAP.get(surface)?.meaning : undefined,
        source,
      }),
    );
  };

  for (const segment of segments) {
    if (segment.entry) {
      flush();
      tokens.push(
        makeToken({
          surface: segment.surface,
          reading: segment.entry.reading,
          romaji: kanaToHepburn(segment.entry.reading),
          meaning: segment.entry.meaning,
          source: "word",
        }),
      );
      continue;
    }

    const entry = KANJI_MAP.get(segment.surface);
    const reading = entry
      ? insideCompound
        ? compoundReading(entry)
        : standaloneReading(entry)
      : "";
    const resolved = reading !== "";

    // Only merge with the run so far if both sides resolved the same way.
    if (pending && pending.resolved === resolved) {
      pending.surface += segment.surface;
      pending.reading = resolved
        ? joinCompoundReadings(pending.reading, reading)
        : pending.reading + reading;
    } else {
      flush();
      pending = { surface: segment.surface, reading, resolved };
    }
  }
  flush();

  return tokens;
}


/* ------------------------------------------------------------------ */
/* Main pass                                                           */
/* ------------------------------------------------------------------ */

export interface AnalyseOptions {
  /**
   * The morphological analyser, when it has loaded. This is the primary path:
   * it segments the sentence into words and gives each one the reading it
   * actually takes there.
   */
  tokenizer?: Tokenizer<IpadicFeatures> | null;
  /** Pre-computed spans, for callers that already tokenised. Tests, mainly. */
  readings?: Map<number, ReadingSpan>;
}

/**
 * Reads Japanese.
 *
 * The order matters more than anything else here, and getting it wrong is what
 * produced every reading complaint about this tool:
 *
 *   1. Inline ruby — 難（むずか）しさ — is taken out first and kept as a
 *      reading. Left in, it splits the word so nothing downstream can see
 *      難しさ, and the kana gets romanised a second time as "muzuka（muzuka）shi".
 *   2. The morphological analyser segments what is left into whole words and
 *      supplies each one's reading. 在宅勤務 is one word read ざいたくきんむ.
 *   3. Only where that is unavailable do the character-level rules below run.
 *
 * Step 3 used to be the whole pipeline, and it cannot work. A kanji's reading
 * depends on the word it sits in, so reading characters one at a time and
 * joining the results gives 従業員 → "gyōin", 困難 → "muzuka", 発生 →
 * "ta ushitako". No amount of extra vocabulary fixes that, because the fault is
 * the order of resolution, not the size of the dictionary. It survives only as
 * a fallback for the moment before the analyser has loaded, and it is reported
 * as approximate when it runs.
 */
export function analyse(text: string, options: AnalyseOptions = {}): Analysis {
  // The pipeline runs one way only, and these two steps are the gate:
  //
  //   raw input -> sanitize -> ruby -> token analysis -> hiragana -> romaji
  //
  // Nothing produced further down ever comes back in. Annotation artifacts —
  // a romaji gloss in brackets, a footnote number, a stray asterisk — are
  // stripped here, because analysing them is what produced output like
  // "zaitaku kinmu（zaitakukinmu）": the word read properly, then its own
  // annotation read a second time beside it.
  const cleaned = sanitize(text);
  const ruby = stripRuby(cleaned.text);
  const spans = options.readings ?? readingSpans(ruby.text, options.tokenizer ?? null);

  // The author's own readings fill whatever the analyser could not name. Where
  // the analyser did produce a span it wins, because it read the whole word
  // and the annotation only covers the kanji in front of the brackets.
  if (ruby.found) {
    const covered = new Set<number>();
    for (const [at, span] of spans) {
      for (let i = 0; i < span.surface.length; i += 1) covered.add(at + i);
    }
    for (const [at, reading] of ruby.readings) {
      if (!covered.has(at)) spans.set(at, { ...reading, particle: false });
    }
  }

  const analysis = analyseText(ruby.text, spans);
  analysis.normalized = ruby.text;
  analysis.removed = cleaned.removed;
  return analysis;
}

function analyseText(text: string, readings: Map<number, ReadingSpan>): Analysis {
  const options: AnalyseOptions = { readings };
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

    // 0. The analyser, when it has been loaded and knows this position. It
    //    outranks every rule below, having chosen this reading with the whole
    //    sentence in view, but not the punctuation test above: that is a
    //    character class, and cheaper to trust than a dictionary.
    const span = options.readings?.get(index);
    if (span && text.startsWith(span.surface, index) && span.reading) {
      tokens.push(analyserToken(span));
      index += span.surface.length;
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
    const multiCharWord = longestWordAt(text, index, 2);
    for (const key of multiCharWord ? [multiCharWord] : []) {
      const entry = WORD_MAP.get(key)!;
      tokens.push(
        makeToken({
          surface: key,
          reading: entry.reading,
          // Hepburn macrons: a word is one unit, so its long vowels are real.
          romaji: [...key].every((c) => isKanji(c))
            ? kanaToHepburn(entry.reading)
            : kanaToRomaji(entry.reading),
          meaning: entry.meaning,
          source: "word",
        }),
      );
      index += key.length;
      matched = true;
      break;
    }
    if (matched) continue;

    // A numeral — in digits or kanji — together with any counter attached to
    // it. Counters are irregular enough that this cannot be left to the
    // compound reader.
    const numeral = matchNumeral(text, index);
    if (numeral) {
      tokens.push(
        makeToken({
          surface: numeral.surface,
          reading: numeral.kana,
          romaji: numeral.romaji,
          meaning: numeral.meaning,
          source: "word",
        }),
      );
      index += numeral.surface.length;
      continue;
    }

    if (isKanji(char)) {
      let run = "";
      while (
        index + run.length < text.length &&
        (isKanji(text[index + run.length]) ||
          // 々 belongs to the run it repeats, not to whatever follows.
          (text[index + run.length] === ITERATION_MARK && run.length > 0))
      ) {
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
          for (const token of tokensForRun(run.slice(0, -1))) tokens.push(token);
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
      // push(...arr) exceeds the argument limit on a very long run, so the
      // tokens are appended one at a time.
      for (const token of tokensForRun(run)) tokens.push(token);
      index += run.length;
      continue;
    }

    // 4. Single-character vocabulary, after stems so that 分かりません is not
    //    read as 分 ("fun") followed by かりません.
    for (const key of WORD_MAP.has(char) ? [char] : []) {
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

/**
 * A token from a reading the analyser supplied.
 *
 * Particles keep the existing treatment: IPADIC reads は as ハ, which is the
 * character's name rather than its sound in that role, and romanising it "ha"
 * is exactly the mistake this tool exists to prevent.
 *
 * Meanings still come from the bundled vocabulary — IPADIC carries no English
 * — so a word outside it gets a correct reading and no gloss, which is the
 * right way round.
 */
function analyserToken(span: ReadingSpan): Token {
  const { surface, reading } = span;

  if (span.particle && surface.length === 1 && IRREGULAR_PARTICLES[surface]) {
    return makeToken({
      surface,
      reading: surface,
      romaji: IRREGULAR_PARTICLES[surface],
      meaning: PARTICLE_NOTES[surface],
      source: "particle",
      kanji: [],
    });
  }

  return makeToken({
    surface,
    reading,
    // Macrons belong to a word read as one unit, which is what this is.
    romaji: [...surface].some(isKanji) ? kanaToHepburn(reading) : kanaToRomaji(reading),
    meaning: WORD_MAP.get(surface)?.meaning,
    source: "analyser",
  });
}

/**
 * Whether a space belongs beside this token in the romaji line.
 *
 * Punctuation must stay attached to the word before it, but a Latin word in
 * the middle of Japanese is a word and needs its own space: 公式note で is
 * "kōshiki note de", not "kōshikinotede". Both arrive here as "other", so the
 * source alone cannot tell them apart.
 */
function isWordlike(token: Token): boolean {
  return token.source !== "other" || /^[\p{L}\p{N}]+$/u.test(token.surface);
}

/**
 * The romaji for one token, guaranteed to contain no Japanese.
 *
 * The romaji line is the whole reason someone opens this tool: they cannot read
 * the kanji, so a kanji printed inside the romaji is worse than useless. This
 * used to be possible two ways — a token whose romaji came out empty fell back
 * to printing its own surface, and a reading that itself still held a kanji was
 * passed through by the kana converter untouched.
 *
 * A token that cannot be read contributes nothing to the line. Not the kanji,
 * and not a "?" either: a question mark in the middle of a romanisation reads
 * as part of the sentence. What could not be read is reported through
 * `Analysis.unresolved` and marked on its own word-by-word card, which is where
 * a reader can act on it.
 */
function romajiFor(token: Token): string {
  if (token.source === "unresolved") return "";
  const value = token.romaji || token.surface;
  return hasJapanese(value) ? "" : value;
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
      const value = romajiFor(token);
      const next = tokens[i + 1];
      const spaced = next && isWordlike(token) && isWordlike(next);
      return spaced ? `${value} ` : value;
    })
    .join("")
    .replace(/ +([,.!?、。）)\]])/g, "$1")
    // A token that could not be read contributes nothing, which can leave the
    // spaces that were meant to sit either side of it.
    .replace(/ {2,}/g, " ")
    .trim();

  const typing = tokens
    .map((t) => (t.source === "other" ? t.surface : t.typing))
    .join("");

  return {
    normalized: "",
    removed: [],
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
export function analyseLines(text: string, options: AnalyseOptions = {}): Analysis[] {
  return text.split("\n").map((line) => analyse(line, options));
}

/** Every kanji in the text that the bundled list knows about. */
export function kanjiIn(text: string, options: AnalyseOptions = {}): KanjiEntry[] {
  return analyse(text, options).kanji;
}

export { hasJapanese };
