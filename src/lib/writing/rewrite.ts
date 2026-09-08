import { FILLER, NOMINALISATIONS, SYNONYMS, WORDY } from "./lexicon";
import { splitSentences } from "./rules";

/**
 * Rule-based rewriting.
 *
 * Every change here is a substitution this file can justify: a long phrase for
 * its short equivalent, a noun phrase for the verb hiding inside it, a
 * contraction for its full form. It is not a paraphraser in the sense of
 * restating an idea in new words — that needs to understand the idea, which
 * rules cannot do — so the tool shows each edit it made and lets the writer
 * reject any of them, rather than handing back a black-box rewrite.
 */

export type RewriteMode = "concise" | "formal" | "simple" | "active";

export interface Change {
  from: string;
  to: string;
  reason: string;
  start: number;
  end: number;
}

export interface RewriteResult {
  text: string;
  changes: Change[];
  /** Words removed, which is the number people actually care about. */
  wordsBefore: number;
  wordsAfter: number;
}

export const MODE_LABELS: Record<RewriteMode, { name: string; blurb: string }> = {
  concise: {
    name: "Concise",
    blurb: "Cuts padding: long phrases become short ones, filler words go.",
  },
  formal: {
    name: "Formal",
    blurb: "Writes contractions out in full and swaps casual words for academic ones.",
  },
  simple: {
    name: "Plain English",
    blurb: "Replaces heavy words with everyday ones and flags sentences to split.",
  },
  active: {
    name: "Active voice",
    blurb: "Finds passive constructions and shows how to name the actor.",
  },
};

/** Contractions, expanded. "'s" is ambiguous so it is left alone. */
const EXPANSIONS: Record<string, string> = {
  "aren't": "are not", "can't": "cannot", "couldn't": "could not",
  "didn't": "did not", "doesn't": "does not", "don't": "do not",
  "hadn't": "had not", "hasn't": "has not", "haven't": "have not",
  "isn't": "is not", "mustn't": "must not", "shouldn't": "should not",
  "wasn't": "was not", "weren't": "were not", "won't": "will not",
  "wouldn't": "would not", "i'm": "I am", "i've": "I have", "i'll": "I will",
  "i'd": "I would", "you're": "you are", "you've": "you have",
  "you'll": "you will", "we're": "we are", "we've": "we have",
  "we'll": "we will", "they're": "they are", "they've": "they have",
  "they'll": "they will", "let's": "let us", "that's": "that is",
  "there's": "there is", "here's": "here is", "what's": "what is",
  "who's": "who is", "it's": "it is",
};

/** Casual words with a neutral academic equivalent. */
const FORMAL_SWAPS: Record<string, string> = {
  "kids": "children", "guys": "people",
  "stuff": "material", "big": "substantial",
  "huge": "considerable", "get": "obtain", "got": "obtained",
  "figure out": "determine", "find out": "establish", "look into": "examine",
  "look at": "examine", "go up": "increase", "go down": "decrease",
  "come up with": "develop", "deal with": "address", "put up with": "tolerate",
  "check out": "review", "point out": "note", "bring up": "raise",
  "set up": "establish", "cut down": "reduce", "in a nutshell": "in summary",
  "sort out": "resolve", "show up": "appear", "talk about": "discuss",
  "think about": "consider", "keep on": "continue", "give up": "abandon",
  "anyways": "furthermore",
  "kind of": "somewhat", "sort of": "somewhat", "pretty much": "largely",
  "way more": "considerably more", "super": "highly", "awesome": "notable",
  "ok": "acceptable", "okay": "acceptable",
};

/** Heavy words with an everyday equivalent that means the same thing. */
const PLAIN_SWAPS: Record<string, string> = {
  utilise: "use", utilize: "use", utilised: "used", utilized: "used",
  commence: "start", commenced: "started", terminate: "end", terminated: "ended",
  endeavour: "try", endeavor: "try", ascertain: "find out",
  facilitate: "help", facilitates: "helps", demonstrate: "show",
  demonstrates: "shows", demonstrated: "showed", indicate: "show",
  indicates: "shows", sufficient: "enough", additional: "extra",
  approximately: "about", subsequently: "later", previously: "before",
  currently: "now", numerous: "many", obtain: "get", obtained: "got",
  purchase: "buy", purchased: "bought", require: "need", requires: "needs",
  required: "needed", assist: "help", assists: "helps", assisted: "helped",
  attempt: "try", attempted: "tried", inquire: "ask", initiate: "start",
  implement: "carry out", modify: "change", modified: "changed",
  eliminate: "remove", eliminated: "removed", methodology: "method",
  functionality: "features", accordingly: "so", nevertheless: "even so",
  notwithstanding: "despite", furthermore: "also", moreover: "also",
  consequently: "so", regarding: "about", concerning: "about",
  prioritise: "rank", prioritize: "rank", optimal: "best",
  fundamental: "basic", component: "part", component_s: "parts",
  individuals: "people", personnel: "staff", residence: "home",
  transmit: "send", transmitted: "sent", anticipate: "expect",
  ameliorate: "improve", disseminate: "share", proliferate: "spread",
};

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function buildPattern(keys: string[]): RegExp {
  const body = keys
    .filter((k) => !k.includes("_"))
    .sort((a, b) => b.length - a.length)
    .map((k) => escape(k).replace(/\\?\s+/g, "\\s+"))
    .join("|");
  return new RegExp(`\\b(${body})\\b`, "gi");
}

interface Substitution {
  pattern: RegExp;
  lookup: (key: string) => string | undefined;
  reason: string;
}

/**
 * Applies substitutions right to left so earlier offsets stay valid, then
 * reports the changes left to right, which is the order a reader expects.
 */
function substitute(text: string, subs: Substitution[]): RewriteResult {
  const pending: Change[] = [];

  for (const sub of subs) {
    const pattern = new RegExp(sub.pattern.source, sub.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) { pattern.lastIndex += 1; continue; }
      const key = match[1].toLowerCase().replace(/\s+/g, " ");
      const value = sub.lookup(key);
      if (value === undefined) continue;
      const start = match.index;
      const end = start + match[0].length;
      // One edit per span; the first rule to claim it wins.
      if (pending.some((c) => c.start < end && start < c.end)) continue;
      pending.push({
        from: match[0],
        to: value === "" ? "" : matchCase(match[0], value),
        reason: sub.reason,
        start,
        end,
      });
    }
  }

  pending.sort((a, b) => b.start - a.start);
  let output = text;
  for (const change of pending) {
    const before = output.slice(0, change.start);
    const after = output.slice(change.end);
    if (change.to === "") {
      // Deleting a word must not leave a double space or a space before a comma.
      output = (before + after).replace(/ {2,}/g, " ").replace(/\s+([,.;:])/g, "$1");
    } else {
      output = before + change.to + after;
    }
  }

  const countWords = (t: string) => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

  return {
    text: output.replace(/ {2,}/g, " ").trim(),
    changes: pending.sort((a, b) => a.start - b.start),
    wordsBefore: countWords(text),
    wordsAfter: countWords(output),
  };
}

const WORDY_SUB: Substitution = {
  pattern: buildPattern(Object.keys(WORDY)),
  lookup: (key) => WORDY[key],
  reason: "Shorter phrasing, same meaning",
};

const NOMINALISATION_SUB: Substitution = {
  pattern: buildPattern(Object.keys(NOMINALISATIONS)),
  lookup: (key) => NOMINALISATIONS[key],
  reason: "The verb is stronger than the noun phrase",
};

const FILLER_SUB: Substitution = {
  pattern: new RegExp(`\\b(${FILLER.join("|")})\\s`, "gi"),
  lookup: (key) => (FILLER.includes(key.trim()) ? "" : undefined),
  reason: "Adds length without adding meaning",
};

const EXPANSION_SUB: Substitution = {
  pattern: new RegExp(
    `(${Object.keys(EXPANSIONS).map((k) => escape(k).replace(/'/g, "['’]")).join("|")})\\b`,
    "gi",
  ),
  lookup: (key) => EXPANSIONS[key.replace(/[’]/g, "'")],
  reason: "Academic style asks for full forms",
};

const FORMAL_SUB: Substitution = {
  pattern: buildPattern(Object.keys(FORMAL_SWAPS)),
  lookup: (key) => FORMAL_SWAPS[key],
  reason: "More precise in formal writing",
};

const PLAIN_SUB: Substitution = {
  pattern: buildPattern(Object.keys(PLAIN_SWAPS)),
  lookup: (key) => PLAIN_SWAPS[key],
  reason: "Everyday word, same meaning",
};

export function rewrite(text: string, mode: RewriteMode): RewriteResult {
  if (!text.trim()) {
    return { text: "", changes: [], wordsBefore: 0, wordsAfter: 0 };
  }
  switch (mode) {
    case "concise":
      return substitute(text, [WORDY_SUB, NOMINALISATION_SUB, FILLER_SUB]);
    case "formal":
      return substitute(text, [EXPANSION_SUB, FORMAL_SUB, WORDY_SUB]);
    case "simple":
      return substitute(text, [PLAIN_SUB, WORDY_SUB, NOMINALISATION_SUB]);
    case "active":
      // Active voice cannot be rewritten mechanically — it needs to know who
      // did the thing — so this mode reports rather than edits.
      return { text, changes: [], wordsBefore: 0, wordsAfter: 0 };
  }
}

export interface SentenceSuggestion {
  sentence: string;
  start: number;
  end: number;
  kind: "split" | "passive" | "opener" | "synonym";
  advice: string;
  /** Alternative wordings the writer chooses between. */
  options: string[];
}

/** Word-level alternatives, offered rather than applied. */
export function synonymOptions(text: string): SentenceSuggestion[] {
  const suggestions: SentenceSuggestion[] = [];
  const pattern = /[\p{L}][\p{L}'’-]*/gu;
  let match: RegExpExecArray | null;
  const used = new Set<string>();
  while ((match = pattern.exec(text)) !== null) {
    const key = match[0].toLowerCase();
    const options = SYNONYMS[key];
    if (!options || used.has(key)) continue;
    used.add(key);
    suggestions.push({
      sentence: match[0],
      start: match.index,
      end: match.index + match[0].length,
      kind: "synonym",
      advice: `Alternatives to "${match[0]}"`,
      options: options.map((option) => matchCase(match![0], option)),
    });
  }
  return suggestions;
}

/** Long sentences, with the joins where they could reasonably be split. */
export function splitSuggestions(text: string, limit = 28): SentenceSuggestion[] {
  return splitSentences(text)
    .filter((sentence) => sentence.words.length > limit)
    .map((sentence) => {
      const joins = [...sentence.text.matchAll(/,\s+(?:and|but|which|while|although|because|so)\s/gi)]
        .map((m) => m[0].trim());
      return {
        sentence: sentence.text,
        start: sentence.start,
        end: sentence.end,
        kind: "split" as const,
        advice: joins.length
          ? `${sentence.words.length} words. Natural break at "${joins[0]}".`
          : `${sentence.words.length} words, with no obvious join. Consider what the main claim is and give it its own sentence.`,
        options: joins,
      };
    });
}
