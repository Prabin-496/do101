/**
 * Morphological analysis, for readings the bundled vocabulary cannot give.
 *
 * `dictionary.ts` ships a curated core — a few hundred kanji and words — so
 * that the reading tools work instantly, offline, with nothing downloaded. For
 * the Japanese a learner meets in a textbook that is enough. For the Japanese
 * they are actually sent it is not: a company announcement runs straight past
 * it, and `annotate.ts` then either prints "?" or falls back to reading each
 * kanji separately, which is usually wrong. 浅野 comes out "sen'ya" instead of
 * "asano", 取り組み as "to ri kumi mi" instead of "torikumi".
 *
 * Getting those right is not a matter of a longer word list. It needs to know
 * where words begin and end, and that is morphological analysis. kuromoji does
 * it properly, with the full IPADIC behind it.
 *
 * The cost is the dictionary: ~17MB, gzipped already. So nothing here loads
 * until a reader asks for it, the result is cached by the browser afterwards,
 * and every other tool on the site is untouched. When it is not loaded, or
 * fails to load, the bundled fallback is still there — worse readings, but
 * readings.
 */

import type { IpadicFeatures, Tokenizer } from "@sglkc/kuromoji";
import { toHiragana, toKatakana } from "./kana";

/** Where `scripts/copy-kuromoji-dict.mjs` puts the dictionary. */
const DICT_PATH = "/kuromoji/dict";

/**
 * A reading the analyser is confident about, positioned in the source text.
 *
 * Indexed by where it starts so `analyse` can consult it as it walks the text,
 * rather than having to be rewritten around a second tokenisation.
 */
export interface ReadingSpan {
  surface: string;
  /** Hiragana. Empty when the analyser had no reading — Latin text, digits. */
  reading: string;
  /** Particles are romanised by their sound, so は is "wa" and not "ha". */
  particle: boolean;
}

export type TokenizerStatus = "idle" | "loading" | "ready" | "failed";

let tokenizer: Tokenizer<IpadicFeatures> | null = null;
let pending: Promise<Tokenizer<IpadicFeatures>> | null = null;
let status: TokenizerStatus = "idle";

const listeners = new Set<(status: TokenizerStatus) => void>();

function setStatus(next: TokenizerStatus): void {
  status = next;
  for (const listener of listeners) listener(next);
}

export function tokenizerStatus(): TokenizerStatus {
  return status;
}

/** Subscribe to load progress. Returns an unsubscribe function. */
export function onTokenizerStatus(listener: (status: TokenizerStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Loads the analyser, once.
 *
 * Concurrent callers share one download: the tool analyses every line of a
 * paragraph, and without this each would start its own.
 */
export function loadTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (tokenizer) return Promise.resolve(tokenizer);
  if (pending) return pending;

  setStatus("loading");
  pending = import("@sglkc/kuromoji")
    .then(
      (kuromoji) =>
        new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
          kuromoji.builder({ dicPath: DICT_PATH }).build((error, built) => {
            if (error) reject(error);
            else resolve(built);
          });
        }),
    )
    .then((built) => {
      tokenizer = built;
      setStatus("ready");
      return built;
    })
    .catch((error: unknown) => {
      // Cleared rather than kept, so a reader on a flaky connection can retry.
      pending = null;
      setStatus("failed");
      throw error;
    });

  return pending;
}

/** The loaded analyser, or null. Lets a synchronous render use it if it is there. */
export function readyTokenizer(): Tokenizer<IpadicFeatures> | null {
  return tokenizer;
}

/**
 * Reading spans for one line, keyed by start index.
 *
 * IPADIC gives readings in katakana; everything downstream works in hiragana,
 * so they are converted here and nowhere else. A token with no reading — Latin
 * letters, digits, punctuation — is left out entirely rather than recorded as
 * empty, so `analyse` handles it exactly as it always has.
 */
/**
 * Connective particles that are part of the word they attach to.
 *
 * て/で make the te-form, ば the conditional, つつ and ながら the simultaneous,
 * たり the representative. They inflect a verb and belong to it. The other
 * 接続助詞 — が, ので, から, けれど, し — join two clauses and are separate
 * words, so the class alone cannot be used to decide this.
 */
const INFLECTING_PARTICLES = new Set(["て", "で", "ば", "つつ", "ながら", "たり"]);

/** A part of speech that can carry an inflection. */
function inflects(pos: string): boolean {
  return pos === "動詞" || pos === "形容詞" || pos === "助動詞";
}

/**
 * Whether a token continues the word before it rather than starting a new one.
 *
 * IPADIC segments by morpheme, not by word: 増えています arrives as
 * 増え|て|い|ます and 考えられていました as 考え|られ|て|い|まし|た. Romanised
 * apart those read "kangae rare te i mashi ta", which is the complaint about
 * words being split into artificial pieces.
 *
 * The distinction that matters is what the previous token was. An auxiliary
 * after a verb inflects it and belongs to it — 考えられていた is one word. The
 * same auxiliary after a noun is the copula and is a word of its own: 社員です
 * is "shain desu", not "shaindesu", and 事実である is "jijitsu de aru". Judging
 * the auxiliary on its own, which is what this did at first, cannot tell those
 * apart.
 */
function continuesPreviousWord(feature: IpadicFeatures, previous: IpadicFeatures): boolean {
  const { pos, pos_detail_1: detail, surface_form: surface } = feature;

  // さ in 難しさ, 方 in 働き方, られ in 考えられる.
  if (detail === "接尾") return true;

  if (pos === "助動詞") {
    // Chained auxiliaries are one word — 食べさせられました — except after the
    // copula, where である and であった are read as two: "de aru", "de atta".
    if (previous.pos === "助動詞") {
      return previous.surface_form !== "で" && previous.surface_form !== "だ";
    }
    // 新た is a noun only by part of speech; な inflects it, so 新たな is one
    // word. That is the difference from 社員です, where です is the copula.
    if (previous.pos === "名詞") return previous.pos_detail_1 === "形容動詞語幹";
    // ます, た, ない after a verb or adjective inflect it.
    return inflects(previous.pos);
  }

  // いる, ある, くる, しまう, おり — part of the verb only after a real
  // te-form. つつある and である are two words, and both end in something that
  // looks like one if only the surface is checked.
  if (pos === "動詞" && detail === "非自立") {
    return previous.pos === "助詞" && (previous.surface_form === "て" || previous.surface_form === "で");
  }

  if (pos === "助詞" && detail === "接続助詞" && INFLECTING_PARTICLES.has(surface)) {
    return inflects(previous.pos);
  }

  return false;
}

export function readingSpans(
  text: string,
  using: Tokenizer<IpadicFeatures> | null = tokenizer,
): Map<number, ReadingSpan> {
  const spans = new Map<number, ReadingSpan>();
  if (!using || !text.trim()) return spans;

  let features: IpadicFeatures[];
  try {
    features = using.tokenize(text);
  } catch {
    // A tokeniser failure must never cost the reader the rest of the analysis.
    return spans;
  }

  for (let i = 0; i < features.length; i += 1) {
    const feature = features[i];
    // word_position is 1-based.
    const start = feature.word_position - 1;
    if (text.slice(start, start + feature.surface_form.length) !== feature.surface_form) continue;

    // IPADIC classes punctuation as 記号 and hands back a "reading" for it.
    // Letting that through would make 「 and ！ into words, which then collect
    // spaces in the romaji line; the existing passthrough rule handles them.
    if (feature.pos === "記号") continue;

    let surface = feature.surface_form;
    let raw = feature.reading;
    if (!raw || raw === "*") continue;

    // Fold the rest of the word back in. Two separate reasons to join:
    //
    //  - A small tsu doubles the consonant of the syllable *after* it, and the
    //    analyser happily ends a token on one (なっ|て|いる, 伴っ|て). Split
    //    apart the なっ has nothing to double and becomes "na".
    //  - A conjugated verb or adjective is one word, however many morphemes
    //    IPADIC breaks it into.
    while (i + 1 < features.length) {
      const next = features[i + 1];
      const nextReading = next.reading;
      if (!nextReading || nextReading === "*" || next.pos === "記号") break;
      if (!/[っッ]$/.test(raw) && !continuesPreviousWord(next, features[i])) break;

      surface += next.surface_form;
      raw += nextReading;
      i += 1;
    }

    const particle = feature.pos === "助詞";

    // IPADIC stores compound particles whole: に対する and を通じて each arrive
    // as one 助詞. Romanised as a unit they come out "nitaisuru" and
    // "wotsūjite", with the particle's own sound rule lost inside the word. The
    // leading kana is split back off so it is read as the particle it is.
    if (
      particle &&
      feature.pos_detail_2 === "連語" &&
      surface.length > 1 &&
      toKatakana(surface[0]) === raw[0]
    ) {
      spans.set(start, { surface: surface[0], reading: surface[0], particle: true });
      spans.set(start + 1, {
        surface: surface.slice(1),
        reading: toHiragana(raw.slice(1)),
        particle: false,
      });
      continue;
    }

    spans.set(start, {
      surface,
      reading: toHiragana(raw),
      particle,
    });
  }
  return spans;
}
