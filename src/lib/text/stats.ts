export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  graphemes: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  bytes: number;
  readingTimeMinutes: number;
  speakingTimeMinutes: number;
  averageWordLength: number;
  longestWord: string;
}

const WORDS_PER_MINUTE_READING = 225;
const WORDS_PER_MINUTE_SPEAKING = 130;

/** Counts visible characters, handling emoji and combining marks correctly. */
export function countGraphemes(text: string): number {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let n = 0;
    // Intl.Segmenter has no length; counting the iterator is the only way.
    const iterator = seg.segment(text)[Symbol.iterator]();
    while (!iterator.next().done) n++;
    return n;
  } catch {
    return [...text].length;
  }
}

export function splitWords(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

export function countSentences(text: string): number {
  const matches = text.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g);
  if (!matches) return 0;
  return matches.filter((s) => s.trim().length > 0).length;
}

export function analyzeText(text: string): TextStats {
  const words = splitWords(text);
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const paragraphs = text.trim()
    ? text.trim().split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
    : 0;
  const lines = text === "" ? 0 : text.split(/\n/).length;
  const totalWordLength = words.reduce((sum, w) => sum + w.length, 0);
  const longestWord = words.reduce((a, b) => (b.length > a.length ? b : a), "");

  return {
    characters: text.length,
    charactersNoSpaces,
    graphemes: countGraphemes(text),
    words: words.length,
    sentences: countSentences(text),
    paragraphs,
    lines,
    bytes: new TextEncoder().encode(text).length,
    readingTimeMinutes: words.length / WORDS_PER_MINUTE_READING,
    speakingTimeMinutes: words.length / WORDS_PER_MINUTE_SPEAKING,
    averageWordLength: words.length ? totalWordLength / words.length : 0,
    longestWord,
  };
}

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","if","of","to","in","on","at","for","with","is","are","was","were","be","been","it","this","that","as","by","from","has","have","had","not","you","your","we","our","they","their","i","he","she","his","her","its","do","does","did","so","than","then","there","here","what","which","who","will","can","just","also","about","into","over","after","all","any","more","most","other","some","such","no","nor","only","own","same","too","very",
]);

export interface KeywordCount {
  word: string;
  count: number;
  density: number;
}

export function keywordDensity(text: string, limit = 6): KeywordCount[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (!words.length) return [];
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, density: count / words.length }));
}
