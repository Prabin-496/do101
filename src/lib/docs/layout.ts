/**
 * Minimal document model shared by the Word → PDF and HTML → PDF converters.
 * Kept free of browser APIs so it can be unit tested.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: Run[] }
  | { type: "paragraph"; runs: Run[] }
  | { type: "listItem"; ordered: boolean; index: number; depth: number; runs: Run[] }
  | { type: "image"; dataUrl: string }
  | { type: "table"; rows: string[][] }
  | { type: "rule" };

/**
 * pdf-lib's standard fonts are WinAnsi-encoded, so they cannot draw scripts
 * outside Latin-1. Rather than throwing mid-document, unsupported characters
 * are replaced and the caller is told how many were lost.
 */
const REPLACEMENTS: Record<string, string> = {
  "‘": "'", "’": "'", "‚": ",", "‛": "'",
  "“": '"', "”": '"', "„": '"',
  "–": "-", "—": "-", "−": "-",
  "…": "...", "•": "-", " ": " ",
  " ": " ", " ": " ", " ": " ",
  "‹": "<", "›": ">", "ˆ": "^", "˜": "~",
};

export interface SanitizeResult {
  text: string;
  dropped: number;
}

export function sanitizeWinAnsi(input: string): SanitizeResult {
  let dropped = 0;
  let out = "";

  for (const char of input) {
    const mapped = REPLACEMENTS[char];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = char.codePointAt(0) ?? 0;
    // Printable ASCII, plus the Latin-1 range WinAnsi covers.
    if (code === 9 || code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      out += char;
    } else {
      dropped++;
      out += "?";
    }
  }
  return { text: out, dropped };
}

/** Greedy word wrap against a measuring function, so it works for any font. */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);

      // A single word longer than the column has to be broken by character.
      if (measure(word) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          if (measure(chunk + char) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        line = chunk;
      } else {
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}
