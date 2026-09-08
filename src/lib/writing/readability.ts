import { countSyllables, isComplex } from "./syllables";

/**
 * The standard readability formulas, implemented exactly as published.
 *
 * They disagree with each other by design — each was calibrated on a different
 * corpus for a different purpose — so all six are reported rather than one
 * invented composite. A single "readability score" that averages them would be
 * a number nobody could check against anything.
 */

export interface TextUnits {
  words: string[];
  sentences: string[];
  syllables: number;
  complexWords: number;
  characters: number;
  polysyllables: number;
}

export function measure(text: string): TextUnits {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  const sentences = (text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[\p{L}\p{N}]/u.test(s));

  return {
    words,
    sentences,
    syllables: words.reduce((n, w) => n + countSyllables(w), 0),
    complexWords: words.filter(isComplex).length,
    characters: words.join("").length,
    polysyllables: words.filter((w) => countSyllables(w) >= 3).length,
  };
}

export interface ReadabilityScores {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFog: number;
  smog: number;
  colemanLiau: number;
  automatedReadability: number;
  /** Median of the five grade-level formulas, which is a defensible summary. */
  medianGrade: number;
  words: number;
  sentences: number;
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function readability(text: string): ReadabilityScores | null {
  const units = measure(text);
  const wordCount = units.words.length;
  const sentenceCount = units.sentences.length;

  // Below this the formulas are statistically meaningless — SMOG was
  // calibrated on 30-sentence samples and the others on continuous prose.
  if (wordCount < 10 || sentenceCount < 1) return null;

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = units.syllables / wordCount;

  const fleschReadingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const fleschKincaidGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const gunningFog = 0.4 * (wordsPerSentence + 100 * (units.complexWords / wordCount));
  // SMOG is defined for 30 sentences; scaling keeps it comparable on shorter text.
  const smog = 1.0430 * Math.sqrt(units.polysyllables * (30 / sentenceCount)) + 3.1291;

  const lettersPer100 = (units.characters / wordCount) * 100;
  const sentencesPer100 = (sentenceCount / wordCount) * 100;
  const colemanLiau = 0.0588 * lettersPer100 - 0.296 * sentencesPer100 - 15.8;

  const automatedReadability =
    4.71 * (units.characters / wordCount) + 0.5 * wordsPerSentence - 21.43;

  const grades = [fleschKincaidGrade, gunningFog, smog, colemanLiau, automatedReadability]
    .map((g) => Math.max(0, g))
    .sort((a, b) => a - b);

  return {
    fleschReadingEase: round(Math.max(0, Math.min(100, fleschReadingEase))),
    fleschKincaidGrade: round(Math.max(0, fleschKincaidGrade)),
    gunningFog: round(Math.max(0, gunningFog)),
    smog: round(Math.max(0, smog)),
    colemanLiau: round(Math.max(0, colemanLiau)),
    automatedReadability: round(Math.max(0, automatedReadability)),
    medianGrade: round(grades[2]),
    words: wordCount,
    sentences: sentenceCount,
    averageWordsPerSentence: round(wordsPerSentence),
    averageSyllablesPerWord: round(syllablesPerWord * 100) / 100,
  };
}

export function describeReadingEase(score: number): { label: string; audience: string; tone: string } {
  if (score >= 90) return { label: "Very easy", audience: "Around age 11", tone: "grass" };
  if (score >= 80) return { label: "Easy", audience: "Around age 12", tone: "grass" };
  if (score >= 70) return { label: "Fairly easy", audience: "Around age 13", tone: "grass" };
  if (score >= 60) return { label: "Plain English", audience: "Ages 13–15", tone: "sky" };
  if (score >= 50) return { label: "Fairly difficult", audience: "Ages 15–18", tone: "fire" };
  if (score >= 30) return { label: "Difficult", audience: "University level", tone: "fire" };
  return { label: "Very difficult", audience: "Graduate level", tone: "cherry" };
}

/** What the grade level means in plain terms. */
export function describeGrade(grade: number): string {
  if (grade <= 6) return "Readable by most people, including younger readers.";
  if (grade <= 9) return "The level most newspapers and general web writing aim for.";
  if (grade <= 12) return "Secondary school level — fine for an informed general audience.";
  if (grade <= 15) return "Undergraduate level. Appropriate for academic work, heavy for the web.";
  return "Postgraduate level. Consider shorter sentences unless the audience is specialist.";
}
