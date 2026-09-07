/**
 * Page-range parsing shared by every PDF tool that takes a "which pages"
 * input. Pure and unit tested — a silent off-by-one here would quietly
 * delete the wrong page from someone's document.
 */

export interface RangeResult {
  /** Zero-based page indices, de-duplicated and in the order the user wrote them. */
  indices: number[];
  error?: string;
}

/**
 * Accepts `1`, `1-3`, `2,5,7`, `4-` (to the end) and `-3` (from the start),
 * plus the keywords `all`, `odd`, `even` and `last`.
 */
export function parsePageRanges(input: string, pageCount: number): RangeResult {
  const text = input.trim().toLowerCase();
  if (!text) return { indices: [], error: "Type which pages you want, for example 1-3, 5." };
  if (pageCount <= 0) return { indices: [], error: "This document has no pages." };

  if (text === "all") return { indices: range(0, pageCount - 1) };
  if (text === "odd") return { indices: range(0, pageCount - 1).filter((i) => i % 2 === 0) };
  if (text === "even") return { indices: range(0, pageCount - 1).filter((i) => i % 2 === 1) };
  if (text === "last") return { indices: [pageCount - 1] };

  const seen = new Set<number>();
  const indices: number[] = [];

  for (const rawPart of text.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    const match = part.match(/^(\d*)\s*(?:-\s*(\d*))?$/);
    if (!match || (!match[1] && !match[2])) {
      return { indices: [], error: `"${part}" is not a page or a range. Try 1, 3-5 or 7-.` };
    }

    const hasDash = part.includes("-");
    const from = match[1] ? Number(match[1]) : 1;
    const to = hasDash ? (match[2] ? Number(match[2]) : pageCount) : from;

    if (from < 1 || to < 1) {
      return { indices: [], error: "Pages are numbered from 1." };
    }
    if (from > pageCount || to > pageCount) {
      return {
        indices: [],
        error: `This document only has ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
      };
    }
    if (from > to) {
      return { indices: [], error: `"${part}" runs backwards — write it as ${to}-${from}.` };
    }

    for (let page = from; page <= to; page++) {
      const index = page - 1;
      if (!seen.has(index)) {
        seen.add(index);
        indices.push(index);
      }
    }
  }

  if (!indices.length) return { indices: [], error: "That did not select any pages." };
  return { indices };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Inverts a selection — used by "delete these pages", which keeps the rest. */
export function invertSelection(indices: number[], pageCount: number): number[] {
  const drop = new Set(indices);
  return range(0, pageCount - 1).filter((i) => !drop.has(i));
}

/** Human summary of a selection, e.g. "1-3, 7, 9-12". */
export function describeSelection(indices: number[]): string {
  if (!indices.length) return "none";
  const sorted = [...indices].sort((a, b) => a - b).map((i) => i + 1);
  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current !== previous + 1) {
      parts.push(start === previous ? `${start}` : `${start}-${previous}`);
      start = current;
    }
    previous = current;
  }
  return parts.join(", ");
}
