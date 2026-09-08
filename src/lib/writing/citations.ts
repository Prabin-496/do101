/**
 * Citation formatting for the six styles students are most often asked for.
 *
 * Each formatter follows the published rules for that style rather than a
 * shared approximation, because the differences (initials, italics, ordering,
 * punctuation) are exactly what marks get taken off for. Output is a list of
 * segments so italics survive a paste into a word processor.
 */

export type CitationStyle = "apa" | "mla" | "harvard" | "chicago" | "ieee" | "vancouver";

export type SourceType =
  | "book" | "chapter" | "journal" | "website" | "newspaper"
  | "thesis" | "report" | "video" | "conference";

export interface Author {
  family: string;
  given: string;
  /** Organisations are cited whole, without initials. */
  organisation?: boolean;
}

export interface Source {
  type: SourceType;
  authors: Author[];
  title: string;
  /** Journal, book, website or newspaper the work sits in. */
  container?: string;
  publisher?: string;
  year?: string;
  month?: string;
  day?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  edition?: string;
  editors?: Author[];
  url?: string;
  doi?: string;
  accessed?: string;
  city?: string;
  institution?: string;
}

export interface Segment {
  text: string;
  italic?: boolean;
}

export interface Citation {
  /** The reference-list entry. */
  reference: Segment[];
  /** The in-text or footnote form. */
  inText: string;
  /** Anything the style needs that the form did not collect. */
  warnings: string[];
}

export const STYLE_LABELS: Record<CitationStyle, string> = {
  apa: "APA 7th edition",
  mla: "MLA 9th edition",
  harvard: "Harvard",
  chicago: "Chicago 17th (author–date)",
  ieee: "IEEE",
  vancouver: "Vancouver",
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  book: "Book",
  chapter: "Book chapter",
  journal: "Journal article",
  website: "Web page",
  newspaper: "Newspaper article",
  thesis: "Thesis or dissertation",
  report: "Report",
  video: "Video",
  conference: "Conference paper",
};

// ---- helpers ---------------------------------------------------------------

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function initials(given: string, { periods = true, spaced = true } = {}): string {
  const parts = given.split(/[\s.-]+/).filter(Boolean);
  const letters = parts.map((p) => p[0].toUpperCase() + (periods ? "." : ""));
  return letters.join(spaced ? " " : "");
}

function clean(text: string | undefined): string {
  return (text ?? "").trim().replace(/\s+/g, " ");
}

/** Drops a trailing full stop so we never produce "..". */
function join(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([.,;:])\1+/g, "$1")
    .replace(/\.\s*\./g, ".")
    .trim();
}

function sentenceCase(title: string): string {
  const trimmed = clean(title);
  if (!trimmed) return "";
  // Only lower a word if it is not already an acronym or proper-looking.
  const words = trimmed.split(" ");
  return words
    .map((word, index) => {
      if (index === 0) return word[0].toUpperCase() + word.slice(1);
      if (word === word.toUpperCase() && word.length > 1) return word;
      if (/^[A-Z][a-z]/.test(word) && index > 0) return word; // keep proper nouns
      return word;
    })
    .join(" ");
}

function titleCase(title: string): string {
  const minor = new Set([
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "if", "in",
    "into", "nor", "of", "off", "on", "onto", "or", "over", "per", "so", "the",
    "to", "up", "via", "with", "yet",
  ]);
  const words = clean(title).split(" ");
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index !== 0 && index !== words.length - 1 && minor.has(lower)) return lower;
      if (word === word.toUpperCase() && word.length > 1) return word;
      return word[0]?.toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** "12 March 2024" style, using whatever parts were supplied. */
function fullDate(source: Source, order: "dmy" | "mdy" = "dmy"): string {
  const month = source.month ? MONTHS[Number(source.month) - 1] ?? source.month : "";
  const day = clean(source.day);
  const year = clean(source.year);
  if (!month) return year;
  if (!day) return join(month, year);
  return order === "dmy" ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`;
}

function nameList(
  authors: Author[],
  format: (author: Author, index: number) => string,
  {
    separator = ", ",
    finalSeparator = ", & ",
    max = Infinity,
    etAlAfter,
    etAl = "et al.",
  }: {
    separator?: string;
    finalSeparator?: string;
    max?: number;
    etAlAfter?: number;
    etAl?: string;
  } = {},
): string {
  const list = authors.filter((a) => clean(a.family) || clean(a.given));
  if (list.length === 0) return "";
  if (etAlAfter !== undefined && list.length > etAlAfter) {
    const shown = list.slice(0, etAlAfter).map(format);
    return `${shown.join(separator)}${shown.length ? ", " : ""}${etAl}`;
  }
  const shown = list.slice(0, max).map(format);
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(separator)}${finalSeparator}${shown[shown.length - 1]}`;
}

/** Author surname(s) used in the in-text citation. */
function inTextNames(authors: Author[], conjunction: string, etAlAfter = 3): string {
  const list = authors.filter((a) => clean(a.family) || clean(a.given));
  if (list.length === 0) return "";
  const surname = (a: Author) => (a.organisation ? clean(a.given || a.family) : clean(a.family));
  if (list.length === 1) return surname(list[0]);
  if (list.length === 2) return `${surname(list[0])} ${conjunction} ${surname(list[1])}`;
  if (list.length >= etAlAfter) return `${surname(list[0])} et al.`;
  return `${surname(list[0])}, ${surname(list[1])} ${conjunction} ${surname(list[2])}`;
}

function locator(source: Source): string {
  const url = clean(source.url);
  const doi = clean(source.doi);
  if (doi) return doi.startsWith("http") ? doi : `https://doi.org/${doi.replace(/^doi:\s*/i, "")}`;
  return url;
}

function warn(source: Source, style: CitationStyle): string[] {
  const warnings: string[] = [];
  if (!source.authors.some((a) => clean(a.family) || clean(a.given))) {
    warnings.push("No author given — the title moves to the front of the entry.");
  }
  if (!clean(source.year)) warnings.push("No year given — shown as \"n.d.\" (no date).");
  if (source.type === "journal" && !clean(source.volume)) {
    warnings.push("Journal articles normally need a volume number.");
  }
  if (source.type === "website" && style === "mla" && !clean(source.accessed)) {
    warnings.push("MLA asks for an access date on web sources that have no publication date.");
  }
  if (source.type === "book" && !clean(source.publisher)) {
    warnings.push("Books normally need a publisher.");
  }
  return warnings;
}

const YEAR = (source: Source) => clean(source.year) || "n.d.";

// ---- APA 7 -----------------------------------------------------------------

function apa(source: Source): Citation {
  const authors = nameList(
    source.authors,
    (a) => (a.organisation ? clean(a.given || a.family) : join(`${clean(a.family)},`, initials(a.given))),
    { finalSeparator: ", & ", etAlAfter: 20 },
  );
  const year = YEAR(source);
  const title = sentenceCase(source.title);
  const segments: Segment[] = [];

  const head = authors ? `${authors} (${year}). ` : `${title}. (${year}). `;
  segments.push({ text: head });

  switch (source.type) {
    case "journal": {
      segments.push({ text: authors ? `${title}. ` : "" });
      if (source.container) {
        segments.push({ text: clean(source.container), italic: true });
        if (source.volume) {
          segments.push({ text: ", " });
          segments.push({ text: clean(source.volume), italic: true });
        }
        if (source.issue) segments.push({ text: `(${clean(source.issue)})` });
        if (source.pages) segments.push({ text: `, ${clean(source.pages)}` });
        segments.push({ text: ". " });
      }
      break;
    }
    case "book":
    case "thesis":
    case "report": {
      if (authors) {
        segments.push({ text: title, italic: true });
        if (source.edition) segments.push({ text: ` (${clean(source.edition)} ed.)` });
        segments.push({ text: ". " });
      }
      if (source.type === "thesis" && source.institution) {
        segments.push({ text: `[Doctoral dissertation, ${clean(source.institution)}]. ` });
      }
      if (source.publisher) segments.push({ text: `${clean(source.publisher)}. ` });
      break;
    }
    case "chapter": {
      segments.push({ text: `${title}. ` });
      const editors = nameList(source.editors ?? [], (a) => join(initials(a.given), clean(a.family)), { finalSeparator: " & " });
      segments.push({ text: editors ? `In ${editors} (Ed${(source.editors?.length ?? 0) > 1 ? "s" : ""}.), ` : "In " });
      segments.push({ text: clean(source.container), italic: true });
      if (source.pages) segments.push({ text: ` (pp. ${clean(source.pages)})` });
      segments.push({ text: ". " });
      if (source.publisher) segments.push({ text: `${clean(source.publisher)}. ` });
      break;
    }
    default: {
      // Web pages, news and video: title italic only when there is no container.
      if (authors) {
        if (source.container) {
          segments.push({ text: `${title}. ` });
          segments.push({ text: clean(source.container), italic: true });
          segments.push({ text: ". " });
        } else {
          segments.push({ text: title, italic: true });
          segments.push({ text: ". " });
        }
      } else if (source.container) {
        segments.push({ text: clean(source.container), italic: true });
        segments.push({ text: ". " });
      }
      break;
    }
  }

  const link = locator(source);
  if (link) segments.push({ text: link });

  return {
    reference: tidy(segments),
    inText: `(${inTextNames(source.authors, "&") || shortTitle(source.title)}, ${year})`,
    warnings: warn(source, "apa"),
  };
}

// ---- MLA 9 -----------------------------------------------------------------

function mla(source: Source): Citation {
  const list = source.authors.filter((a) => clean(a.family) || clean(a.given));
  let authors = "";
  if (list.length === 1) {
    authors = list[0].organisation ? clean(list[0].given || list[0].family) : join(`${clean(list[0].family)},`, clean(list[0].given));
  } else if (list.length === 2) {
    authors = `${join(`${clean(list[0].family)},`, clean(list[0].given))}, and ${join(clean(list[1].given), clean(list[1].family))}`;
  } else if (list.length > 2) {
    authors = `${join(`${clean(list[0].family)},`, clean(list[0].given))}, et al.`;
  }

  const segments: Segment[] = [];
  if (authors) segments.push({ text: `${authors}. ` });

  const standalone = source.type === "book" || source.type === "thesis" || source.type === "report";
  if (standalone) {
    segments.push({ text: titleCase(source.title), italic: true });
    segments.push({ text: ". " });
  } else {
    segments.push({ text: `"${titleCase(source.title)}." ` });
    if (source.container) {
      segments.push({ text: clean(source.container), italic: true });
      segments.push({ text: ", " });
    }
  }

  const bits: string[] = [];
  if (source.edition) bits.push(`${clean(source.edition)} ed.`);
  if (source.publisher) bits.push(clean(source.publisher));
  if (source.volume) bits.push(`vol. ${clean(source.volume)}`);
  if (source.issue) bits.push(`no. ${clean(source.issue)}`);
  const date = fullDate(source, "dmy");
  if (date) bits.push(date);
  if (source.pages) bits.push(`pp. ${clean(source.pages)}`);
  const link = locator(source);
  if (link) bits.push(link.replace(/^https?:\/\//, ""));
  if (source.accessed) bits.push(`Accessed ${clean(source.accessed)}`);

  if (bits.length) segments.push({ text: `${bits.join(", ")}.` });

  const first = list[0];
  const surnameOf = (a: Author) => (a.organisation ? clean(a.given || a.family) : clean(a.family));
  const inTextName = !first
    ? shortTitle(source.title)
    : list.length === 1
      ? surnameOf(first)
      : list.length === 2
        ? `${surnameOf(list[0])} and ${surnameOf(list[1])}`
        : `${surnameOf(first)} et al.`;
  const page = clean(source.pages).split(/[-–]/)[0];

  return {
    reference: tidy(segments),
    inText: `(${inTextName}${page ? ` ${page}` : ""})`,
    warnings: warn(source, "mla"),
  };
}

// ---- Harvard ---------------------------------------------------------------

function harvard(source: Source): Citation {
  const authors = nameList(
    source.authors,
    (a) => (a.organisation ? clean(a.given || a.family) : join(`${clean(a.family)},`, initials(a.given, { spaced: false }))),
    { finalSeparator: " and " },
  );
  const year = YEAR(source);
  const segments: Segment[] = [];
  segments.push({ text: authors ? `${authors} (${year}) ` : `${sentenceCase(source.title)} (${year}) ` });

  const standalone = source.type === "book" || source.type === "thesis" || source.type === "report";
  if (authors) {
    if (standalone) {
      segments.push({ text: sentenceCase(source.title), italic: true });
      segments.push({ text: ". " });
    } else {
      segments.push({ text: `'${sentenceCase(source.title)}', ` });
      if (source.container) {
        segments.push({ text: clean(source.container), italic: true });
      }
    }
  }

  const bits: string[] = [];
  if (source.volume) bits.push(`${clean(source.volume)}${source.issue ? `(${clean(source.issue)})` : ""}`);
  if (source.pages) bits.push(`pp. ${clean(source.pages)}`);
  if (source.edition) bits.push(`${clean(source.edition)} edn`);
  if (source.city && source.publisher) bits.push(`${clean(source.city)}: ${clean(source.publisher)}`);
  else if (source.publisher) bits.push(clean(source.publisher));
  if (bits.length) segments.push({ text: `${standalone ? "" : ", "}${bits.join(", ")}. ` });
  else if (!standalone && source.container) segments.push({ text: ". " });

  const link = locator(source);
  if (link) {
    segments.push({ text: `Available at: ${link}` });
    if (source.accessed) segments.push({ text: ` (Accessed: ${clean(source.accessed)})` });
    segments.push({ text: "." });
  }

  return {
    reference: tidy(segments),
    inText: `(${inTextNames(source.authors, "and") || shortTitle(source.title)}, ${year})`,
    warnings: warn(source, "harvard"),
  };
}

// ---- Chicago (author–date) --------------------------------------------------

function chicago(source: Source): Citation {
  const list = source.authors.filter((a) => clean(a.family) || clean(a.given));
  let authors = "";
  if (list.length === 1) {
    authors = list[0].organisation ? clean(list[0].given || list[0].family) : join(`${clean(list[0].family)},`, clean(list[0].given));
  } else if (list.length > 1) {
    const first = join(`${clean(list[0].family)},`, clean(list[0].given));
    const rest = list.slice(1).map((a) => join(clean(a.given), clean(a.family)));
    authors = list.length > 3
      ? `${first}, et al.`
      : `${first}, ${rest.slice(0, -1).concat(`and ${rest[rest.length - 1]}`).join(", ")}`;
  }

  const year = YEAR(source);
  const segments: Segment[] = [];
  if (authors) segments.push({ text: `${authors}. ${year}. ` });
  else segments.push({ text: `${year}. ` });

  const standalone = source.type === "book" || source.type === "thesis" || source.type === "report";
  if (standalone) {
    segments.push({ text: titleCase(source.title), italic: true });
    segments.push({ text: ". " });
    if (source.edition) segments.push({ text: `${clean(source.edition)} ed. ` });
    if (source.city) segments.push({ text: `${clean(source.city)}: ` });
    if (source.publisher) segments.push({ text: `${clean(source.publisher)}. ` });
  } else {
    segments.push({ text: `"${titleCase(source.title)}." ` });
    if (source.container) {
      segments.push({ text: clean(source.container), italic: true });
      segments.push({ text: " " });
    }
    const bits: string[] = [];
    if (source.volume) bits.push(clean(source.volume));
    if (source.issue) bits.push(`no. ${clean(source.issue)}`);
    if (bits.length) segments.push({ text: `${bits.join(", ")}` });
    if (source.pages) segments.push({ text: `: ${clean(source.pages)}` });
    segments.push({ text: ". " });
  }

  const link = locator(source);
  if (link) segments.push({ text: `${link}.` });

  const surnameOf = (a: Author) => (a.organisation ? clean(a.given || a.family) : clean(a.family));
  const names = list.length === 0
    ? shortTitle(source.title)
    : list.length === 1
      ? surnameOf(list[0])
      : list.length <= 3
        ? `${list.slice(0, -1).map(surnameOf).join(", ")} and ${surnameOf(list[list.length - 1])}`
        : `${surnameOf(list[0])} et al.`;
  const page = clean(source.pages).split(/[-–]/)[0];

  return {
    reference: tidy(segments),
    inText: `(${names} ${year}${page ? `, ${page}` : ""})`,
    warnings: warn(source, "chicago"),
  };
}

// ---- IEEE ------------------------------------------------------------------

function ieee(source: Source): Citation {
  const named = source.authors.filter((a) => clean(a.family) || clean(a.given));
  const authors = nameList(
    source.authors,
    (a) => (a.organisation ? clean(a.given || a.family) : join(initials(a.given), clean(a.family))),
    { finalSeparator: named.length === 2 ? " and " : ", and ", etAlAfter: 6 },
  );
  const segments: Segment[] = [];
  if (authors) segments.push({ text: `${authors}, ` });

  const standalone = source.type === "book" || source.type === "thesis" || source.type === "report";
  if (standalone) {
    segments.push({ text: titleCase(source.title), italic: true });
    segments.push({ text: ". " });
  } else {
    segments.push({ text: `"${sentenceCase(source.title)}," ` });
    if (source.container) {
      segments.push({ text: clean(source.container), italic: true });
      segments.push({ text: ", " });
    }
  }

  const bits: string[] = [];
  if (source.edition) bits.push(`${clean(source.edition)} ed.`);
  if (source.city && source.publisher) bits.push(`${clean(source.city)}: ${clean(source.publisher)}`);
  else if (source.publisher) bits.push(clean(source.publisher));
  if (source.volume) bits.push(`vol. ${clean(source.volume)}`);
  if (source.issue) bits.push(`no. ${clean(source.issue)}`);
  if (source.pages) bits.push(`pp. ${clean(source.pages)}`);
  const date = fullDate(source, "mdy");
  if (date) bits.push(date);
  if (bits.length) segments.push({ text: `${bits.join(", ")}. ` });

  const link = locator(source);
  if (link) {
    segments.push({ text: `[Online]. Available: ${link}` });
    if (source.accessed) segments.push({ text: `. [Accessed: ${clean(source.accessed)}]` });
  }

  return {
    reference: tidy(segments, "[1] "),
    inText: "[1]",
    warnings: [
      ...warn(source, "ieee"),
      "IEEE numbers references in the order they first appear, so replace [1] with the right number.",
    ],
  };
}

// ---- Vancouver -------------------------------------------------------------

function vancouver(source: Source): Citation {
  const authors = nameList(
    source.authors,
    (a) => (a.organisation ? clean(a.given || a.family) : join(clean(a.family), initials(a.given, { periods: false, spaced: false }))),
    { separator: ", ", finalSeparator: ", ", etAlAfter: 6 },
  );

  const segments: Segment[] = [];
  if (authors) segments.push({ text: `${authors}. ` });
  segments.push({ text: `${sentenceCase(source.title)}. ` });

  if (source.container) segments.push({ text: `${clean(source.container)}. ` });
  if (source.city && source.publisher) segments.push({ text: `${clean(source.city)}: ${clean(source.publisher)}; ` });
  else if (source.publisher) segments.push({ text: `${clean(source.publisher)}; ` });

  const tail: string[] = [];
  const date = fullDate(source, "dmy");
  if (date) tail.push(date);
  if (source.volume) {
    tail.push(`${clean(source.volume)}${source.issue ? `(${clean(source.issue)})` : ""}${source.pages ? `:${clean(source.pages)}` : ""}`);
  } else if (source.pages) {
    tail.push(`p. ${clean(source.pages)}`);
  }
  if (tail.length) segments.push({ text: `${tail.join(";")}. ` });

  const link = locator(source);
  if (link) segments.push({ text: `Available from: ${link}` });

  return {
    reference: tidy(segments, "1. "),
    inText: "(1)",
    warnings: [
      ...warn(source, "vancouver"),
      "Vancouver numbers references in citation order, so replace 1 with the right number.",
    ],
  };
}

// ---- shared ----------------------------------------------------------------

function shortTitle(title: string): string {
  const words = clean(title).split(" ").slice(0, 3).join(" ");
  return words ? `"${words}"` : "Untitled";
}

/** Collapses stray spacing and duplicate punctuation across segment joins. */
function tidy(segments: Segment[], prefix = ""): Segment[] {
  const merged: Segment[] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const last = merged[merged.length - 1];
    if (last && !!last.italic === !!segment.italic) last.text += segment.text;
    else merged.push({ ...segment });
  }
  for (let i = 0; i < merged.length; i += 1) {
    merged[i].text = merged[i].text
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/([,.;:])\1+/g, "$1")
      .replace(/,\s*\./g, ".");
  }
  const first = merged[0];
  if (first && prefix) first.text = prefix + first.text.trimStart();
  const last = merged[merged.length - 1];
  if (last) {
    last.text = last.text.trimEnd();
    const endsWithLink = /https?:\/\/\S+$/.test(last.text);
    if (last.text && !endsWithLink && !/[.\]]$/.test(last.text)) last.text += ".";
  }
  return merged.filter((s) => s.text);
}

const FORMATTERS: Record<CitationStyle, (source: Source) => Citation> = {
  apa, mla, harvard, chicago, ieee, vancouver,
};

export function formatCitation(source: Source, style: CitationStyle): Citation {
  return FORMATTERS[style](source);
}

export function toPlainText(segments: Segment[]): string {
  return segments.map((s) => s.text).join("");
}

export function toHtml(segments: Segment[]): string {
  return segments
    .map((s) => {
      const escaped = s.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return s.italic ? `<em>${escaped}</em>` : escaped;
    })
    .join("");
}

/** Sorts a reference list the way the style expects. */
export function sortReferences(sources: Source[], style: CitationStyle): Source[] {
  if (style === "ieee" || style === "vancouver") return sources;
  return [...sources].sort((a, b) => {
    const nameA = clean(a.authors[0]?.family || a.authors[0]?.given || a.title).toLowerCase();
    const nameB = clean(b.authors[0]?.family || b.authors[0]?.given || b.title).toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return clean(a.year).localeCompare(clean(b.year));
  });
}

/** The heading each style puts above the reference list. */
export const LIST_HEADING: Record<CitationStyle, string> = {
  apa: "References",
  mla: "Works Cited",
  harvard: "Reference list",
  chicago: "References",
  ieee: "References",
  vancouver: "References",
};
