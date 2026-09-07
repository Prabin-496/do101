"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { convertCase, CASE_STYLES, type CaseStyle } from "@/lib/text/case";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

export function CaseConverter() {
  const [text, setText] = React.useState("");
  const [style, setStyle] = React.useState<CaseStyle>("title");

  const output = React.useMemo(() => convertCase(text, style), [text, style]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Choose a case
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CASE_STYLES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setStyle(item.id);
                track("tool_complete", { tool: "case-converter", style: item.id });
              }}
              aria-pressed={style === item.id}
              className={cn(
                "rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                style === item.id
                  ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                  : "border-[var(--border)] hover:bg-[var(--panel)]",
              )}
            >
              <span className="block text-sm font-extrabold">{item.label}</span>
              <span className="block truncate font-mono text-xs font-semibold text-[var(--muted)]">
                {item.example}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="case-in"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Your text
          </label>
          <Textarea
            id="case-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text here…"
            className="min-h-[200px]"
          />
        </div>
        <div>
          <label
            htmlFor="case-out"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Converted
          </label>
          <Textarea
            id="case-out"
            value={output}
            readOnly
            placeholder="The converted text appears here."
            className="min-h-[200px] bg-[var(--panel)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton value={output} label="Copy result" tone="grass" size="md" disabled={!output} />
        <Button tone="sky" onClick={() => setText(output)} disabled={!output || output === text}>
          Replace input
        </Button>
        <Button tone="ghost" onClick={() => setText("")} disabled={!text}>
          Clear
        </Button>
      </div>
    </div>
  );
}
