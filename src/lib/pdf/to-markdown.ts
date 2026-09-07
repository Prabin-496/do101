import type { ExtractedPage } from "./render";

/**
 * Turns extracted PDF text into Markdown.
 *
 * Headings are inferred from shape rather than font size, because the text
 * layer does not reliably expose styling: short lines with no terminal
 * punctuation, numbered section headers, and ALL-CAPS lines become headings.
 * Bulleted and numbered lines are normalised. It is a good first draft, not a
 * perfect structural conversion, and the page says so.
 */

export interface MarkdownOptions {
  pageBreaks: boolean;
  detectHeadings: boolean;
  detectLists: boolean;
}

const BULLET = /^[•·▪◦‣∙*-]\s+/;
const NUMBERED = /^(\d{1,3})[.)]\s+/;
const SECTION = /^(\d{1,2}(?:\.\d{1,2})*)\s+\S/;

function looksLikeHeading(line: string): 1 | 2 | 3 | null {
  const text = line.trim();
  if (!text || text.length > 90) return null;
  if (/[.!?,;:]$/.test(text)) return null;

  const section = text.match(SECTION);
  if (section) {
    const depth = section[1].split(".").length;
    return depth === 1 ? 2 : 3;
  }

  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) {
    return text.length < 40 ? 1 : 2;
  }

  // Title Case and short: likely a heading.
  const words = text.split(/\s+/);
  if (words.length <= 8 && words.filter((w) => /^[A-Z]/.test(w)).length >= words.length - 1) {
    return 3;
  }
  return null;
}

function escapeMarkdown(text: string): string {
  // Only escape characters that would otherwise create unintended structure.
  return text.replace(/^(#{1,6}\s)/, "\\$1").replace(/^(>\s)/, "\\$1");
}

export function pagesToMarkdown(
  pages: ExtractedPage[],
  { pageBreaks, detectHeadings, detectLists }: MarkdownOptions,
): { markdown: string; headings: number; listItems: number } {
  const out: string[] = [];
  let headings = 0;
  let listItems = 0;

  pages.forEach((page, pageIndex) => {
    if (pageBreaks && pageIndex > 0) out.push("\n---\n");

    const blocks = page.text.split(/\n{2,}/);

    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      // A block of short lines that all start with a marker is a list.
      const bulletLines = lines.filter((l) => BULLET.test(l) || NUMBERED.test(l));
      if (detectLists && bulletLines.length && bulletLines.length >= lines.length - 1) {
        for (const line of lines) {
          const numbered = line.match(NUMBERED);
          if (numbered) {
            out.push(`${numbered[1]}. ${escapeMarkdown(line.replace(NUMBERED, ""))}`);
          } else {
            out.push(`- ${escapeMarkdown(line.replace(BULLET, ""))}`);
          }
          listItems++;
        }
        out.push("");
        continue;
      }

      if (detectHeadings && lines.length === 1) {
        const level = looksLikeHeading(lines[0]);
        if (level) {
          out.push(`${"#".repeat(level)} ${lines[0].replace(SECTION, "$1 ").trim()}`);
          out.push("");
          headings++;
          continue;
        }
      }

      // Otherwise it is a paragraph: soft-wrapped lines rejoin into one.
      out.push(escapeMarkdown(lines.join(" ")));
      out.push("");
    }
  });

  return {
    markdown: out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n",
    headings,
    listItems,
  };
}
