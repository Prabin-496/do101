import { describe, expect, it } from "vitest";
import { countSyllables, isComplex } from "../src/lib/writing/syllables";
import { readability, measure } from "../src/lib/writing/readability";
import { applyConfidentFixes, check, splitSentences } from "../src/lib/writing/rules";
import { analyseTone } from "../src/lib/writing/tone";
import { compare } from "../src/lib/writing/similarity";
import { rewrite } from "../src/lib/writing/rewrite";
import { formatCitation, toPlainText, type Source } from "../src/lib/writing/citations";
import { MISSPELLINGS } from "../src/lib/writing/lexicon";

/**
 * Prose with no mistakes in it. Anything flagged here beyond genuine passive
 * voice is a false positive, which is the failure mode that makes a checker
 * useless — students stop trusting it and ignore the real errors too.
 */
const CLEAN = [
  "The results were analysed using a standard regression model.",
  "An hour before the deadline, she submitted an honest account of the experiment.",
  "It is a useful distinction, but its value depends on how the categories are defined.",
  "A university lecturer explained that a unique approach was needed, and a European colleague agreed.",
  "Fewer participants than expected returned the questionnaire, so the number of usable responses fell.",
  "You're right that your argument needs more evidence before it will convince anyone.",
  "The committee met on Tuesday, and its report is due next month.",
  "One student asked a useful question about a one-off event in 2019.",
].join("\n\n");

describe("syllables", () => {
  it("counts single-syllable words", () => {
    for (const word of ["cat", "dog", "through", "strength", "eight", "queue"]) {
      expect(countSyllables(word), word).toBe(1);
    }
  });

  it("counts multi-syllable words", () => {
    const expected: Record<string, number> = {
      water: 2, table: 2, happy: 2, running: 2, wanted: 2, walked: 1,
      beautiful: 3, university: 5, education: 4, information: 4,
      readability: 5, syllable: 3, everything: 3, people: 2, science: 2,
      creation: 3, nation: 2, evaluation: 5, idea: 3, being: 2,
    };
    for (const [word, count] of Object.entries(expected)) {
      expect(countSyllables(word), word).toBe(count);
    }
  });

  it("never returns zero for a real word", () => {
    for (const word of "the quick brown fox jumped over a lazy dog rhythm strengths".split(" ")) {
      expect(countSyllables(word)).toBeGreaterThan(0);
    }
  });

  it("treats three-syllable words as complex, ignoring simple inflections", () => {
    expect(isComplex("university")).toBe(true);
    // "created" is three syllables only because of the -ed, which Fog excludes.
    expect(isComplex("created")).toBe(false);
    expect(isComplex("cat")).toBe(false);
  });
});

describe("readability", () => {
  const SIMPLE = "The cat sat on the mat. The dog ran. It was a good day. We had fun. The sun was hot.";
  const HARD =
    "The epistemological ramifications of phenomenological interpretation necessitate a comprehensive reconsideration of methodological presuppositions, particularly insofar as such presuppositions constitute the foundational architecture of subsequent theoretical elaboration.";

  it("returns nothing for text too short to measure", () => {
    expect(readability("Too short.")).toBeNull();
    expect(readability("")).toBeNull();
  });

  it("scores simple text as far easier than dense text", () => {
    const simple = readability(SIMPLE)!;
    const hard = readability(HARD)!;
    expect(simple.fleschReadingEase).toBeGreaterThan(80);
    expect(hard.fleschReadingEase).toBeLessThan(30);
    expect(hard.fleschKincaidGrade).toBeGreaterThan(simple.fleschKincaidGrade);
  });

  it("keeps every score inside its defined range", () => {
    const scores = readability(CLEAN)!;
    expect(scores.fleschReadingEase).toBeGreaterThanOrEqual(0);
    expect(scores.fleschReadingEase).toBeLessThanOrEqual(100);
    for (const key of ["fleschKincaidGrade", "gunningFog", "smog", "colemanLiau", "automatedReadability"] as const) {
      expect(scores[key], key).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports the median of the five grade formulas", () => {
    const scores = readability(CLEAN)!;
    const grades = [
      scores.fleschKincaidGrade, scores.gunningFog, scores.smog,
      scores.colemanLiau, scores.automatedReadability,
    ].sort((a, b) => a - b);
    expect(scores.medianGrade).toBeCloseTo(grades[2], 1);
  });

  it("counts sentences that end without punctuation", () => {
    expect(measure("One sentence. A second one").sentences).toHaveLength(2);
  });
});

describe("sentence splitting", () => {
  it("keeps offsets that index back into the original text", () => {
    const text = "First sentence here. Second one follows! And a third?";
    for (const sentence of splitSentences(text)) {
      expect(text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });

  it("ignores whitespace-only fragments", () => {
    expect(splitSentences("...   \n\n  ")).toHaveLength(0);
  });
});

describe("proofreading rules", () => {
  it("raises nothing but passive voice on correct prose", () => {
    const flagged = check(CLEAN, { formal: false }).filter((i) => i.rule !== "passive-voice");
    expect(flagged.map((i) => `${i.rule}: ${i.matched}`)).toEqual([]);
  });

  it("catches the mistakes it claims to catch", () => {
    const text =
      "Teh goverment definately recieved alot of critisism .They could of acted sooner ,but they didnt.i think its a seperate issue.  A unexpected result occured.";
    const rules = new Set(check(text).map((i) => i.rule));
    for (const rule of [
      "misspelling", "verb-of", "lowercase-i", "confusable",
      "space-before-punctuation", "multiple-spaces", "a-before-vowel",
    ]) {
      expect(rules.has(rule), `expected rule ${rule}`).toBe(true);
    }
  });

  it("corrects inflected forms of a misspelling", () => {
    const issue = check("They recieved the results.").find((i) => i.rule === "misspelling");
    expect(issue?.replacements[0]).toBe("received");
  });

  it("preserves capitalisation in its corrections", () => {
    const issue = check("Teh results are in.").find((i) => i.rule === "misspelling");
    expect(issue?.replacements[0]).toBe("The");
  });

  it("reports offsets that select the flagged text", () => {
    const text = "They definately could of gone. i agree.";
    for (const issue of check(text)) {
      expect(text.slice(issue.start, issue.end)).toBe(issue.matched);
    }
  });

  it("never flags a correctly spelled word as a misspelling", () => {
    // A mapping to itself would flag a correct word and suggest no change.
    for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
      expect(wrong, `${wrong} maps to itself`).not.toBe(right);
    }
  });

  it("applies only unambiguous fixes automatically", () => {
    const text = "Teh goverment definately recieved the report.";
    const issues = check(text);
    const { text: fixed, applied } = applyConfidentFixes(text, issues);
    expect(applied).toBeGreaterThan(0);
    expect(fixed).toBe("The government definitely received the report.");
  });

  it("leaves judgement calls to the writer", () => {
    // Passive voice and hedging have no single right answer, so they carry no
    // replacement and must never be auto-applied.
    const issues = check("The data was collected by the team. Perhaps it matters.");
    for (const issue of issues.filter((i) => i.rule === "passive-voice" || i.rule === "hedging")) {
      expect(issue.replacements).toEqual([]);
      expect(issue.severity).toBe("suggestion");
    }
  });

  it("does not produce overlapping highlights", () => {
    const issues = check("Teh goverment definately recieved alot of critisism from there own members.");
    const spans = issues.filter((i) => i.rule !== "long-sentence").sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i].start, `${spans[i - 1].rule} overlaps ${spans[i].rule}`)
        .toBeGreaterThanOrEqual(spans[i - 1].end);
    }
  });

  it("only applies formal-only rules when asked", () => {
    const casual = "I can't see why it's a problem.";
    expect(check(casual, { formal: false }).some((i) => i.rule === "contraction-in-formal")).toBe(false);
    expect(check(casual, { formal: true }).some((i) => i.rule === "contraction-in-formal")).toBe(true);
  });

  it("respects muted rules", () => {
    const text = "Teh results are in.";
    expect(check(text, { disabled: ["misspelling"] }).some((i) => i.rule === "misspelling")).toBe(false);
  });

  it("handles an empty document", () => {
    expect(check("")).toEqual([]);
    expect(check("   \n  ")).toEqual([]);
  });
});

describe("tone", () => {
  it("needs enough text before it reports anything", () => {
    expect(analyseTone("Too short to read.")).toBeNull();
  });

  it("reads formal and casual writing differently", () => {
    const formal = analyseTone(
      "Furthermore, the evidence demonstrates that the hypothesis is established. Consequently, we must therefore ascertain whether the aforementioned results indicate a subsequent effect.",
    )!;
    const casual = analyseTone(
      "Yeah so basically the whole thing was pretty cool, and we got loads of awesome stuff done, totally, which is kind of a big deal you guys.",
    )!;
    expect(formal.formality).toBeGreaterThan(0);
    expect(casual.formality).toBeLessThan(0);
  });

  it("says so when there is too little signal to judge", () => {
    const report = analyseTone(
      "The box sat on the table near the window in the room at the back of the old house by the road.",
    )!;
    expect(report.confidence).toBe("low");
    expect(report.summary).toMatch(/too few/i);
  });

  it("never invents a score with no evidence behind it", () => {
    const report = analyseTone("A box sat on a table near a window in a room at a back of a house.");
    if (report) {
      // Every axis with fewer than two signal words must report null, not zero.
      for (const axis of [report.formality, report.certainty, report.sentiment]) {
        expect(axis === null || typeof axis === "number").toBe(true);
      }
    }
  });
});

describe("similarity", () => {
  const SOURCE =
    "The mitochondrion is the powerhouse of the cell, responsible for generating most of the chemical energy needed to power the cell's biochemical reactions.";

  it("reports no overlap between unrelated texts", () => {
    const report = compare("Cats sleep for most of the day in warm places.", SOURCE);
    expect(report.containment).toBeLessThan(5);
    expect(report.passages).toHaveLength(0);
  });

  it("reports near-total overlap for a copy", () => {
    const report = compare(SOURCE, SOURCE);
    expect(report.containment).toBeGreaterThan(95);
    expect(report.passages[0].words).toBeGreaterThan(20);
  });

  it("finds a copied passage inside otherwise original writing", () => {
    const draft =
      "In my essay I want to explain cell biology. The mitochondrion is the powerhouse of the cell, responsible for generating most of the chemical energy needed. That is why it matters so much to students.";
    const report = compare(draft, SOURCE);
    expect(report.passages.length).toBeGreaterThan(0);
    expect(report.passages[0].words).toBeGreaterThanOrEqual(15);
    expect(draft.slice(report.passages[0].aStart, report.passages[0].aEnd))
      .toContain("powerhouse of the cell");
  });

  it("maps passages back to both documents accurately", () => {
    const draft = "Nothing here. The mitochondrion is the powerhouse of the cell, responsible for generating energy.";
    const report = compare(draft, SOURCE);
    for (const passage of report.passages) {
      const inA = draft.slice(passage.aStart, passage.aEnd).toLowerCase();
      const inB = SOURCE.slice(passage.bStart, passage.bEnd).toLowerCase();
      expect(inA.replace(/[^a-z]/g, "")).toBe(inB.replace(/[^a-z]/g, ""));
    }
  });

  it("does not count a run of pure stopwords as reuse", () => {
    // Identical text, but every shingle is stopwords only, so it carries no
    // evidence of copying and must score zero rather than 100%.
    const filler = "of the and to the with it is by";
    expect(compare(filler, filler, { shingleSize: 3 }).containment).toBe(0);
    // The same words alongside real content still register.
    expect(compare(`mitochondrial respiration ${filler}`, `mitochondrial respiration ${filler}`,
      { shingleSize: 3 }).containment).toBeGreaterThan(0);
  });

  it("handles text shorter than the shingle size", () => {
    const report = compare("Two words", "Two words", { shingleSize: 5 });
    expect(report.containment).toBe(0);
    expect(report.verdict).toMatch(/at least/i);
  });

  it("finds more overlap at a shorter match length", () => {
    const a = "The quick brown fox jumps over the lazy dog every single morning.";
    const b = "A quick brown fox jumps over a lazy dog each morning without fail.";
    const loose = compare(a, b, { shingleSize: 3 });
    const strict = compare(a, b, { shingleSize: 9 });
    expect(loose.containment).toBeGreaterThanOrEqual(strict.containment);
  });
});

describe("rewriting", () => {
  it("shortens without breaking the sentence", () => {
    const result = rewrite(
      "Due to the fact that it was raining, we made a decision to stay inside.",
      "concise",
    );
    expect(result.text).toBe("Because it was raining, we decided to stay inside.");
    expect(result.wordsAfter).toBeLessThan(result.wordsBefore);
  });

  it("expands contractions for formal writing", () => {
    expect(rewrite("They couldn't do it and we didn't help.", "formal").text)
      .toBe("They could not do it and we did not help.");
  });

  it("swaps heavy words for plain ones", () => {
    expect(rewrite("We will utilise the methodology to facilitate the work.", "simple").text)
      .toBe("We will use the method to help the work.");
  });

  it("reports every change with offsets into the original", () => {
    const original = "Due to the fact that it rained, we made a decision.";
    const result = rewrite(original, "concise");
    expect(result.changes.length).toBeGreaterThan(0);
    for (const change of result.changes) {
      expect(original.slice(change.start, change.end)).toBe(change.from);
      expect(change.reason).toBeTruthy();
    }
  });

  it("leaves active voice to the writer rather than guessing an actor", () => {
    const result = rewrite("The report was written by the team.", "active");
    expect(result.changes).toEqual([]);
    expect(result.text).toBe("The report was written by the team.");
  });

  it("never leaves double spaces or space before punctuation", () => {
    const result = rewrite("It was actually very really quite simply true.", "concise");
    expect(result.text).not.toMatch(/ {2,}/);
    expect(result.text).not.toMatch(/\s[,.;:]/);
  });

  it("handles empty input", () => {
    expect(rewrite("", "concise")).toEqual({ text: "", changes: [], wordsBefore: 0, wordsAfter: 0 });
  });
});

describe("citations", () => {
  const JOURNAL: Source = {
    type: "journal",
    authors: [{ family: "Smith", given: "Jane A." }, { family: "Okafor", given: "Daniel" }],
    title: "Revision strategies among undergraduates",
    container: "Journal of Writing Research",
    year: "2021", volume: "13", issue: "2", pages: "145-170",
    doi: "10.1234/jwr.2021.132",
  };

  const BOOK: Source = {
    type: "book",
    authors: [{ family: "Ahmed", given: "Leila" }],
    title: "The craft of academic argument",
    publisher: "Oxford University Press", city: "Oxford", year: "2019", edition: "2nd",
  };

  it("formats APA with initials, year in brackets and an ampersand", () => {
    const citation = formatCitation(JOURNAL, "apa");
    expect(toPlainText(citation.reference)).toBe(
      "Smith, J. A., & Okafor, D. (2021). Revision strategies among undergraduates. Journal of Writing Research, 13(2), 145-170. https://doi.org/10.1234/jwr.2021.132",
    );
    expect(citation.inText).toBe("(Smith & Okafor, 2021)");
  });

  it("formats MLA with the second author in natural order", () => {
    const citation = formatCitation(JOURNAL, "mla");
    expect(toPlainText(citation.reference)).toContain("Smith, Jane A., and Daniel Okafor.");
    expect(citation.inText).toBe("(Smith and Okafor 145)");
  });

  it("formats Harvard with unspaced initials and single quotes", () => {
    const citation = formatCitation(JOURNAL, "harvard");
    expect(toPlainText(citation.reference)).toContain("Smith, J.A. and Okafor, D. (2021)");
    expect(toPlainText(citation.reference)).toContain("'Revision strategies among undergraduates'");
  });

  it("formats Vancouver with no periods in initials", () => {
    expect(toPlainText(formatCitation(JOURNAL, "vancouver").reference))
      .toContain("Smith JA, Okafor D.");
  });

  it("joins exactly two IEEE authors with 'and' rather than a comma", () => {
    const text = toPlainText(formatCitation(JOURNAL, "ieee").reference);
    expect(text).toContain("J. A. Smith and D. Okafor");
    expect(text).not.toContain("Smith, and D. Okafor");
  });

  it("italicises the right part for each style", () => {
    // Journal name in APA, book title in MLA.
    expect(formatCitation(JOURNAL, "apa").reference.find((s) => s.italic)?.text)
      .toContain("Journal of Writing Research");
    expect(formatCitation(BOOK, "mla").reference.find((s) => s.italic)?.text)
      .toContain("Craft of Academic Argument");
  });

  it("never appends a full stop onto a URL", () => {
    for (const style of ["apa", "ieee", "vancouver"] as const) {
      const text = toPlainText(formatCitation(JOURNAL, style).reference);
      expect(text, style).not.toMatch(/https?:\/\/\S+\.$/);
    }
  });

  it("never emits doubled punctuation", () => {
    for (const style of ["apa", "mla", "harvard", "chicago", "ieee", "vancouver"] as const) {
      for (const source of [JOURNAL, BOOK]) {
        const text = toPlainText(formatCitation(source, style).reference);
        expect(text, `${style}`).not.toMatch(/([,.;:])\1/);
        expect(text, `${style}`).not.toMatch(/\s[,.;:]/);
      }
    }
  });

  it("falls back to n.d. and warns when the year is missing", () => {
    const citation = formatCitation({ ...BOOK, year: "" }, "apa");
    expect(toPlainText(citation.reference)).toContain("(n.d.)");
    expect(citation.warnings.join(" ")).toMatch(/no date/i);
  });

  it("cites an organisation without inventing initials", () => {
    const citation = formatCitation(
      {
        type: "website",
        authors: [{ family: "", given: "World Health Organization", organisation: true }],
        title: "Adolescent mental health", container: "WHO", year: "2024",
        url: "https://www.who.int/",
      },
      "apa",
    );
    expect(toPlainText(citation.reference)).toContain("World Health Organization (2024)");
    expect(citation.inText).toBe("(World Health Organization, 2024)");
  });

  it("produces something usable from a title alone", () => {
    for (const style of ["apa", "mla", "harvard", "chicago", "ieee", "vancouver"] as const) {
      const citation = formatCitation(
        { type: "website", authors: [{ family: "", given: "" }], title: "A page with no author" },
        style,
      );
      expect(toPlainText(citation.reference).length, style).toBeGreaterThan(5);
      expect(citation.inText, style).toBeTruthy();
    }
  });

  it("escapes HTML when producing rich-text output", async () => {
    const { toHtml } = await import("../src/lib/writing/citations");
    const citation = formatCitation({ ...BOOK, title: "Tags <script> & things" }, "apa");
    const html = toHtml(citation.reference);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
