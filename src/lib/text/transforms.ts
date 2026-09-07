/**
 * Pure text transformations shared by the config-driven text tools.
 * Every one is unit tested, because a silent off-by-one in "remove duplicate
 * lines" is the kind of bug nobody notices until their data is wrong.
 */

export function removeDuplicateLines(
  input: string,
  { caseSensitive = true, trim = true, keepOrder = true } = {},
): string {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of input.split("\n")) {
    const candidate = trim ? line.trim() : line;
    const key = caseSensitive ? candidate : candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keepOrder ? line : candidate);
  }
  return out.join("\n");
}

export function removeEmptyLines(input: string, { trimFirst = true } = {}): string {
  return input
    .split("\n")
    .filter((line) => (trimFirst ? line.trim() : line).length > 0)
    .join("\n");
}

export function removeExtraSpaces(
  input: string,
  { collapseInline = true, trimLines = true, collapseBlankLines = true } = {},
): string {
  let out = input;
  if (collapseInline) out = out.replace(/[ \t]{2,}/g, " ");
  if (trimLines) out = out.split("\n").map((l) => l.trim()).join("\n");
  if (collapseBlankLines) out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

export type SortMode = "alpha" | "alpha-desc" | "length" | "length-desc" | "numeric" | "numeric-desc" | "random" | "reverse";

export function sortLines(
  input: string,
  { mode = "alpha", caseSensitive = false, removeDuplicates = false }: { mode?: SortMode; caseSensitive?: boolean; removeDuplicates?: boolean } = {},
): string {
  let lines = input.split("\n");
  if (removeDuplicates) {
    const seen = new Set<string>();
    lines = lines.filter((l) => {
      const key = caseSensitive ? l : l.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const collator = new Intl.Collator(undefined, {
    sensitivity: caseSensitive ? "variant" : "base",
    numeric: true,
  });

  switch (mode) {
    case "alpha":
      lines.sort((a, b) => collator.compare(a, b));
      break;
    case "alpha-desc":
      lines.sort((a, b) => collator.compare(b, a));
      break;
    case "length":
      lines.sort((a, b) => a.length - b.length);
      break;
    case "length-desc":
      lines.sort((a, b) => b.length - a.length);
      break;
    case "numeric":
      lines.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
      break;
    case "numeric-desc":
      lines.sort((a, b) => (parseFloat(b) || 0) - (parseFloat(a) || 0));
      break;
    case "reverse":
      lines.reverse();
      break;
    case "random":
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      break;
  }
  return lines.join("\n");
}

export type ReverseMode = "characters" | "words" | "lines" | "each-word";

export function reverseText(input: string, mode: ReverseMode = "characters"): string {
  switch (mode) {
    case "characters":
      return [...input].reverse().join("");
    case "words":
      return input.split(/(\s+)/).reverse().join("");
    case "lines":
      return input.split("\n").reverse().join("\n");
    case "each-word":
      return input.replace(/\S+/g, (word) => [...word].reverse().join(""));
  }
}

export interface ReplaceResult {
  output: string;
  count: number;
  error?: string;
}

export function findAndReplace(
  input: string,
  {
    find,
    replace,
    useRegex = false,
    caseSensitive = true,
    wholeWord = false,
  }: {
    find: string;
    replace: string;
    useRegex?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
  },
): ReplaceResult {
  if (!find) return { output: input, count: 0 };

  let pattern = useRegex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (wholeWord) pattern = `\\b(?:${pattern})\\b`;

  let re: RegExp;
  try {
    re = new RegExp(pattern, caseSensitive ? "g" : "gi");
  } catch (err) {
    return {
      output: input,
      count: 0,
      error: err instanceof Error ? err.message : "That pattern is not valid.",
    };
  }

  let count = 0;
  const output = input.replace(re, () => {
    count++;
    return replace;
  });
  return { output, count };
}

/* ------------------------------ HTML entities ------------------------------ */

const NAMED: Array<[string, string]> = [
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
];

export function encodeHtml(input: string, { allCharacters = false } = {}): string {
  let out = input;
  for (const [char, entity] of NAMED) out = out.split(char).join(entity);
  if (allCharacters) {
    out = out.replace(/[\u00A0-\u9999]/g, (c) => `&#${c.charCodeAt(0)};`);
  }
  return out;
}

const DECODE_MAP: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", eacute: "é", euro: "€", pound: "£",
};

export function decodeHtml(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return DECODE_MAP[entity.toLowerCase()] ?? match;
  });
}

/* ------------------------------- extraction ------------------------------- */

export type ExtractKind = "emails" | "urls" | "numbers" | "hashtags" | "mentions" | "ips" | "phones";

const PATTERNS: Record<ExtractKind, RegExp> = {
  emails: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  urls: /https?:\/\/[^\s<>"')]+/g,
  numbers: /-?\d+(?:[.,]\d+)?/g,
  hashtags: /#[\p{L}\p{N}_]+/gu,
  mentions: /@[\p{L}\p{N}_.]+/gu,
  ips: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  phones: /\+?\d[\d\s().-]{6,}\d/g,
};

export function extractFromText(
  input: string,
  kind: ExtractKind,
  { unique = true, sort = false } = {},
): string[] {
  let matches: string[] = [...(input.match(PATTERNS[kind]) ?? [])].map((m) => m.trim());
  if (unique) matches = [...new Set(matches)];
  if (sort) matches.sort((a, b) => a.localeCompare(b));
  return matches;
}

/* --------------------------------- slugs --------------------------------- */

export function slugify(
  input: string,
  { separator = "-", lowercase = true, maxLength = 0 }: { separator?: string; lowercase?: boolean; maxLength?: number } = {},
): string {
  let slug = input
    .normalize("NFKD")
    // Strip combining accents so "café" becomes "cafe" rather than "caf".
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, separator)
    .replace(new RegExp(`\\${separator}{2,}`, "g"), separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");

  if (lowercase) slug = slug.toLowerCase();
  if (maxLength > 0 && slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(new RegExp(`\\${separator}+$`), "");
  }
  return slug;
}
