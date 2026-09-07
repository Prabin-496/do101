"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Stat } from "@/components/ui/Feedback";
import { analyzeText } from "@/lib/text/stats";
import { formatBytes, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const LIMITS = [
  { label: "X / Twitter post", limit: 280, note: "Standard account limit" },
  { label: "SEO title", limit: 60, note: "Before Google truncates" },
  { label: "Meta description", limit: 155, note: "Typical desktop snippet" },
  { label: "SMS segment", limit: 160, note: "GSM-7 single message" },
];

export function CharacterCounter() {
  const [text, setText] = React.useState("");
  const stats = React.useMemo(() => analyzeText(text), [text]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Characters" value={formatNumber(stats.characters, 0)} tone="sky" />
        <Stat label="No spaces" value={formatNumber(stats.charactersNoSpaces, 0)} tone="grass" />
        <Stat label="Visible (emoji-safe)" value={formatNumber(stats.graphemes, 0)} tone="grape" />
        <Stat label="UTF-8 size" value={formatBytes(stats.bytes)} tone="fire" />
      </div>

      <Card>
        <label htmlFor="cc-text" className="sr-only">
          Text to count
        </label>
        <Textarea
          id="cc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text you need to fit inside a limit…"
          className="min-h-[200px] rounded-2xl border-0"
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <CopyButton value={text} label="Copy text" disabled={!text} />
        <Button tone="ghost" onClick={() => setText("")} disabled={!text}>
          Clear
        </Button>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Limit check
        </h3>
        <ul className="space-y-4">
          {LIMITS.map((item) => {
            const used = stats.characters;
            const pct = Math.min(100, (used / item.limit) * 100);
            const over = used > item.limit;
            const near = !over && pct > 85;
            return (
              <li key={item.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-extrabold">{item.label}</span>
                  <span
                    className={cn(
                      "text-xs font-extrabold tabular-nums",
                      over ? "text-[var(--cherry)]" : near ? "text-[var(--fire)]" : "text-[var(--muted)]",
                    )}
                  >
                    {used} / {item.limit}
                    {over ? ` · ${used - item.limit} over` : ""}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--panel-2)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-200"
                    style={{
                      width: `${pct}%`,
                      background: over
                        ? "var(--cherry)"
                        : near
                          ? "var(--fire)"
                          : "var(--grass)",
                    }}
                  />
                </div>
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{item.note}</p>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
