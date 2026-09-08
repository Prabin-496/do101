"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Stat, EmptyState, InfoNote } from "@/components/ui/Feedback";
import { describeGrade, describeReadingEase, readability } from "@/lib/writing/readability";
import { splitSentences } from "@/lib/writing/rules";
import { cn } from "@/lib/utils/cn";

const FORMULAS = [
  { key: "fleschKincaidGrade", name: "Flesch–Kincaid", note: "US school grade. The most widely quoted of the six." },
  { key: "gunningFog", name: "Gunning Fog", note: "Years of education needed for a first reading." },
  { key: "smog", name: "SMOG", note: "Built for health and safety material, where being misread matters." },
  { key: "colemanLiau", name: "Coleman–Liau", note: "Counts characters rather than syllables, so it treats names differently." },
  { key: "automatedReadability", name: "Automated Readability", note: "Character-based, designed for typed text." },
] as const;

export function ReadabilityAnalyser() {
  const [text, setText] = React.useState("");
  const deferred = React.useDeferredValue(text);
  const scores = React.useMemo(() => readability(deferred), [deferred]);
  const sentences = React.useMemo(() => splitSentences(deferred), [deferred]);

  const longest = React.useMemo(
    () => [...sentences].sort((a, b) => b.words.length - a.words.length).slice(0, 5),
    [sentences],
  );

  // Sentence-length variance is what makes prose feel rhythmic rather than flat,
  // and no single formula reports it.
  const variance = React.useMemo(() => {
    if (sentences.length < 2) return null;
    const lengths = sentences.map((s) => s.words.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const spread = Math.sqrt(
      lengths.reduce((total, n) => total + (n - mean) ** 2, 0) / lengths.length,
    );
    return { mean: Math.round(mean), spread: Math.round(spread * 10) / 10 };
  }, [sentences]);

  const ease = scores ? describeReadingEase(scores.fleschReadingEase) : null;

  return (
    <div className="space-y-4">
      <Card>
        <label htmlFor="rd-text" className="sr-only">Text to analyse</label>
        <Textarea
          id="rd-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste at least a paragraph. Readability formulas need roughly 100 words before they settle down."
          className="min-h-[220px] rounded-2xl border-0 focus:border-0"
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button tone="ghost" onClick={() => setText("")} disabled={!text}>Clear</Button>
      </div>

      {!scores ? (
        <EmptyState
          icon="📊"
          title="Needs a bit more text"
          description="At least ten words and one complete sentence, so the formulas have something to work with."
        />
      ) : (
        <>
          <Card className={cn("p-6 text-center", `bg-[var(--${ease!.tone}-soft)]`)}>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Flesch Reading Ease
            </p>
            <p className="mt-1 text-5xl font-black tabular-nums">
              {scores.fleschReadingEase}
              <span className="text-2xl text-[var(--muted)]">/100</span>
            </p>
            <p className="mt-2 text-lg font-extrabold">{ease!.label}</p>
            <p className="text-sm font-semibold text-[var(--muted)]">{ease!.audience}</p>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Words" value={String(scores.words)} tone="sky" />
            <Stat label="Sentences" value={String(scores.sentences)} tone="grape" />
            <Stat label="Words / sentence" value={String(scores.averageWordsPerSentence)} tone="fire" />
            <Stat label="Syllables / word" value={scores.averageSyllablesPerWord.toFixed(2)} tone="grass" />
          </div>

          <Card className="p-5">
            <p className="text-sm font-extrabold">Grade level, by formula</p>
            <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
              {describeGrade(scores.medianGrade)} The median of the five is{" "}
              <strong className="font-extrabold text-[var(--ink)]">grade {scores.medianGrade}</strong>.
            </p>
            <ul className="mt-4 space-y-3">
              {FORMULAS.map((formula) => {
                const value = scores[formula.key];
                const width = Math.min(100, (value / 20) * 100);
                return (
                  <li key={formula.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-extrabold">{formula.name}</span>
                      <span className="text-sm font-black tabular-nums">{value}</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]">
                      <div
                        className="h-full rounded-full bg-[var(--sky)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{formula.note}</p>
                  </li>
                );
              })}
            </ul>
          </Card>

          {variance ? (
            <Card className="p-5">
              <p className="text-sm font-extrabold">Sentence rhythm</p>
              <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                Average {variance.mean} words, varying by about {variance.spread}.{" "}
                {variance.spread < 4
                  ? "Sentences are all a similar length, which reads as monotonous. Mixing a short one in between long ones helps."
                  : variance.spread > 14
                    ? "Lengths swing widely. That can be effective, but check the longest ones are deliberate."
                    : "A healthy mix of long and short sentences."}
              </p>
              <div className="do-scroll mt-4 flex items-end gap-1 overflow-x-auto pb-1">
                {sentences.slice(0, 120).map((sentence, index) => (
                  <span
                    key={index}
                    title={`${sentence.words.length} words`}
                    className={cn(
                      "w-2 shrink-0 rounded-t",
                      sentence.words.length > 30
                        ? "bg-[var(--cherry)]"
                        : sentence.words.length > 20
                          ? "bg-[var(--fire)]"
                          : "bg-[var(--grass)]",
                    )}
                    style={{ height: `${Math.max(4, Math.min(64, sentence.words.length * 2))}px` }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                One bar per sentence. Green under 20 words, orange 21–30, red over 30.
              </p>
            </Card>
          ) : null}

          {longest.length > 0 && longest[0].words.length > 25 ? (
            <Card className="p-5">
              <p className="text-sm font-extrabold">Longest sentences</p>
              <ul className="mt-3 space-y-2">
                {longest
                  .filter((sentence) => sentence.words.length > 25)
                  .map((sentence, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border-2 border-[var(--border)] p-3 text-sm font-semibold"
                    >
                      <span className="mr-2 rounded-full bg-[var(--fire-soft)] px-2 py-0.5 text-xs font-extrabold text-[var(--fire-dark)] dark:text-[var(--fire)]">
                        {sentence.words.length} words
                      </span>
                      {sentence.text.slice(0, 220)}
                      {sentence.text.length > 220 ? "…" : ""}
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}

      <InfoNote icon="📐">
        <strong className="font-extrabold">These are formulas, not judgements.</strong>{" "}
        Every one of them measures word and sentence length as a proxy for difficulty.
        None of them can tell whether the writing is clear, accurate or well argued —
        a short sentence can still be confusing. Use them to spot passages worth
        rereading, not as a target to optimise.
      </InfoNote>
    </div>
  );
}
