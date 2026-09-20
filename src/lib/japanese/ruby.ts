/**
 * Inline ruby — 漢字（かな） — written directly in the text.
 *
 * Japanese aimed at a wide audience marks hard readings in parentheses right
 * after the word: 増（ふ）えている, 難（むずか）しさ. It is the author telling
 * you how to read their own text, and it is extremely common in company
 * announcements and graded news.
 *
 * Read naively it is a disaster. The kanji is looked up on its own and gets
 * whatever reading it has in isolation, and then the kana in the parentheses is
 * romanised a second time as if it were ordinary text — which is where
 * "ma（fu）eteiru" and "muzuka（muzuka）shi" come from. It also splits the word
 * apart, so the tokeniser can no longer see 増える at all and reads 増 as ぞう.
 *
 * So the annotation is taken out before anything else looks at the text, and
 * kept as a reading rather than thrown away: the author's reading is the most
 * authoritative one available, and it is used wherever the analyser has nothing
 * better to say.
 */

import { isKana, isKanji } from "./kana";

export interface Ruby {
  /** The text with every annotation removed. All offsets below index into this. */
  text: string;
  /** The author's readings, keyed by where the annotated word starts. */
  readings: Map<number, { surface: string; reading: string }>;
  /** True when the input actually carried annotations. */
  found: boolean;
}

/** Either width of bracket is used in practice, often both in one document. */
const OPEN = "（(";
const CLOSE = "）)";

/** 々 repeats the previous kanji and belongs to the word before the bracket. */
function isWordKanji(char: string): boolean {
  return isKanji(char) || char === "々" || char === "〆";
}

export function stripRuby(text: string): Ruby {
  const readings = new Map<number, { surface: string; reading: string }>();
  let out = "";
  let index = 0;
  let found = false;

  while (index < text.length) {
    const char = text[index];

    if (!OPEN.includes(char)) {
      out += char;
      index += 1;
      continue;
    }

    // A bracket only counts as ruby if it holds nothing but kana and sits
    // directly after a kanji. Everything else is ordinary punctuation and has
    // to survive untouched — 「（笑）」, "(see below)", a bracketed English aside.
    let end = index + 1;
    let inner = "";
    while (end < text.length && !CLOSE.includes(text[end])) {
      inner += text[end];
      end += 1;
    }

    const closed = end < text.length;
    const kanaOnly = inner.length > 0 && [...inner].every((c) => isKana(c));

    let base = "";
    for (let back = out.length - 1; back >= 0 && isWordKanji(out[back]); back -= 1) {
      base = out[back] + base;
    }

    if (!closed || !kanaOnly || !base) {
      out += char;
      index += 1;
      continue;
    }

    readings.set(out.length - base.length, { surface: base, reading: inner });
    found = true;
    // Drop the annotation itself, brackets included.
    index = end + 1;
  }

  return { text: out, readings, found };
}
