/**
 * Full-text search that runs in the page.
 *
 * BM25 — the ranking method behind most search engines before neural ranking —
 * over passages of a few sentences each, so a hit points at the paragraph that
 * matched rather than a whole 40-page file. English words are reduced to a
 * rough stem so "invoicing" finds "invoice"; Japanese and other scripts without
 * spaces are indexed as overlapping character pairs, which is how search
 * engines handle them without a dictionary.
 *
 * It finds and ranks; it does not write answers. The "answer" shown is the
 * best-matching sentences, quoted, with a link to where they came from — which
 * is honest about what a search can know.
 */

export interface SearchDoc {
  id: string;
  title: string;
  text: string;
}

export interface Passage {
  docId: string;
  title: string;
  text: string;
  /** Position of the passage within its document, for "passage 3 of 12". */
  index: number;
}

export interface Hit {
  passage: Passage;
  score: number;
  /** The query terms found in this passage, for highlighting. */
  matched: string[];
}

const STOPWORDS = new Set(
  "a an and are as at be but by can do does for from has have how i if in into is it its me my of on or our so than that the their them then there these they this to was we were what when where which who why will with you your".split(" "),
);

const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/** A light suffix-stripper: good enough to join "invoices" and "invoicing". */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  for (const [suffix, replace] of [
    ["ational", "ate"], ["ization", "ize"], ["fulness", "ful"], ["ousness", "ous"], ["iveness", "ive"],
    ["ations", "ate"], ["ation", "ate"], ["ments", ""], ["ment", ""], ["ingly", ""], ["edly", ""],
    ["ies", "y"], ["ied", "y"], ["ing", ""], ["ers", ""], ["er", ""], ["ed", ""], ["es", ""], ["s", ""],
  ] as const) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, -suffix.length) + replace;
      break;
    }
  }
  // "invoic" and "invoice" are the same word after stemming either one.
  return w.replace(/e$/, "");
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  for (const match of lower.matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = match[0];
    if (CJK.test(word)) {
      const chars = [...word];
      if (chars.length === 1) out.push(word);
      for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
      continue;
    }
    if (STOPWORDS.has(word)) continue;
    out.push(stem(word));
  }
  return out;
}

/** Documents into passages of roughly `size` characters, on paragraph and sentence boundaries. */
export function chunk(doc: SearchDoc, size = 600): Passage[] {
  const paragraphs = doc.text.split(/\n\s*\n|\n(?=[-*•\d])/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const passages: Passage[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) passages.push({ docId: doc.id, title: doc.title, text: current.trim(), index: passages.length });
    current = "";
  };
  for (const para of paragraphs) {
    if (para.length > size * 1.5) {
      flush();
      let buffer = "";
      for (const sentence of para.split(/(?<=[.!?。！？])\s*/)) {
        if ((buffer + sentence).length > size && buffer) {
          passages.push({ docId: doc.id, title: doc.title, text: buffer.trim(), index: passages.length });
          buffer = "";
        }
        buffer += `${sentence} `;
      }
      if (buffer.trim()) passages.push({ docId: doc.id, title: doc.title, text: buffer.trim(), index: passages.length });
      continue;
    }
    if ((current + para).length > size && current) flush();
    current += `${para}\n`;
  }
  flush();
  return passages;
}

export interface ParsedQuery {
  terms: string[];
  phrases: string[];
  excluded: string[];
}

/** Supports "exact phrases" and -excluded words. */
export function parseQuery(query: string): ParsedQuery {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  const rest = query.replace(/"[^"]+"/g, " ");
  const excluded = [...rest.matchAll(/(?:^|\s)-([\p{L}\p{N}]+)/gu)].map((m) => stem(m[1].toLowerCase()));
  const terms = tokenize(rest.replace(/(?:^|\s)-[\p{L}\p{N}]+/gu, " ").concat(" ", phrases.join(" ")));
  return { terms: [...new Set(terms)], phrases, excluded };
}

export class SearchIndex {
  private passages: Passage[];
  private tokens: string[][];
  private df = new Map<string, number>();
  private avgLength: number;

  constructor(passages: Passage[]) {
    this.passages = passages;
    this.tokens = passages.map((p) => tokenize(`${p.title} ${p.text}`));
    for (const list of this.tokens) for (const t of new Set(list)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLength = this.tokens.reduce((a, t) => a + t.length, 0) / Math.max(1, this.tokens.length);
  }

  get size(): number {
    return this.passages.length;
  }

  /** Whether any passage contains this (already tokenised) term. */
  knows(term: string): boolean {
    return this.df.has(term);
  }

  search(query: string, limit = 20): Hit[] {
    const { terms, phrases, excluded } = parseQuery(query);
    if (terms.length === 0) return [];
    const k1 = 1.4;
    const b = 0.75;
    const n = this.passages.length;
    const hits: Hit[] = [];

    this.passages.forEach((passage, i) => {
      const tokens = this.tokens[i];
      if (excluded.some((e) => tokens.includes(e))) return;
      const lowerText = passage.text.toLowerCase();
      if (phrases.some((p) => !lowerText.includes(p))) return;
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      const matched: string[] = [];
      for (const term of terms) {
        const f = tf.get(term) ?? 0;
        if (!f) continue;
        matched.push(term);
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * tokens.length) / this.avgLength));
      }
      if (score > 0) {
        // Matching more of the question beats matching one word many times.
        score *= 0.5 + matched.length / terms.length;
        hits.push({ passage, score, matched });
      }
    });

    return hits.sort((a, b2) => b2.score - a.score).slice(0, limit);
  }
}

/** The sentences in a passage that match the most query terms, in order. */
export function bestSentences(text: string, terms: string[], count = 2): string[] {
  const sentences = text.split(/(?<=[.!?。！？])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 12);
  const scored = sentences.map((s, i) => {
    const tokens = new Set(tokenize(s));
    return { s, i, score: terms.filter((t) => tokens.has(t)).length };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

/** Splits text into [plain, matched, plain, …] for highlighting stemmed matches. */
export function highlight(text: string, terms: string[]): { text: string; hit: boolean }[] {
  if (terms.length === 0) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = match[0].toLowerCase();
    const hit = CJK.test(word)
      ? terms.some((t) => word.includes(t))
      : terms.includes(stem(word));
    if (!hit) continue;
    if (match.index! > last) parts.push({ text: text.slice(last, match.index), hit: false });
    parts.push({ text: match[0], hit: true });
    last = match.index! + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}
