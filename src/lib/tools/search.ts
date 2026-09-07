import { TOOLS } from "./tool-registry";
import type { Tool } from "./types";

export interface SearchHit {
  tool: Tool;
  score: number;
}

/**
 * Subsequence fuzzy match. Returns a score (higher is better) or -1.
 * Consecutive characters and word-start matches score more.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);
  const direct = t.indexOf(q);
  if (direct >= 0) return 600 - direct - (t.length - q.length) * 0.2;

  let score = 0;
  let ti = 0;
  let streak = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        break;
      }
      ti++;
    }
    if (found === -1) return -1;
    const isWordStart = found === 0 || t[found - 1] === " " || t[found - 1] === "-";
    streak = found === 0 || streak > 0 ? streak + 1 : 1;
    score += 10 + (isWordStart ? 8 : 0) + Math.min(streak, 5) * 2;
    ti = found + 1;
  }
  return score - t.length * 0.1;
}

/** Ranked tool search across names, aliases, keywords and descriptions. */
export function searchTools(query: string, limit = 8): SearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const tool of TOOLS) {
    const candidates: Array<[string, number]> = [
      [tool.name, 1],
      ...tool.aliases.map((a) => [a, 0.95] as [string, number]),
      ...tool.keywords.map((k) => [k, 0.9] as [string, number]),
      [tool.short, 0.5],
      [tool.category, 0.4],
    ];
    let best = -1;
    for (const [text, weight] of candidates) {
      const s = fuzzyScore(q, text) * weight;
      if (s > best) best = s;
    }
    if (best > 0) hits.push({ tool, score: best });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
