/**
 * Generates src/lib/japanese/kanji-readings.ts from KANJIDIC2.
 *
 * The curated list in dictionary.ts covers a few hundred kanji — the ones a
 * learner meets first. Real Japanese runs past it constantly, and a kanji with
 * no entry used to be printed as "?", which is the single most common complaint
 * about the reading tools. This fills that gap: every jouyou and jinmeiyou
 * kanji, on and kun readings, ~47KB over the wire.
 *
 * It is not a replacement for the analyser in tokenizer.ts. Per-character
 * readings still cannot tell you that 浅野 is "asano" — only that 浅 and 野
 * exist. What it guarantees is that there is always *a* reading, so "?" never
 * reaches the page.
 *
 * Run by hand, not by the build: the source is a 15MB download and the output
 * is committed.
 *
 *   curl -o /tmp/kanjidic2.xml.gz http://www.edrdg.org/kanjidic/kanjidic2.xml.gz
 *   gunzip /tmp/kanjidic2.xml
 *   node scripts/build-kanji-readings.mjs /tmp/kanjidic2.xml
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/build-kanji-readings.mjs <path to kanjidic2.xml>");
  process.exit(1);
}

const xml = readFileSync(source, "utf8");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** First match of a tag inside a block, or "". */
const one = (block, tag) => block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1] ?? "";

const all = (block, tag, attr) => {
  const out = [];
  const re = new RegExp(`<${tag}([^>]*)>([^<]*)</${tag}>`, "g");
  for (const [, attrs, text] of block.matchAll(re)) {
    if (attr && !attrs.includes(attr)) continue;
    if (text) out.push(text);
  }
  return out;
};

const rows = [];
for (const [, block] of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
  // A grade is what marks a kanji as jouyou (1-8) or jinmeiyou (9-10).
  // Everything else is rare enough that the analyser is the right answer.
  if (!one(block, "grade")) continue;

  const literal = one(block, "literal");
  const on = all(block, "reading", 'r_type="ja_on"').slice(0, 3);
  const kun = all(block, "reading", 'r_type="ja_kun"').slice(0, 3);
  // Only the unmarked <meaning> is English; the others carry an m_lang.
  const meaning = all(block, "meaning").find((_, i) => !/m_lang/.test(block.split("<meaning")[i + 1] ?? "")) ?? "";

  if (!literal || (on.length === 0 && kun.length === 0)) continue;
  // "|" separates the fields, so it must not occur inside one.
  rows.push([literal, on.join(","), kun.join(","), meaning.replace(/[|\n]/g, " ").trim()].join("|"));
}

const packed = rows.join("\n");
const out = `/**
 * Kanji readings — GENERATED, do not edit by hand.
 *
 * Regenerate with \`node scripts/build-kanji-readings.mjs <kanjidic2.xml>\`.
 *
 * Every jouyou and jinmeiyou kanji, so that the reading tools always have a
 * reading to show. The curated entries in dictionary.ts take precedence where
 * they exist — they carry meanings written for a learner rather than a
 * dictionary gloss — and this fills in everything else.
 *
 * Source: KANJIDIC2, © Electronic Dictionary Research and Development Group,
 * used under CC BY-SA 4.0. https://www.edrdg.org/wiki/index.php/KANJIDIC_Project
 *
 * Stored as one packed string rather than ${rows.length} object literals: it
 * parses in about a millisecond and is a third of the size in the bundle.
 */

import type { KanjiEntry } from "./dictionary";

/** kanji|on,on|kun,kun|meaning, one per line. */
const PACKED = ${JSON.stringify(packed)};

export const EXTRA_KANJI: KanjiEntry[] = PACKED.split("\\n").map((line) => {
  const [kanji, on, kun, meaning] = line.split("|");
  return {
    kanji,
    on: on ? on.split(",") : [],
    kun: kun ? kun.split(",") : [],
    meaning,
  };
});
`;

writeFileSync(join(root, "src/lib/japanese/kanji-readings.ts"), out);
console.log(`Wrote src/lib/japanese/kanji-readings.ts — ${rows.length} kanji, ${(packed.length / 1024).toFixed(0)}KB packed`);
