import { TONE_LEXICON } from "./lexicon";
import { splitSentences } from "./rules";

/**
 * Tone estimation by lexicon counting.
 *
 * This is a word-frequency measure, not comprehension: it counts signals that
 * correlate with a tone and reports the balance. It cannot detect sarcasm,
 * context or intent, and the UI says so rather than presenting the output as a
 * verdict. Scores are shares of the signal words found, so a text with no
 * signal words returns nothing instead of a fabricated neutral reading.
 */

export type ToneAxis = keyof typeof TONE_LEXICON;

export interface ToneSignal {
  axis: ToneAxis;
  /** 0–100 share of matched signal words on this axis. */
  score: number;
  hits: string[];
}

export interface ToneReport {
  signals: ToneSignal[];
  /** Total signal words found. Low counts mean the reading is weak. */
  matched: number;
  words: number;
  /** Formality on a -100 (casual) to +100 (formal) scale, or null if unclear. */
  formality: number | null;
  /** Certainty on a -100 (tentative) to +100 (confident) scale, or null. */
  certainty: number | null;
  /** Sentiment on a -100 (negative) to +100 (positive) scale, or null. */
  sentiment: number | null;
  summary: string;
  confidence: "low" | "moderate" | "good";
  /** Sentences that carry the strongest tone signal, for the UI to highlight. */
  exclamations: number;
  questions: number;
  averageSentenceWords: number;
}

const PATTERNS: Record<string, RegExp> = Object.fromEntries(
  Object.entries(TONE_LEXICON).map(([axis, words]) => [
    axis,
    new RegExp(
      `\\b(${[...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/\s+/g, "\\s+")).join("|")})\\b`,
      "gi",
    ),
  ]),
);

/** Turns two opposing axis counts into a single signed score. */
function axisBalance(a: number, b: number): number | null {
  const total = a + b;
  if (total < 2) return null;
  return Math.round(((a - b) / total) * 100);
}

export function analyseTone(text: string): ToneReport | null {
  const words = text.match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
  if (words.length < 15) return null;

  const counts: Record<string, string[]> = {};
  let matched = 0;
  for (const [axis, pattern] of Object.entries(PATTERNS)) {
    const found = text.match(pattern) ?? [];
    counts[axis] = found.map((f) => f.toLowerCase());
    matched += found.length;
  }

  const signals: ToneSignal[] = Object.entries(counts)
    .map(([axis, hits]) => ({
      axis: axis as ToneAxis,
      score: matched === 0 ? 0 : Math.round((hits.length / matched) * 100),
      hits: [...new Set(hits)].slice(0, 8),
    }))
    .filter((signal) => signal.hits.length > 0)
    .sort((a, b) => b.score - a.score);

  const sentences = splitSentences(text);
  const formality = axisBalance(counts.formal.length, counts.casual.length);
  const certainty = axisBalance(counts.confident.length, counts.tentative.length);
  const sentiment = axisBalance(counts.positive.length, counts.negative.length);

  const confidence: ToneReport["confidence"] =
    matched >= 12 ? "good" : matched >= 5 ? "moderate" : "low";

  return {
    signals,
    matched,
    words: words.length,
    formality,
    certainty,
    sentiment,
    confidence,
    summary: describeTone(formality, certainty, sentiment, confidence),
    exclamations: (text.match(/!/g) ?? []).length,
    questions: (text.match(/\?/g) ?? []).length,
    averageSentenceWords: sentences.length
      ? Math.round(words.length / sentences.length)
      : words.length,
  };
}

function describeTone(
  formality: number | null,
  certainty: number | null,
  sentiment: number | null,
  confidence: ToneReport["confidence"],
): string {
  if (confidence === "low") {
    return "Too few tone signals to read reliably. Longer text gives a clearer picture.";
  }
  const parts: string[] = [];
  if (formality !== null) {
    if (formality > 40) parts.push("formal");
    else if (formality > 10) parts.push("fairly formal");
    else if (formality < -40) parts.push("casual");
    else if (formality < -10) parts.push("fairly casual");
    else parts.push("neutral in register");
  }
  if (certainty !== null) {
    if (certainty > 40) parts.push("confident");
    else if (certainty < -40) parts.push("tentative");
    else parts.push("measured");
  }
  if (sentiment !== null) {
    if (sentiment > 40) parts.push("positive");
    else if (sentiment < -40) parts.push("critical");
  }
  if (parts.length === 0) return "No clear tone signal either way.";
  return `Reads as ${parts.join(", ")}.`;
}

export interface ToneAdvice {
  heading: string;
  body: string;
}

/** Concrete, checkable advice for moving the text towards a target register. */
export function toneAdvice(report: ToneReport, target: "academic" | "professional" | "friendly"): ToneAdvice[] {
  const advice: ToneAdvice[] = [];

  if (target === "academic") {
    if ((report.formality ?? 0) < 20) {
      advice.push({
        heading: "Lift the register",
        body: "Replace casual words such as \"stuff\", \"a lot\" and \"get\" with precise alternatives, and write contractions out in full.",
      });
    }
    if ((report.certainty ?? 0) > 60) {
      advice.push({
        heading: "Soften absolute claims",
        body: "Words like \"proves\", \"always\" and \"never\" are hard to defend. \"Indicates\", \"suggests\" and \"in this sample\" are safer and still strong.",
      });
    }
    if ((report.certainty ?? 0) < -50) {
      advice.push({
        heading: "Commit to your argument",
        body: "Heavy hedging (\"might perhaps possibly\") reads as uncertainty about your own findings. State the claim, then qualify it once.",
      });
    }
    if (report.exclamations > 0) {
      advice.push({
        heading: "Remove exclamation marks",
        body: `There ${report.exclamations === 1 ? "is 1" : `are ${report.exclamations}`} in the text. Academic prose carries emphasis through word choice instead.`,
      });
    }
  }

  if (target === "professional") {
    if ((report.formality ?? 0) < -20) {
      advice.push({ heading: "Tighten the register", body: "Aim between casual and academic: plain words, full sentences, no slang." });
    }
    if ((report.sentiment ?? 0) < -50) {
      advice.push({ heading: "Balance the negatives", body: "The wording leans critical. Naming what would fix the problem keeps the message constructive." });
    }
    if (report.averageSentenceWords > 25) {
      advice.push({ heading: "Shorten sentences", body: `Averaging ${report.averageSentenceWords} words a sentence. Under 20 reads faster on screen.` });
    }
  }

  if (target === "friendly") {
    if ((report.formality ?? 0) > 40) {
      advice.push({ heading: "Warm it up", body: "Contractions, \"you\" and shorter sentences make writing sound like a person rather than a policy." });
    }
    if ((report.sentiment ?? 0) < 0) {
      advice.push({ heading: "Lead with the positive", body: "Open with what works or what you can do, then raise the problem." });
    }
  }

  if (advice.length === 0) {
    advice.push({
      heading: "Already close to the target",
      body: "Nothing in the tone signals stands out as working against this register.",
    });
  }
  return advice;
}
