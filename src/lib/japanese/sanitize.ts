/**
 * Removes annotation artifacts before any analysis happens.
 *
 * Text arriving at the reading tools has usually been through something else
 * first — a translation service, a CMS, a previous pass of this very tool, a
 * copy-paste out of a rendered page. It carries the marks of that: a reading
 * printed in brackets after the word it belongs to, a footnote number, a stray
 * markdown asterisk.
 *
 * None of it is Japanese, and analysing it is how the reader ends up looking at
 * "zaitaku kinmu（zaitakukinmu）" — the word read correctly, then its own
 * annotation romanised a second time and pasted alongside. The analyser must
 * never be handed its own output, and this is the gate that enforces it.
 *
 * The rule throughout is to remove only what cannot be Japanese prose. A
 * bracket after a kanji holding nothing but Latin letters is an annotation; a
 * bracket holding Japanese is part of the sentence and is left alone.
 */

import { hasJapanese } from "./kana";

export interface Sanitized {
  text: string;
  /** What was taken out, for the UI to report rather than hide. */
  removed: string[];
}

/** Both widths appear, often in the same document. */
const BRACKETS: Array<[open: string, close: string]> = [
  ["（", "）"],
  ["(", ")"],
  ["［", "］"],
  ["[", "]"],
];

/**
 * A bracketed run that is an annotation rather than part of the sentence.
 *
 * Latin-only contents directly after Japanese is a romaji gloss: 在宅勤務
 * （zaitakukinmu）. A bare number is a footnote marker: [1], ［12］. Anything
 * containing Japanese is real content and survives.
 */
function isAnnotation(inner: string, precededByJapanese: boolean): boolean {
  if (inner.length === 0 || inner.length > 40) return false;
  if (hasJapanese(inner)) return false;
  // [1], ［１］, [12] — a footnote marker anywhere, not only after Japanese.
  // Full-width digits are as common as ASCII ones in Japanese copy.
  if (/^[\s\u3000]*[0-9０-９]{1,3}[\s\u3000]*$/.test(inner)) return true;
  // ［注］, ［※］ — a footnote mark rather than a number.
  if (/^[\s\u3000]*[※＊*†‡][\s\u3000]*$/.test(inner)) return true;
  // A romaji gloss only counts as one when it is glossing something.
  return precededByJapanese && /^[A-Za-zāīūēōâîûêôĀĪŪĒŌ'’ \-.]+$/.test(inner);
}

export function sanitize(raw: string): Sanitized {
  const removed: string[] = [];
  let text = raw;

  for (const [open, close] of BRACKETS) {
    let out = "";
    let index = 0;

    while (index < text.length) {
      const char = text[index];
      if (char !== open) {
        out += char;
        index += 1;
        continue;
      }

      const end = text.indexOf(close, index + 1);
      if (end === -1) {
        out += char;
        index += 1;
        continue;
      }

      const inner = text.slice(index + 1, end);
      const previous = out.trimEnd().slice(-1);
      if (isAnnotation(inner, previous !== "" && hasJapanese(previous))) {
        removed.push(text.slice(index, end + 1));
        index = end + 1;
        continue;
      }

      out += char;
      index += 1;
    }
    text = out;
  }

  // Markdown emphasis that survived a copy-paste: **強調**, *text*, __x__.
  // Only removed where it touches Japanese, because 5 * 3 is arithmetic and
  // snake_case is a word.
  text = text.replace(/[*_]{1,3}/g, (match, offset: number) => {
    const before = text[offset - 1] ?? "";
    const after = text[offset + match.length] ?? "";
    if (hasJapanese(before) || hasJapanese(after)) {
      removed.push(match);
      return "";
    }
    return match;
  });

  return { text, removed };
}
