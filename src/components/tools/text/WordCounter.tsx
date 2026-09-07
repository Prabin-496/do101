"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Stat } from "@/components/ui/Feedback";
import { analyzeText, keywordDensity } from "@/lib/text/stats";
import { formatNumber } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

function timeLabel(minutes: number): string {
  if (minutes <= 0) return "0 sec";
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return s ? `${m} min ${s} sec` : `${m} min`;
}

export function WordCounter() {
  const [text, setText] = React.useState("");
  const stats = React.useMemo(() => analyzeText(text), [text]);
  const keywords = React.useMemo(() => keywordDensity(text), [text]);
  const counted = React.useRef(false);

  React.useEffect(() => {
    if (!counted.current && stats.words > 5) {
      counted.current = true;
      track("tool_complete", { tool: "word-counter" });
    }
  }, [stats.words]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Words" value={formatNumber(stats.words, 0)} tone="grass" />
        <Stat label="Characters" value={formatNumber(stats.characters, 0)} tone="sky" />
        <Stat label="Sentences" value={formatNumber(stats.sentences, 0)} tone="grape" />
        <Stat label="Paragraphs" value={formatNumber(stats.paragraphs, 0)} tone="fire" />
      </div>

      <Card>
        <label htmlFor="wc-text" className="sr-only">
          Text to count
        </label>
        <Textarea
          id="wc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start typing or paste your text here — the counters update as you go."
          className="min-h-[240px] rounded-2xl border-0 focus:border-0"
          aria-describedby="wc-live"
        />
      </Card>

      <p id="wc-live" role="status" aria-live="polite" className="sr-only">
        {stats.words} words, {stats.characters} characters.
      </p>

      <div className="flex flex-wrap gap-2">
        <CopyButton value={text} label="Copy text" disabled={!text} />
        <Button tone="ghost" onClick={() => setText("")} disabled={!text}>
          Clear
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Characters (no spaces)" value={formatNumber(stats.charactersNoSpaces, 0)} />
        <Stat label="Reading time" value={timeLabel(stats.readingTimeMinutes)} hint="≈225 wpm" />
        <Stat label="Speaking time" value={timeLabel(stats.speakingTimeMinutes)} hint="≈130 wpm" />
        <Stat
          label="Avg word length"
          value={stats.words ? `${stats.averageWordLength.toFixed(1)}` : "0"}
          hint="characters"
        />
      </div>

      {keywords.length > 0 ? (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Top keywords
          </h3>
          <ul className="space-y-2">
            {keywords.map((k) => (
              <li key={k.word} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm font-extrabold">{k.word}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--panel-2)]">
                  <span
                    className="block h-full rounded-full bg-[var(--sky)]"
                    style={{ width: `${Math.min(100, k.density * 400)}%` }}
                  />
                </span>
                <span className="w-24 text-right text-xs font-extrabold text-[var(--muted)]">
                  {k.count}× · {(k.density * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
