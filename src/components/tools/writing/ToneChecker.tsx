"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea, Select, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Stat, EmptyState, InfoNote } from "@/components/ui/Feedback";
import { analyseTone, toneAdvice } from "@/lib/writing/tone";
import { cn } from "@/lib/utils/cn";

const AXIS_META: Record<string, { label: string; icon: string; tone: string }> = {
  formal: { label: "Formal", icon: "🎓", tone: "grape" },
  casual: { label: "Casual", icon: "👋", tone: "sun" },
  confident: { label: "Confident", icon: "💪", tone: "grass" },
  tentative: { label: "Tentative", icon: "🤔", tone: "sky" },
  positive: { label: "Positive", icon: "🙂", tone: "grass" },
  negative: { label: "Critical", icon: "😐", tone: "cherry" },
  urgent: { label: "Urgent", icon: "⏰", tone: "fire" },
  friendly: { label: "Friendly", icon: "🤝", tone: "sun" },
};

/** A −100…+100 reading drawn as a marker on a two-ended scale. */
function Scale({
  value, left, right, label,
}: {
  value: number | null;
  left: string;
  right: string;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
        <span>{left}</span>
        <span className="normal-case tracking-normal text-[var(--ink)]">{label}</span>
        <span>{right}</span>
      </div>
      <div className="relative mt-1.5 h-3 rounded-full bg-gradient-to-r from-[var(--sky-soft)] via-[var(--panel)] to-[var(--grape-soft)]">
        {value === null ? (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-[var(--muted)]">
            not enough signal
          </span>
        ) : (
          <span
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bg)] bg-[var(--ink)]"
            style={{ left: `${((value + 100) / 200) * 100}%` }}
            aria-hidden
          />
        )}
      </div>
      {value !== null ? (
        <p className="mt-1 text-center text-xs font-bold tabular-nums text-[var(--muted)]">
          {value > 0 ? "+" : ""}{value}
        </p>
      ) : null}
    </div>
  );
}

export function ToneChecker() {
  const [text, setText] = React.useState("");
  const [target, setTarget] = React.useState<"academic" | "professional" | "friendly">("academic");
  const deferred = React.useDeferredValue(text);
  const report = React.useMemo(() => analyseTone(deferred), [deferred]);
  const advice = React.useMemo(() => (report ? toneAdvice(report, target) : []), [report, target]);

  return (
    <div className="space-y-4">
      <Card>
        <label htmlFor="tn-text" className="sr-only">Text to check</label>
        <Textarea
          id="tn-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste an email, essay, cover letter or message. At least 15 words."
          className="min-h-[200px] rounded-2xl border-0 focus:border-0"
        />
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <Label htmlFor="tn-target">Writing for</Label>
          <Select
            id="tn-target"
            value={target}
            onChange={(event) => setTarget(event.target.value as typeof target)}
          >
            <option value="academic">An essay or report</option>
            <option value="professional">Work or a cover letter</option>
            <option value="friendly">A message to a person</option>
          </Select>
        </div>
        <Button tone="ghost" onClick={() => setText("")} disabled={!text}>Clear</Button>
      </div>

      {!report ? (
        <EmptyState
          icon="🎭"
          title="Needs at least 15 words"
          description="Tone is measured from word choice, so a short phrase gives nothing to measure."
        />
      ) : (
        <>
          <Card className="p-6">
            <p className="text-center text-lg font-extrabold">{report.summary}</p>
            <p className="mt-1 text-center text-sm font-semibold text-[var(--muted)]">
              Based on {report.matched} tone signal{report.matched === 1 ? "" : "s"} in {report.words} words
              {report.confidence === "low" ? " — too few to rely on" : ""}.
            </p>
            <div className="mt-6 space-y-5">
              <Scale value={report.formality} left="Casual" right="Formal" label="Register" />
              <Scale value={report.certainty} left="Tentative" right="Confident" label="Certainty" />
              <Scale value={report.sentiment} left="Critical" right="Positive" label="Outlook" />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Words" value={String(report.words)} tone="sky" />
            <Stat label="Avg sentence" value={String(report.averageSentenceWords)} tone="grape" hint="words" />
            <Stat label="Questions" value={String(report.questions)} tone="grass" />
            <Stat label="Exclamations" value={String(report.exclamations)} tone={report.exclamations > 2 ? "fire" : "ink"} />
          </div>

          {report.signals.length > 0 ? (
            <Card className="p-5">
              <p className="text-sm font-extrabold">Which words drove the reading</p>
              <ul className="mt-3 space-y-3">
                {report.signals.map((signal) => {
                  const meta = AXIS_META[signal.axis];
                  return (
                    <li key={signal.axis}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-extrabold">
                          <span aria-hidden>{meta.icon}</span>
                          {meta.label}
                        </span>
                        <span className="text-sm font-black tabular-nums">{signal.score}%</span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]">
                        <div
                          className={cn("h-full rounded-full", `bg-[var(--${meta.tone})]`)}
                          style={{ width: `${signal.score}%` }}
                        />
                      </div>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {signal.hits.map((hit) => (
                          <span
                            key={hit}
                            className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-xs font-bold text-[var(--muted)]"
                          >
                            {hit}
                          </span>
                        ))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          <Card className="p-5">
            <p className="text-sm font-extrabold">How to move it closer</p>
            <ul className="mt-3 space-y-3">
              {advice.map((item) => (
                <li key={item.heading} className="rounded-2xl border-2 border-[var(--border)] p-3">
                  <p className="text-sm font-extrabold">{item.heading}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{item.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <InfoNote icon="🎭">
        <strong className="font-extrabold">This counts words, it does not read the room.</strong>{" "}
        Tone is estimated by matching your text against lists of words that tend to
        signal a register. It cannot detect sarcasm, humour, or the context you are
        writing into, and a text with few signal words will give a weak reading —
        which the tool says rather than guessing.
      </InfoNote>
    </div>
  );
}
