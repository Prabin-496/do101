import { KANJI_MAP, WORD_KEYS, WORD_MAP, WORDS, type KanjiEntry } from "./dictionary";
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
 * Verb and adjective stems, derived from the dictionary at load.
 *
 * Japanese inflects by changing the kana after the kanji: 行く becomes 行きます,
 * 行きました, 行かない. Listing every form is hopeless, but the kanji and its
 * reading stay put, so each entry written as "kanji + kana" yields a stem —
 * 行 reads い — and any kana that follows is the ending. Without this, 行きました
 * is read as 行 (い) plus きました, which romanises as "i kimashita" rather than
 * "ikimashita".
 */
const STEMS = new Map<string, string>();
for (const entry of WORDS) {
  const match = /^([\u4e00-\u9fff]+)([\u3041-\u3096]+)$/.exec(entry.word);
  if (!match) continue;
  const [, kanji, tail] = match;
  if (!entry.reading.endsWith(tail)) continue;
  const stemReading = entry.reading.slice(0, entry.reading.length - tail.length);
  if (!stemReading) continue;
  // The shortest reading wins, which is the plain stem rather than a polite form.
  const existing = STEMS.get(kanji);
  if (!existing || stemReading.length < existing.length) STEMS.set(kanji, stemReading);
}

/**
 * Kana that end an inflection because they are particles, not okurigana.
 *
 * 見に行く is 見 + に (particle) + 行く, not a verb 見に. Stopping here keeps the
 * ending from swallowing the rest of the sentence.
 */
const PARTICLE_STOP = new Set(["は", "が", "を", "に", "へ", "と", "で", "も", "の", "や"]);

/** How much of the kana after a stem belongs to the word. */
function okurigana(text: string, from: number): string {
  let taken = "";
  while (from + taken.length < text.length) {
    const char = text[from + taken.length];
    if (!isKana(char)) break;
    if (PARTICLE_STOP.has(char)) break;
    taken += char;
  }
  return taken;
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

/**
 * Particles worth breaking a kana run at.
 *
 * Only the three above are pronounced irregularly, but splitting all of these
 * off keeps the romaji readable: 天気がいいですね reads "tenki ga ii desu ne"
 * rather than running together as "tenki gaiidesune".
 */
const SPLIT_PARTICLES = new Set(["は", "が", "を", "に", "へ", "と", "で", "も", "の", "や", "か"]);

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
    // as 日 + 本 + 人. Multi-character entries go first, then inflected verbs,
    // then single characters — so 分かりません is not read as 分 ("fun") plus
    // かりません.
    const pushWord = (key: string) => {
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
    };

    let matched = false;
    for (const key of WORD_KEYS) {
      if (key.length < 2 || !text.startsWith(key, index)) continue;
      pushWord(key);
      matched = true;
      break;
    }
    if (matched) continue;

    // An inflected verb or adjective: known kanji stem plus its okurigana.
    if (isKanji(char)) {
      let run = "";
      while (index + run.length < text.length && isKanji(text[index + run.length])) {
        run += text[index + run.length];
      }
      const stemReading = STEMS.get(run);
      const ending = stemReading ? okurigana(text, index + run.length) : "";
      if (stemReading && ending) {
        const surface = run + ending;
        const reading = stemReading + ending;
        tokens.push({
          surface,
          reading,
          romaji: kanaToRomaji(reading),
          meaning: WORD_MAP.get(surface)?.meaning,
          source: "word",
          kanji: [...run].map((c) => KANJI_MAP.get(c)).filter((k): k is KanjiEntry => !!k),
        });
        index += surface.length;
        continue;
      }
    }

    for (const key of WORD_KEYS) {
      if (key.length !== 1 || !text.startsWith(key, index)) continue;
      pushWord(key);
      matched = true;
      break;
    }
    if (matched) continue;

    if (isKana(char)) {
      // A particle leading a kana run, straight after a noun, is split off so
      // it can be read correctly: 駅はどこ is "eki wa doko", not "eki hadoko".
      const previous = tokens[tokens.length - 1];
      if (
        SPLIT_PARTICLES.has(char) &&
        previous &&
        (previous.source === "word" || previous.source === "kanji")
      ) {
        tokens.push({
          surface: char,
          reading: char,
          romaji: PARTICLES[char] ?? kanaToRomaji(char),
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
