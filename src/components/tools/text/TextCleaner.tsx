"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea, Toggle } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Stat } from "@/components/ui/Feedback";
import { cleanText, DEFAULT_CLEAN_OPTIONS, type CleanOptions } from "@/lib/text/clean";
import { formatNumber } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

const OPTION_META: Array<{ key: keyof CleanOptions; label: string; description: string }> = [
  { key: "collapseSpaces", label: "Collapse repeated spaces", description: "Two or more spaces become one." },
  { key: "trimLines", label: "Trim each line", description: "Removes leading and trailing whitespace." },
  { key: "removeBlankLines", label: "Remove blank lines", description: "Deletes every empty line." },
  { key: "joinWrappedLines", label: "Join wrapped lines", description: "Rebuilds paragraphs broken by PDF copy." },
  { key: "straightenQuotes", label: "Straighten quotes and dashes", description: "Smart quotes → plain ASCII." },
  { key: "stripInvisible", label: "Strip invisible characters", description: "Zero-width spaces and joiners." },
  { key: "removeExtraPunctuation", label: "Tidy punctuation", description: "!!! → ! and removes space before commas." },
  { key: "lowercase", label: "Lowercase everything", description: "Converts the result to lower case." },
];

export function TextCleaner() {
  const [text, setText] = React.useState("");
  const [options, setOptions] = React.useState<CleanOptions>(DEFAULT_CLEAN_OPTIONS);

  const output = React.useMemo(() => cleanText(text, options), [text, options]);
  const removed = text.length - output.length;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Fixes to apply
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTION_META.map((meta) => (
            <Toggle
              key={meta.key}
              checked={options[meta.key]}
              onChange={(v) => setOptions((o) => ({ ...o, [meta.key]: v }))}
              label={meta.label}
              description={meta.description}
            />
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="clean-in"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Messy text
          </label>
          <Textarea
            id="clean-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text copied from a PDF, email or website…"
            className="min-h-[260px]"
          />
        </div>
        <div>
          <label
            htmlFor="clean-out"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Cleaned text
          </label>
          <Textarea
            id="clean-out"
            value={output}
            readOnly
            placeholder="The tidy version appears here."
            className="min-h-[260px] bg-[var(--panel)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton
          value={output}
          label="Copy cleaned text"
          tone="grass"
          size="md"
          disabled={!output}
          onCopied={() => track("tool_complete", { tool: "text-cleaner" })}
        />
        <Button tone="sky" onClick={() => setText(output)} disabled={!output || output === text}>
          Replace input
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setText("");
            setOptions(DEFAULT_CLEAN_OPTIONS);
          }}
          disabled={!text}
        >
          Reset
        </Button>
      </div>

      {text ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Before" value={`${formatNumber(text.length, 0)} chars`} />
          <Stat label="After" value={`${formatNumber(output.length, 0)} chars`} tone="grass" />
          <Stat
            label="Removed"
            value={`${formatNumber(Math.max(0, removed), 0)} chars`}
            tone={removed > 0 ? "fire" : "ink"}
          />
        </div>
      ) : null}
    </div>
  );
}
