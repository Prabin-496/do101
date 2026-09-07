export type CaseStyle =
  | "sentence"
  | "lower"
  | "upper"
  | "title"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "alternating";

const MINOR_WORDS = new Set([
  "a","an","and","as","at","but","by","for","in","nor","of","on","or","per","so","the","to","up","via","vs","yet","from","into","over","with",
]);

function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-./]+/)
    .filter(Boolean);
}

export function convertCase(input: string, style: CaseStyle): string {
  if (!input) return "";
  switch (style) {
    case "lower":
      return input.toLowerCase();
    case "upper":
      return input.toUpperCase();
    case "sentence":
      return input
        .toLowerCase()
        .replace(/(^\s*\p{L})|([.!?]\s+\p{L})/gu, (m) => m.toUpperCase());
    case "title":
      return input
        .toLowerCase()
        .split(/(\s+)/)
        .map((chunk, i, arr) => {
          if (!chunk.trim()) return chunk;
          const isEdge = i === 0 || i === arr.length - 1;
          if (!isEdge && MINOR_WORDS.has(chunk)) return chunk;
          return chunk.charAt(0).toUpperCase() + chunk.slice(1);
        })
        .join("");
    case "camel": {
      const w = words(input);
      return w
        .map((x, i) =>
          i === 0 ? x.toLowerCase() : x.charAt(0).toUpperCase() + x.slice(1).toLowerCase(),
        )
        .join("");
    }
    case "pascal":
      return words(input)
        .map((x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())
        .join("");
    case "snake":
      return words(input).map((x) => x.toLowerCase()).join("_");
    case "kebab":
      return words(input).map((x) => x.toLowerCase()).join("-");
    case "constant":
      return words(input).map((x) => x.toUpperCase()).join("_");
    case "alternating":
      return [...input]
        .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
        .join("");
  }
}

export const CASE_STYLES: Array<{ id: CaseStyle; label: string; example: string }> = [
  { id: "sentence", label: "Sentence case", example: "The quick brown fox" },
  { id: "lower", label: "lowercase", example: "the quick brown fox" },
  { id: "upper", label: "UPPERCASE", example: "THE QUICK BROWN FOX" },
  { id: "title", label: "Title Case", example: "The Quick Brown Fox" },
  { id: "camel", label: "camelCase", example: "theQuickBrownFox" },
  { id: "pascal", label: "PascalCase", example: "TheQuickBrownFox" },
  { id: "snake", label: "snake_case", example: "the_quick_brown_fox" },
  { id: "kebab", label: "kebab-case", example: "the-quick-brown-fox" },
  { id: "constant", label: "CONSTANT_CASE", example: "THE_QUICK_BROWN_FOX" },
  { id: "alternating", label: "aLtErNaTiNg", example: "tHe qUiCk bRoWn fOx" },
];
