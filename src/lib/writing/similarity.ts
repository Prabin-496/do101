/**
 * Similarity between two documents the reader supplies.
 *
 * This is n-gram containment, the standard measure behind text-reuse
 * detection. It compares the two texts in front of it and nothing else — it
 * does not search the web, and no honest browser tool could, because that
 * needs a crawled index. What it does do is show exactly which passages
 * overlap and where, which is the part a student actually needs when checking
 * a draft against the sources they quoted.
 */

export interface Token {
  word: string;
  /** Offset of this word in the original text. */
  start: number;
  end: number;
}

/** Words too common to carry evidence of reuse on their own. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "has", "have", "he", "her", "his", "in", "is", "it", "its", "of",
  "on", "or", "that", "the", "their", "they", "this", "to", "was", "were",
  "which", "will", "with", "would", "you", "your",
]);

export function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    tokens.push({
      word: match[0].toLowerCase().replace(/['’]/g, ""),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

/** Consecutive word groups, keyed by their joined text. */
function shingles(tokens: Token[], size: number): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = 0; i + size <= tokens.length; i += 1) {
    const key = tokens.slice(i, i + size).map((t) => t.word).join(" ");
    const at = map.get(key);
    if (at) at.push(i);
    else map.set(key, [i]);
  }
  return map;
}

export interface MatchedPassage {
  text: string;
  /** Character offsets in the first document. */
  aStart: number;
  aEnd: number;
  /** Character offsets in the second document. */
  bStart: number;
  bEnd: number;
  words: number;
}

export interface SimilarityReport {
  /** Share of document A that also appears in B, 0–100. */
  containment: number;
  /** Symmetric overlap, 0–100. */
  jaccard: number;
  passages: MatchedPassage[];
  /** Words in A that fall inside a matched passage. */
  matchedWords: number;
  aWords: number;
  bWords: number;
  shingleSize: number;
  verdict: string;
}

export interface SimilarityOptions {
  /** Words per shingle. Smaller catches more, with more coincidence. */
  shingleSize?: number;
  /** Shortest run of words reported as a passage. */
  minPassageWords?: number;
  /** Ignores stopword-only overlaps, which are always coincidental. */
  ignoreCommonPhrases?: boolean;
}

export function compare(
  a: string,
  b: string,
  options: SimilarityOptions = {},
): SimilarityReport {
  const size = Math.max(3, Math.min(12, options.shingleSize ?? 5));
  const minWords = options.minPassageWords ?? size;
  const ignoreCommon = options.ignoreCommonPhrases ?? true;

  const tokensA = tokenise(a);
  const tokensB = tokenise(b);

  if (tokensA.length < size || tokensB.length < size) {
    return {
      containment: 0, jaccard: 0, passages: [], matchedWords: 0,
      aWords: tokensA.length, bWords: tokensB.length, shingleSize: size,
      verdict: `Both texts need at least ${size} words to compare.`,
    };
  }

  const shinglesA = shingles(tokensA, size);
  const shinglesB = shingles(tokensB, size);

  const isCommon = (key: string) =>
    ignoreCommon && key.split(" ").every((word) => STOPWORDS.has(word));

  let shared = 0;
  const sharedKeys = new Set<string>();
  for (const key of shinglesA.keys()) {
    if (isCommon(key)) continue;
    if (shinglesB.has(key)) {
      shared += 1;
      sharedKeys.add(key);
    }
  }

  const countableA = [...shinglesA.keys()].filter((k) => !isCommon(k)).length;
  const countableB = [...shinglesB.keys()].filter((k) => !isCommon(k)).length;
  const union = countableA + countableB - shared;

  // Walk A left to right, merging runs of matching shingles into passages.
  const passages: MatchedPassage[] = [];
  const covered = new Array<boolean>(tokensA.length).fill(false);

  let i = 0;
  while (i + size <= tokensA.length) {
    const key = tokensA.slice(i, i + size).map((t) => t.word).join(" ");
    const startsInB = sharedKeys.has(key) ? shinglesB.get(key) : undefined;
    if (!startsInB) {
      i += 1;
      continue;
    }

    // Extend the run one word at a time while both documents keep agreeing.
    const bStartIndex = startsInB[0];
    let length = size;
    while (
      i + length < tokensA.length &&
      bStartIndex + length < tokensB.length &&
      tokensA[i + length].word === tokensB[bStartIndex + length].word
    ) {
      length += 1;
    }

    if (length >= minWords) {
      for (let n = i; n < i + length; n += 1) covered[n] = true;
      passages.push({
        text: a.slice(tokensA[i].start, tokensA[i + length - 1].end),
        aStart: tokensA[i].start,
        aEnd: tokensA[i + length - 1].end,
        bStart: tokensB[bStartIndex].start,
        bEnd: tokensB[bStartIndex + length - 1].end,
        words: length,
      });
    }
    i += length;
  }

  const matchedWords = covered.filter(Boolean).length;
  const containment = countableA === 0 ? 0 : (shared / countableA) * 100;
  const jaccard = union === 0 ? 0 : (shared / union) * 100;

  return {
    containment: Math.round(containment * 10) / 10,
    jaccard: Math.round(jaccard * 10) / 10,
    passages: passages.sort((x, y) => y.words - x.words),
    matchedWords,
    aWords: tokensA.length,
    bWords: tokensB.length,
    shingleSize: size,
    verdict: describeOverlap(containment, passages),
  };
}

function describeOverlap(containment: number, passages: MatchedPassage[]): string {
  const longest = passages.reduce((max, p) => Math.max(max, p.words), 0);
  if (containment < 1 && longest === 0) {
    return "No meaningful overlap. The two texts share no run of matching wording.";
  }
  if (containment < 5) {
    return `Minimal overlap. The longest shared run is ${longest} words, which is the sort of coincidence common phrasing produces.`;
  }
  if (containment < 15) {
    return `Some overlap. Check that the shared passages are quoted and cited — the longest run is ${longest} words.`;
  }
  if (containment < 40) {
    return `Substantial overlap. ${Math.round(containment)}% of the first text's phrasing appears in the second, with runs up to ${longest} words. Quote and cite it, or rewrite it in your own words.`;
  }
  return `Very high overlap. ${Math.round(containment)}% of the first text matches the second, with runs up to ${longest} words. This reads as copied rather than paraphrased.`;
}

/** Similarity between many texts, for comparing a set of drafts or sources. */
export interface PairScore {
  aIndex: number;
  bIndex: number;
  containment: number;
  longestRun: number;
}

export function compareAll(texts: string[], options: SimilarityOptions = {}): PairScore[] {
  const scores: PairScore[] = [];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const report = compare(texts[i], texts[j], options);
      scores.push({
        aIndex: i,
        bIndex: j,
        containment: report.containment,
        longestRun: report.passages[0]?.words ?? 0,
      });
    }
  }
  return scores.sort((a, b) => b.containment - a.containment);
}
