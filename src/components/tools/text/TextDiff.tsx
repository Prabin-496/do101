"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea, Toggle } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState, Stat, SuccessNote } from "@/components/ui/Feedback";
import { diffWords, diffSummary, DIFF_TOKEN_LIMIT } from "@/lib/text/diff";
import { track } from "@/lib/analytics";

export function TextDiff() {
  const [left, setLeft] = React.useState("");
  const [right, setRight] = React.useState("");
  const [ignoreCase, setIgnoreCase] = React.useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(false);

  const hasInput = Boolean(left.trim() || right.trim());

  const parts = React.useMemo(
    () => (hasInput ? diffWords(left, right, { ignoreCase, ignoreWhitespace }) : []),
    [left, right, ignoreCase, ignoreWhitespace, hasInput],
  );
  const summary = React.useMemo(() => diffSummary(parts), [parts]);

  const truncated =
    (left.match(/\s+|[^\s]+/g)?.length ?? 0) > DIFF_TOKEN_LIMIT ||
    (right.match(/\s+|[^\s]+/g)?.length ?? 0) > DIFF_TOKEN_LIMIT;

  React.useEffect(() => {
    if (hasInput && parts.length) track("tool_complete", { tool: "text-diff" });
  }, [hasInput, parts.length]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="diff-left"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Original
          </label>
          <Textarea
            id="diff-left"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="Paste the original text…"
            className="min-h-[220px]"
          />
        </div>
        <div>
          <label
            htmlFor="diff-right"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Changed
          </label>
          <Textarea
            id="diff-right"
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder="Paste the revised text…"
            className="min-h-[220px]"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle checked={ignoreCase} onChange={setIgnoreCase} label="Ignore case" />
        <Toggle
          checked={ignoreWhitespace}
          onChange={setIgnoreWhitespace}
          label="Ignore whitespace differences"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          tone="ghost"
          onClick={() => {
            setLeft("");
            setRight("");
          }}
          disabled={!hasInput}
        >
          Clear both
        </Button>
        <Button
          tone="panel"
          onClick={() => {
            setLeft(right);
            setRight(left);
          }}
          disabled={!hasInput}
        >
          Swap sides
        </Button>
      </div>

      {truncated ? (
        <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
          ⚠️ These documents are very large, so the comparison was limited to the first{" "}
          {DIFF_TOKEN_LIMIT.toLocaleString()} tokens on each side to keep the page responsive.
        </p>
      ) : null}

      {!hasInput ? (
        <EmptyState
          icon="🔍"
          title="Paste two versions to compare"
          description="Added words are highlighted in green, removed words in red."
        />
      ) : summary.identical ? (
        <SuccessNote>The two texts are identical.</SuccessNote>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Added" value={summary.added} tone="grass" />
            <Stat label="Removed" value={summary.removed} tone="cherry" />
            <Stat label="Unchanged" value={summary.unchanged} />
          </div>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Differences
            </h3>
            <p className="do-scroll max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
              {parts.map((part, i) =>
                part.op === "equal" ? (
                  <span key={i}>{part.value}</span>
                ) : part.op === "insert" ? (
                  <ins
                    key={i}
                    className="rounded bg-[var(--grass-soft)] px-0.5 font-bold text-[var(--grass-dark)] no-underline dark:text-[var(--grass)]"
                  >
                    {part.value}
                  </ins>
                ) : (
                  <del
                    key={i}
                    className="rounded bg-[var(--cherry-soft)] px-0.5 font-bold text-[var(--cherry-dark)] dark:text-[var(--cherry)]"
                  >
                    {part.value}
                  </del>
                ),
              )}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
