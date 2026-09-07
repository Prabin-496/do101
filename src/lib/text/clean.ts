export interface CleanOptions {
  collapseSpaces: boolean;
  trimLines: boolean;
  removeBlankLines: boolean;
  joinWrappedLines: boolean;
  straightenQuotes: boolean;
  stripInvisible: boolean;
  removeExtraPunctuation: boolean;
  lowercase: boolean;
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  collapseSpaces: true,
  trimLines: true,
  removeBlankLines: false,
  joinWrappedLines: false,
  straightenQuotes: false,
  stripInvisible: true,
  removeExtraPunctuation: false,
  lowercase: false,
};

export function cleanText(input: string, options: CleanOptions): string {
  let out = input;

  if (options.stripInvisible) {
    // zero-width space/joiner/non-joiner, BOM, soft hyphen
    out = out.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "");
  }
  if (options.straightenQuotes) {
    out = out
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...");
  }
  if (options.joinWrappedLines) {
    // Join a line into the previous one unless the previous line ends a sentence
    // or the line is blank (paragraph break).
    out = out.replace(/([^\n.!?:;])\n(?!\n)[ \t]*(?=\S)/g, "$1 ");
  }
  if (options.collapseSpaces) {
    out = out.replace(/[ \t]{2,}/g, " ");
  }
  if (options.removeExtraPunctuation) {
    out = out
      .replace(/([!?.,;:])\1{1,}/g, "$1")
      .replace(/\s+([,.!?;:])/g, "$1");
  }
  if (options.trimLines) {
    out = out
      .split("\n")
      .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, ""))
      .join("\n");
  }
  if (options.removeBlankLines) {
    out = out
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .join("\n");
  } else {
    out = out.replace(/\n{3,}/g, "\n\n");
  }
  if (options.lowercase) out = out.toLowerCase();

  return out;
}
