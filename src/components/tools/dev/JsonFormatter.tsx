"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea, Select, Label, Toggle } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, Stat, SuccessNote } from "@/components/ui/Feedback";
import { formatJson, minifyJson, jsonStats } from "@/lib/dev/json";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

const SAMPLE = `{"name":"DO101","tagline":"Do more. Simply.","tools":["image-compressor","json-formatter"],"free":true,"launched":{"year":2026}}`;

export function JsonFormatter({ mode = "format" }: { mode?: "format" | "validate" }) {
  const [input, setInput] = React.useState("");
  const [indent, setIndent] = React.useState<string>("2");
  const [sortKeys, setSortKeys] = React.useState(false);

  const result = React.useMemo(() => {
    if (!input.trim()) return null;
    return formatJson(input, {
      indent: indent === "tab" ? "tab" : Number(indent),
      sortKeys,
    });
  }, [input, indent, sortKeys]);

  const stats = React.useMemo(
    () => (result?.ok ? jsonStats(input, result.value) : null),
    [result, input],
  );

  const output = result?.ok ? (result.output ?? "") : "";

  React.useEffect(() => {
    if (result?.ok) {
      track("tool_complete", { tool: mode === "validate" ? "json-validator" : "json-formatter" });
      recordCompletion(5);
    }
  }, [result?.ok, mode]);

  const doMinify = () => {
    const minified = minifyJson(input);
    if (minified.ok && minified.output) setInput(minified.output);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="json-in"
              className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
            >
              Your JSON
            </label>
            <button
              type="button"
              onClick={() => setInput(SAMPLE)}
              className="text-xs font-extrabold uppercase tracking-wide text-[var(--sky)] hover:underline"
            >
              Load sample
            </button>
          </div>
          <Textarea
            id="json-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"paste": "your JSON here"}'
            className="min-h-[280px] font-mono text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="json-out"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            {mode === "validate" ? "Normalised output" : "Formatted"}
          </label>
          <Textarea
            id="json-out"
            value={output}
            readOnly
            placeholder="Valid JSON appears here, neatly indented."
            className="min-h-[280px] bg-[var(--panel)] font-mono text-sm"
          />
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="w-32">
          <Label htmlFor="indent">Indent</Label>
          <Select id="indent" value={indent} onChange={(e) => setIndent(e.target.value)}>
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </Select>
        </div>
        <div className="min-w-[220px] flex-1">
          <Toggle
            checked={sortKeys}
            onChange={setSortKeys}
            label="Sort keys A→Z"
            description="Alphabetises every object."
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <CopyButton value={output} label="Copy result" tone="grass" size="md" disabled={!output} />
        <Button tone="sky" onClick={doMinify} disabled={!result?.ok}>
          Minify
        </Button>
        <Button
          tone="panel"
          onClick={() => {
            if (!output) return;
            const blob = new Blob([output], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "formatted.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          }}
          disabled={!output}
        >
          Download .json
        </Button>
        <Button tone="ghost" onClick={() => setInput("")} disabled={!input}>
          Clear
        </Button>
      </div>

      {result && !result.ok ? (
        <ErrorState
          title="Invalid JSON"
          message={
            result.error.line
              ? `${result.error.message} (line ${result.error.line}, column ${result.error.column})`
              : result.error.message
          }
          action={
            result.error.snippet ? (
              <pre className="do-scroll overflow-x-auto rounded-xl bg-[var(--bg)] p-3 font-mono text-xs">
                {result.error.snippet}
              </pre>
            ) : null
          }
        />
      ) : null}

      {result?.ok ? <SuccessNote>Valid JSON.</SuccessNote> : null}

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Root type" value={stats.type} tone="sky" />
            <Stat label="Keys" value={stats.keys} tone="grass" />
            <Stat label="Array items" value={stats.arrayItems} tone="grape" />
            <Stat label="Max depth" value={stats.depth} tone="fire" />
          </div>
          <p className="text-xs font-semibold text-[var(--muted)]">
            Source size: {formatBytes(stats.size)}
          </p>
          {stats.duplicateKeys.length ? (
            <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
              ⚠️ Duplicate keys found: {stats.duplicateKeys.join(", ")}. Most parsers silently keep
              only the last value.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
