import { KANJI_MAP, WORD_KEYS, WORD_MAP, type KanjiEntry } from "./dictionary";
import { hasJapanese, isKana, isKanji, kanaToRomaji, toHiragana } from "./kana";

/**
 * Breaks Japanese text into readable pieces.
 *
 * Where a token comes from matters more than the reading itself, because the
 * confidence differs enormously: kana is exact, a dictionary word is reliable,
 * a single kanji read in isolation is a guess that is often wrong in compounds.
 * Every token carries its source so the interface can show which is which
 * instead of presenting all of them as equally certain.
 */
export type TokenSource = "kana" | "word" | "kanji" | "unknown" | "other";

export interface Token {
  surface: string;
  /** Reading in hiragana. Empty when unknown. */
  reading: string;
  romaji: string;
  meaning?: string;
  source: TokenSource;
  kanji?: KanjiEntry[];
}

export interface Annotation {
  tokens: Token[];
  /** Full reading in hiragana, with unknown runs left as written. */
  hiragana: string;
  katakana: string;
  romaji: string;
  /** True when every kanji in the text was resolved from the vocabulary. */
  complete: boolean;
  unknown: string[];
}


/**
 * The three particles that are not pronounced as they are written.
 *
 * は is "wa", へ is "e" and を is "o" — but only as particles. Inside a word
 * は is "ha" (はな, flower), so this only applies when the kana stands alone
 * between other tokens, which is exactly when it is functioning as a particle.
 * を has no other use in modern Japanese, so it is always "o".
 */
const PARTICLES: Record<string, string> = { は: "wa", へ: "e", を: "o" };

const PARTICLE_NOTES: Record<string, string> = {
  は: "topic particle — written は, pronounced \"wa\"",
  へ: "direction particle — written へ, pronounced \"e\"",
  を: "object particle — written を, pronounced \"o\"",
};

function particleRomaji(run: string): string | undefined {
  return PARTICLES[run];
}

/** Punctuation and spacing, which need no reading. */
const PASSTHROUGH = /[\s、。「」『』・！？…ー〜（）()［］\[\],.!?:;'"“”‘’-]/;

export function annotate(text: string): Annotation {
  const tokens: Token[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (PASSTHROUGH.test(char)) {
      tokens.push({ surface: char, reading: char, romaji: char, source: "other" });
      index += 1;
      continue;
    }

    // Longest dictionary match wins, which is what keeps 日本人 from being read
    // as 日 + 本 + 人.
    let matched = false;
    for (const key of WORD_KEYS) {
      if (!text.startsWith(key, index)) continue;
      const entry = WORD_MAP.get(key)!;
      tokens.push({
        surface: key,
        reading: entry.reading,
        romaji: kanaToRomaji(entry.reading),
        meaning: entry.meaning,
        source: "word",
        kanji: [...key].filter(isKanji).map((c) => KANJI_MAP.get(c)).filter((k): k is KanjiEntry => !!k),
      });
      index += key.length;
      matched = true;
      break;
    }
    if (matched) continue;

    if (isKana(char)) {
      // A particle leading a kana run, straight after a noun, is split off so
      // it can be read correctly: 駅はどこ is "eki wa doko", not "eki hadoko".
      const previous = tokens[tokens.length - 1];
      if (
        PARTICLES[char] &&
        previous &&
        (previous.source === "word" || previous.source === "kanji")
      ) {
        tokens.push({
          surface: char,
          reading: char,
          romaji: PARTICLES[char],
          meaning: PARTICLE_NOTES[char],
          source: "kana",
        });
        index += 1;
        continue;
      }

      // Group the run of kana so it reads as one chunk.
      let run = "";
      while (index + run.length < text.length && isKana(text[index + run.length])) {
        run += text[index + run.length];
      }
      tokens.push({
        surface: run,
        reading: toHiragana(run),
        romaji: particleRomaji(run) ?? kanaToRomaji(run),
        source: "kana",
        meaning: particleRomaji(run) ? PARTICLE_NOTES[run] : undefined,
      });
      index += run.length;
      continue;
    }

    if (isKanji(char)) {
      const entry = KANJI_MAP.get(char);
      if (entry) {
        // A single kanji outside a known word: the kun reading is the better
        // guess standing alone, but it is still a guess.
        const reading = entry.kun[0] ? entry.kun[0].replace(/[.-].*$/, "") : toHiragana(entry.on[0] ?? "");
        tokens.push({
          surface: char,
          reading,
          romaji: kanaToRomaji(reading),
          meaning: entry.meaning,
          source: "kanji",
          kanji: [entry],
        });
      } else {
        tokens.push({ surface: char, reading: "", romaji: "", source: "unknown" });
      }
      index += 1;
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
    tokens.push({ surface: run, reading: run, romaji: run, source: "other" });
    index += run.length;
  }

  const unknown = tokens
    .filter((token) => token.source === "unknown" || (token.source === "kanji" && !token.reading))
    .map((token) => token.surface);

  const hiragana = tokens.map((token) => token.reading || token.surface).join("");

  return {
    tokens,
    hiragana,
    katakana: tokens
      .map((token) => (token.reading ? toKatakanaLocal(token.reading) : token.surface))
      .join(""),
    romaji: tokens
      .map((token, i) => {
        const romaji = token.romaji || token.surface;
        // Space between readable words makes long strings legible.
        const next = tokens[i + 1];
        const spaced = next && token.source !== "other" && next.source !== "other";
        return spaced ? `${romaji} ` : romaji;
      })
      .join("")
      .replace(/ +([,.!?、。])/g, "$1")
      .trim(),
    complete: unknown.length === 0 && !tokens.some((t) => t.source === "kanji"),
    unknown: [...new Set(unknown)],
  };
}

/** Local import avoided to keep the kana module's public surface small. */
function toKatakanaLocal(text: string): string {
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      // Hiragana and katakana blocks are offset by exactly 0x60.
      return code >= 0x3041 && code <= 0x3096 ? String.fromCharCode(code + 0x60) : char;
    })
    .join("");
}

/** Every kanji in the text that the bundled list knows about. */
export function kanjiIn(text: string): KanjiEntry[] {
  const seen = new Set<string>();
  const found: KanjiEntry[] = [];
  for (const char of text) {
    if (!isKanji(char) || seen.has(char)) continue;
    seen.add(char);
    const entry = KANJI_MAP.get(char);
    if (entry) found.push(entry);
  }
  return found;
}

export { hasJapanese };
