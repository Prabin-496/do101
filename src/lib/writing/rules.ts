import {
  CLICHES, CONFUSIONS, FILLER, HEDGES, MISSPELLINGS, NOMINALISATIONS, WORDY,
} from "./lexicon";

/**
 * The rule engine behind the proofreader.
 *
 * This is deliberately a rule-based checker, not a parser or a language model.
 * It catches the mistakes that follow recognisable patterns — the ones that
 * account for most of what a marker circles in red — and it says so plainly
 * rather than implying it understands the sentence. Anything it cannot verify
 * from the pattern alone is reported as a suggestion, never as an error.
 */

export type IssueCategory =
  | "spelling"
  | "grammar"
  | "punctuation"
  | "clarity"
  | "concision"
  | "style";

export type Severity = "error" | "warning" | "suggestion";

export interface WritingIssue {
  id: string;
  rule: string;
  category: IssueCategory;
  severity: Severity;
  /** Character offset into the original text. */
  start: number;
  end: number;
  matched: string;
  message: string;
  /** Ordered candidate replacements. May be empty when the fix needs judgement. */
  replacements: string[];
  explain: string;
}

interface PatternRule {
  rule: string;
  category: IssueCategory;
  severity: Severity;
  pattern: RegExp;
  message: (m: RegExpExecArray) => string;
  replacements: (m: RegExpExecArray) => string[];
  explain: string;
}

/** Keeps a replacement looking like the text it replaces. */
function matchCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds one alternation from a phrase list so the text is scanned once per group. */
function phraseAlternation(phrases: string[]): RegExp {
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  const body = sorted.map((p) => escape(p).replace(/\\?\s+/g, "\\s+")).join("|");
  return new RegExp(`\\b(${body})\\b`, "gi");
}

const WORDY_PATTERN = phraseAlternation(Object.keys(WORDY));
const NOMINALISATION_PATTERN = phraseAlternation(Object.keys(NOMINALISATIONS));
const CLICHE_PATTERN = phraseAlternation(CLICHES);
const FILLER_PATTERN = new RegExp(`\\b(${FILLER.join("|")})\\b`, "gi");
const HEDGE_PATTERN = phraseAlternation(HEDGES);
/**
 * Misspellings are stored in base form, so the pattern also accepts the regular
 * inflections and rebuilds the correction with the same ending.
 */
const MISSPELLING_PATTERN = new RegExp(
  `\\b(${Object.keys(MISSPELLINGS).sort((a, b) => b.length - a.length).join("|")})(s|es|d|ed|ing|ly)?\\b`,
  "gi",
);

/** Re-attaches an inflection to a corrected stem, handling the silent E. */
function reinflect(fixed: string, suffix: string | undefined): string {
  if (!suffix) return fixed;
  // Multi-word and apostrophe corrections ("alot" to "a lot") take no suffix.
  if (fixed.includes(" ") || fixed.includes("'")) return fixed;
  const endsInE = fixed.endsWith("e");
  switch (suffix.toLowerCase()) {
    case "ing": return endsInE ? `${fixed.slice(0, -1)}ing` : `${fixed}ing`;
    case "ed":
    case "d": return endsInE ? `${fixed}d` : `${fixed}ed`;
    case "es": return /(?:s|x|z|ch|sh)$/.test(fixed) ? `${fixed}es` : `${fixed}s`;
    default: return fixed + suffix.toLowerCase();
  }
}

/** Normalises whitespace inside a matched phrase so lookups still hit. */
function normalisePhrase(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

const RULES: PatternRule[] = [
  // ---- Spelling -----------------------------------------------------------
  {
    rule: "misspelling",
    category: "spelling",
    severity: "error",
    pattern: MISSPELLING_PATTERN,
    message: (m) => `"${m[0]}" looks like a misspelling.`,
    replacements: (m) => {
      const fix = MISSPELLINGS[m[1].toLowerCase()];
      return fix ? [matchCase(m[0], reinflect(fix, m[2]))] : [];
    },
    explain: "Checked against a list of frequently misspelled English words.",
  },
  {
    rule: "doubled-word",
    category: "spelling",
    severity: "error",
    pattern: /\b(\w+)(\s+)\1\b/gi,
    message: (m) => `"${m[1]}" is repeated.`,
    replacements: (m) => [m[1]],
    explain: "The same word appears twice in a row, which is almost always a typing slip.",
  },

  // ---- Grammar ------------------------------------------------------------
  {
    rule: "a-before-vowel",
    category: "grammar",
    severity: "error",
    // Vowel letter but consonant sound ("a European", "a one-off", "a user")
    // is the whole difficulty here, so those spellings are excluded by prefix.
    pattern: /\ba\s+(?!(?:eu|ew|one|once|uni|use|usu|usa|uti|uto|ute|ubi|ura|uri|ukr|ufo)\w*\b)(?=(?:[aeiou]|h(?:our|onest|onour|onor|eir))\w*)(\w+)/gi,
    message: (m) => `Use "an" before "${m[1]}".`,
    replacements: (m) => [matchCase(m[0].slice(0, 1), "an") + m[0].slice(1)],
    explain: "\"An\" goes before a vowel sound, \"a\" before a consonant sound.",
  },
  {
    rule: "an-before-consonant",
    category: "grammar",
    severity: "error",
    // Lowercase-only lookahead so acronyms ("an MRI", "an X-ray") are left alone.
    pattern: /\b[Aa]n\s+(?=[bcdfgjklmnpqrstvwyz][a-z])(\w+)/g,
    message: (m) => `Use "a" before "${m[1]}".`,
    replacements: (m) => [matchCase(m[0].slice(0, 2), "a") + m[0].slice(2)],
    explain: "\"A\" goes before a consonant sound, \"an\" before a vowel sound.",
  },
  {
    rule: "verb-of",
    category: "grammar",
    severity: "error",
    pattern: /\b(would|could|should|must|might|may)\s+of\b/gi,
    message: (m) => `"${m[0]}" should be "${m[1]} have".`,
    replacements: (m) => [`${m[1]} have`],
    explain: "The contraction \"would've\" sounds like \"would of\", but the word is \"have\".",
  },
  {
    rule: "lowercase-i",
    category: "grammar",
    severity: "error",
    pattern: /(^|[^\p{L}'’])i(?=[^\p{L}'’]|$)/gu,
    message: () => "The pronoun \"I\" is always capitalised.",
    replacements: (m) => [`${m[1]}I`],
    explain: "English capitalises the first-person singular pronoun wherever it appears.",
  },
  {
    rule: "sentence-capital",
    category: "grammar",
    severity: "warning",
    pattern: /(?:^|[.!?]\s+|\n\s*)([a-z])(?=\w{2,})/g,
    message: () => "Sentences start with a capital letter.",
    replacements: (m) => [m[0].slice(0, m[0].length - 1) + m[1].toUpperCase()],
    explain: "The first word after a full stop, question mark or exclamation mark is capitalised.",
  },
  {
    rule: "there-their",
    category: "grammar",
    severity: "warning",
    pattern: /\bthere\s+(?=(?:own|house|home|car|work|results|findings|argument|paper|essay|opinion|view|study|research|data|children|parents|friends|families)\b)/gi,
    message: () => "This looks like it should be \"their\".",
    replacements: (m) => [matchCase(m[0].trim(), "their") + " "],
    explain: "\"Their\" shows possession; \"there\" refers to a place; \"they're\" means \"they are\".",
  },
  {
    rule: "double-negative",
    category: "grammar",
    severity: "warning",
    pattern: /\b(?:can'?t|don'?t|doesn'?t|didn'?t|won'?t|wouldn'?t|couldn'?t|shouldn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|never|not)\s+(?:\w+\s+){0,2}?(no|nothing|nobody|nowhere|none|never)\b/gi,
    message: () => "This reads as a double negative.",
    replacements: () => [],
    explain: "Two negatives in one clause cancel out in standard written English. \"I can't get any\" rather than \"I can't get none\".",
  },
  {
    rule: "subject-verb-plural",
    category: "grammar",
    severity: "warning",
    pattern: /\b(they|we|these|those|students|people|results|findings|participants)\s+(is|was|has|does)\b/gi,
    message: (m) => `"${m[1]}" is plural, so it takes "${
      { is: "are", was: "were", has: "have", does: "do" }[m[2].toLowerCase()] ?? m[2]
    }".`,
    replacements: (m) => {
      const map: Record<string, string> = { is: "are", was: "were", has: "have", does: "do" };
      const fixed = map[m[2].toLowerCase()];
      return fixed ? [`${m[1]} ${matchCase(m[2], fixed)}`] : [];
    },
    explain: "Plural subjects take plural verb forms.",
  },
  {
    rule: "subject-verb-singular",
    category: "grammar",
    severity: "warning",
    pattern: /\b(he|she|it|this|that|each|everyone|everybody|someone|nobody)\s+(are|were|have|do)\b/gi,
    message: (m) => `"${m[1]}" is singular, so it takes "${
      { are: "is", were: "was", have: "has", do: "does" }[m[2].toLowerCase()] ?? m[2]
    }".`,
    replacements: (m) => {
      const map: Record<string, string> = { are: "is", were: "was", have: "has", do: "does" };
      const fixed = map[m[2].toLowerCase()];
      return fixed ? [`${m[1]} ${matchCase(m[2], fixed)}`] : [];
    },
    explain: "Singular subjects take singular verb forms.",
  },

  // ---- Punctuation --------------------------------------------------------
  {
    rule: "space-before-punctuation",
    category: "punctuation",
    severity: "error",
    pattern: /\s+([,.;:!?])/g,
    message: (m) => `Remove the space before "${m[1]}".`,
    replacements: (m) => [m[1]],
    explain: "In English, closing punctuation sits tight against the word before it.",
  },
  {
    rule: "missing-space-after-punctuation",
    category: "punctuation",
    severity: "error",
    pattern: /([,;:])(?=[\p{L}])/gu,
    message: (m) => `Add a space after "${m[1]}".`,
    replacements: (m) => [`${m[1]} `],
    explain: "A space follows a comma, semicolon or colon.",
  },
  {
    rule: "missing-sentence-space",
    category: "punctuation",
    severity: "error",
    pattern: /([.!?])(?=[A-Z][a-z])/g,
    message: (m) => `Add a space after "${m[1]}".`,
    replacements: (m) => [`${m[1]} `],
    explain: "Sentences are separated by a single space.",
  },
  {
    rule: "repeated-punctuation",
    category: "punctuation",
    severity: "warning",
    pattern: /([!?,;:])\1{1,}/g,
    message: (m) => `"${m[0]}" repeats punctuation.`,
    replacements: (m) => [m[1]],
    explain: "Repeated punctuation reads as informal and adds no meaning in academic or professional writing.",
  },
  {
    rule: "multiple-spaces",
    category: "punctuation",
    severity: "suggestion",
    pattern: /(?<=\S) {2,}(?=\S)/g,
    message: () => "More than one space between words.",
    replacements: () => [" "],
    explain: "Word processors and the web collapse runs of spaces inconsistently. One is safer.",
  },
  {
    rule: "spaced-hyphen",
    category: "punctuation",
    severity: "suggestion",
    pattern: /\s-\s/g,
    message: () => "A dash between clauses should be an en dash or em dash.",
    replacements: () => [" — ", " – "],
    explain: "A hyphen joins words; a dash separates clauses.",
  },
  {
    rule: "ellipsis",
    category: "punctuation",
    severity: "suggestion",
    pattern: /\.{3,}/g,
    message: () => "Use a single ellipsis character.",
    replacements: () => ["…"],
    explain: "Three separate dots can break across lines; the ellipsis character will not.",
  },
  {
    rule: "comma-splice",
    category: "punctuation",
    severity: "warning",
    pattern: /,\s+(?=(?:however|therefore|moreover|furthermore|consequently|nevertheless|thus|hence|otherwise|instead)\s*,?\s+[a-z])/gi,
    message: () => "Two full sentences joined by a comma.",
    replacements: () => ["; ", ". "],
    explain: "Words like \"however\" and \"therefore\" do not join sentences. Use a semicolon or a full stop.",
  },

  // ---- Clarity and concision ---------------------------------------------
  {
    rule: "wordy-phrase",
    category: "concision",
    severity: "suggestion",
    pattern: WORDY_PATTERN,
    message: (m) => {
      const fix = WORDY[normalisePhrase(m[1])];
      return fix ? `"${m[1]}" can be "${fix}".` : `"${m[1]}" can usually be cut.`;
    },
    replacements: (m) => {
      const fix = WORDY[normalisePhrase(m[1])];
      if (fix === undefined) return [];
      return fix === "" ? [""] : [matchCase(m[1], fix)];
    },
    explain: "Shorter phrasing carries the same meaning. Markers and readers both notice padding.",
  },
  {
    rule: "nominalisation",
    category: "clarity",
    severity: "suggestion",
    pattern: NOMINALISATION_PATTERN,
    message: (m) => {
      const fix = NOMINALISATIONS[normalisePhrase(m[1])];
      return fix ? `Use the verb: "${fix}" instead of "${m[1]}".` : `"${m[1]}" hides a verb inside a noun.`;
    },
    replacements: (m) => {
      const fix = NOMINALISATIONS[normalisePhrase(m[1])];
      return fix ? [matchCase(m[1], fix)] : [];
    },
    explain: "Turning a verb into a noun ('decide' into 'make a decision') adds words and slows the sentence down.",
  },
  {
    rule: "filler-word",
    category: "concision",
    severity: "suggestion",
    pattern: FILLER_PATTERN,
    message: (m) => `"${m[1]}" rarely changes the meaning.`,
    replacements: () => [""],
    explain: "Intensifiers usually weaken a claim rather than strengthen it. Delete or use a stronger word.",
  },
  {
    rule: "hedging",
    category: "clarity",
    severity: "suggestion",
    pattern: HEDGE_PATTERN,
    message: (m) => `"${m[1]}" softens the claim.`,
    replacements: () => [],
    explain: "Some hedging is correct in academic writing. Too much of it makes an argument sound unsupported.",
  },
  {
    rule: "cliche",
    category: "style",
    severity: "suggestion",
    pattern: CLICHE_PATTERN,
    message: (m) => `"${m[1]}" is a stock phrase.`,
    replacements: () => [],
    explain: "Stock phrases read as filler. Say the specific thing you mean instead.",
  },
  {
    rule: "there-is-opener",
    category: "clarity",
    severity: "suggestion",
    pattern: /(?:^|[.!?]\s+)(There\s+(?:is|are|was|were)\s+)/g,
    message: () => "Starting with \"There is/are\" buries the subject.",
    replacements: () => [],
    explain: "\"There are three reasons why X matters\" is usually stronger as \"X matters for three reasons\".",
  },
  {
    rule: "contraction-in-formal",
    category: "style",
    severity: "suggestion",
    pattern: /\b\w+n['’]t\b|\b(?:I['’]m|we['’]re|they['’]re|you['’]re|it['’]s|that['’]s|there['’]s|let['’]s|I['’]ve|we['’]ve|I['’]ll|we['’]ll)\b/gi,
    message: (m) => `"${m[0]}" is a contraction.`,
    replacements: () => [],
    explain: "Most academic style guides ask for full forms. Fine for blogs, email and creative writing.",
  },
];

/** Rules that only apply above a length threshold, so they are opt-in per profile. */
export const FORMAL_ONLY_RULES = new Set(["contraction-in-formal"]);

export interface CheckOptions {
  /** Applies rules that only matter in academic or formal writing. */
  formal?: boolean;
  /** Rule ids the reader has chosen to mute. */
  disabled?: string[];
  /** Sentences longer than this are flagged. */
  longSentenceWords?: number;
}

/** Splits text into sentences, keeping the offset of each one. */
export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
  words: string[];
}

export function splitSentences(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const pattern = /[^.!?…\n]+(?:[.!?…]+|\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (!body || !/[\p{L}\p{N}]/u.test(body)) continue;
    const start = match.index + leading;
    spans.push({
      text: body,
      start,
      end: start + body.length,
      words: body.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [],
    });
    if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
  }
  return spans;
}

/** Passive voice: a form of "to be" followed by a past participle. */
const BE_FORMS = /\b(am|is|are|was|were|be|been|being|get|gets|got)\b/gi;
const PARTICIPLE = /^(?:\w+ed|born|done|made|said|seen|taken|given|written|shown|known|found|held|kept|left|felt|built|brought|bought|caught|taught|thought|sold|told|paid|put|set|sent|spent|read|led|met|run|cut|hit|lost|won|drawn|grown|thrown|chosen|driven|eaten|fallen|forgotten|hidden|proven|risen|spoken|stolen|worn|broken|frozen|beaten)$/i;

export function findPassiveVoice(text: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
  const pattern = new RegExp(BE_FORMS.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    // Allow one adverb between the auxiliary and the participle.
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
    const words = after.match(/^\s+(\w+)(?:\s+(\w+))?/);
    if (!words) continue;
    const candidate = words[2] && /ly$/i.test(words[1]) ? words[2] : words[1];
    if (!candidate || !PARTICIPLE.test(candidate)) continue;
    // "is used to" and "is based on" are idiomatic enough to leave alone.
    const tail = text.slice(match.index, match.index + match[0].length + after.length);
    if (/\b(?:is|are|was|were|been)\s+(?:used\s+to|based\s+on|located|called|named|born|known\s+as|made\s+up\s+of|composed\s+of|entitled|concerned\s+with)\b/i.test(tail)) continue;

    const end = match.index + match[0].length + (words[0]?.length ?? 0);
    issues.push({
      id: `passive-${match.index}`,
      rule: "passive-voice",
      category: "clarity",
      severity: "suggestion",
      start: match.index,
      end,
      matched: text.slice(match.index, end),
      message: "Passive voice — consider naming who does the action.",
      replacements: [],
      explain:
        "Passive voice is correct and sometimes preferable, especially in scientific method sections. It only becomes a problem when most of your sentences use it.",
    });
  }
  return issues;
}

export function findLongSentences(text: string, limit: number): WritingIssue[] {
  return splitSentences(text)
    .filter((s) => s.words.length > limit)
    .map((s) => ({
      id: `long-${s.start}`,
      rule: "long-sentence",
      category: "clarity" as const,
      severity: "suggestion" as const,
      start: s.start,
      end: s.end,
      matched: s.text,
      message: `This sentence runs to ${s.words.length} words.`,
      replacements: [],
      explain: `Sentences over about ${limit} words are hard to hold in mind. Look for a natural break — often at "and", "but" or a comma.`,
    }));
}

/** Words repeated unusually often in a short span. */
export function findRepetition(text: string): WritingIssue[] {
  const sentences = splitSentences(text);
  const issues: WritingIssue[] = [];
  const common = new Set([
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
    "with", "is", "are", "was", "were", "be", "been", "it", "this", "that",
    "as", "by", "from", "has", "have", "had", "not", "they", "we", "you",
    "he", "she", "i", "their", "its", "his", "her", "our", "your", "which",
    "can", "will", "would", "there", "than", "then", "these", "those",
  ]);

  for (let i = 0; i < sentences.length - 1; i += 1) {
    const window = sentences.slice(i, i + 3);
    const counts = new Map<string, number>();
    for (const sentence of window) {
      const seen = new Set<string>();
      for (const word of sentence.words) {
        const key = word.toLowerCase();
        if (common.has(key) || key.length < 5 || seen.has(key)) continue;
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const [word, count] of counts) {
      if (count < 3) continue;
      const index = text.toLowerCase().indexOf(word, sentences[i].start);
      if (index < 0) continue;
      if (issues.some((issue) => issue.matched.toLowerCase() === word)) continue;
      issues.push({
        id: `repeat-${index}-${word}`,
        rule: "repetition",
        category: "style",
        severity: "suggestion",
        start: index,
        end: index + word.length,
        matched: text.slice(index, index + word.length),
        message: `"${word}" appears in ${count} sentences in a row.`,
        replacements: [],
        explain: "Repeating a content word across neighbouring sentences flattens the prose. A synonym or a pronoun usually fixes it.",
      });
    }
  }
  return issues;
}

/** Paragraphs that open the same way twice. */
export function findRepeatedOpeners(text: string): WritingIssue[] {
  const sentences = splitSentences(text);
  const issues: WritingIssue[] = [];
  for (let i = 1; i < sentences.length; i += 1) {
    const previous = sentences[i - 1].words[0]?.toLowerCase();
    const current = sentences[i].words[0]?.toLowerCase();
    if (!previous || !current || previous !== current) continue;
    if (current.length < 3) continue;
    issues.push({
      id: `opener-${sentences[i].start}`,
      rule: "repeated-opener",
      category: "style",
      severity: "suggestion",
      start: sentences[i].start,
      end: sentences[i].start + (sentences[i].words[0]?.length ?? 0),
      matched: sentences[i].words[0] ?? "",
      message: `Two sentences in a row start with "${sentences[i].words[0]}".`,
      replacements: [],
      explain: "Varying how sentences begin is one of the cheapest ways to make a paragraph read better.",
    });
  }
  return issues;
}

/** Removes overlaps, keeping the more severe issue. */
function dedupe(issues: WritingIssue[]): WritingIssue[] {
  const weight: Record<Severity, number> = { error: 3, warning: 2, suggestion: 1 };
  const sorted = [...issues].sort((a, b) => a.start - b.start || weight[b.severity] - weight[a.severity]);
  const kept: WritingIssue[] = [];
  for (const issue of sorted) {
    const clash = kept.find(
      (existing) =>
        existing.start < issue.end &&
        issue.start < existing.end &&
        // Whole-sentence issues coexist with word-level ones.
        existing.rule !== "long-sentence" &&
        issue.rule !== "long-sentence",
    );
    if (!clash) kept.push(issue);
  }
  return kept.sort((a, b) => a.start - b.start);
}

export function check(text: string, options: CheckOptions = {}): WritingIssue[] {
  if (!text.trim()) return [];
  const disabled = new Set(options.disabled ?? []);
  const issues: WritingIssue[] = [];

  for (const rule of RULES) {
    if (disabled.has(rule.rule)) continue;
    if (FORMAL_ONLY_RULES.has(rule.rule) && !options.formal) continue;

    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    let guard = 0;
    while ((match = pattern.exec(text)) !== null && guard < 5000) {
      guard += 1;
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }
      issues.push({
        id: `${rule.rule}-${match.index}`,
        rule: rule.rule,
        category: rule.category,
        severity: rule.severity,
        start: match.index,
        end: match.index + match[0].length,
        matched: match[0],
        message: rule.message(match),
        replacements: rule.replacements(match),
        explain: rule.explain,
      });
    }
  }

  for (const confusion of CONFUSIONS) {
    if (disabled.has("confusable")) continue;
    if (!confusion.note) continue;
    const pattern = new RegExp(confusion.wrong.source, confusion.wrong.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) { pattern.lastIndex += 1; continue; }
      const trimmed = match[0].trimEnd();
      issues.push({
        id: `confusable-${match.index}`,
        rule: "confusable",
        category: "grammar",
        severity: "warning",
        start: match.index,
        end: match.index + trimmed.length,
        matched: trimmed,
        message: `Did you mean "${confusion.right}"?`,
        replacements: [matchCase(trimmed, confusion.right)],
        explain: confusion.note,
      });
    }
  }

  if (!disabled.has("passive-voice")) issues.push(...findPassiveVoice(text));
  if (!disabled.has("long-sentence")) {
    issues.push(...findLongSentences(text, options.longSentenceWords ?? 28));
  }
  if (!disabled.has("repetition")) issues.push(...findRepetition(text));
  if (!disabled.has("repeated-opener")) issues.push(...findRepeatedOpeners(text));

  return dedupe(issues);
}

/** Applies a replacement without disturbing offsets the caller still holds. */
export function applyIssue(text: string, issue: WritingIssue, replacement: string): string {
  return text.slice(0, issue.start) + replacement + text.slice(issue.end);
}

/** Applies every issue that has exactly one confident fix, right to left. */
export function applyConfidentFixes(text: string, issues: WritingIssue[]): { text: string; applied: number } {
  const safe = issues
    .filter((issue) => issue.severity === "error" && issue.replacements.length === 1)
    .sort((a, b) => b.start - a.start);
  let output = text;
  for (const issue of safe) {
    output = output.slice(0, issue.start) + issue.replacements[0] + output.slice(issue.end);
  }
  return { text: output, applied: safe.length };
}

export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  punctuation: "Punctuation",
  clarity: "Clarity",
  concision: "Concision",
  style: "Style",
};
