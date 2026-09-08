"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { AI_TOOLS, toolsInCategory } from "@/lib/ai-directory/tools";
import { AI_CATEGORIES, categoryMeta, type AiCategory } from "@/lib/ai-directory/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

const FREE_LABEL: Record<string, { text: string; tone: string }> = {
  yes: { text: "Free tier", tone: "grass" },
  limited: { text: "Limited free", tone: "sky" },
  trial: { text: "Free trial", tone: "fire" },
  no: { text: "Paid", tone: "muted" },
};

export function AiDirectory() {
  const [category, setCategory] = React.useState<AiCategory | "all">("all");
  const [query, setQuery] = React.useState("");
  const [freeOnly, setFreeOnly] = React.useState(false);

  const results = React.useMemo(() => {
    const base = category === "all" ? AI_TOOLS : toolsInCategory(category);
    const q = query.trim().toLowerCase();

    return base.filter((tool) => {
      if (freeOnly && tool.freeTier === "no") return false;
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.summary.toLowerCase().includes(q) ||
        tool.bestFor.toLowerCase().includes(q) ||
        tool.maker.toLowerCase().includes(q)
      );
    });
  }, [category, query, freeOnly]);

  const active = category === "all" ? null : categoryMeta(category);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border-[3px] border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 focus-within:border-[var(--grass)]">
          <span aria-hidden className="text-lg">
            🔎
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — try video, voice cloning, transcription…"
            aria-label="Search AI tools"
            className="w-full bg-transparent text-base font-bold outline-none placeholder:font-semibold placeholder:text-[var(--muted)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-sm font-extrabold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Clear
            </button>
          ) : null}
        </div>
        <Button
          tone={freeOnly ? "grass" : "panel"}
          onClick={() => setFreeOnly((v) => !v)}
          aria-pressed={freeOnly}
        >
          {freeOnly ? "✓ Has a free tier" : "Has a free tier"}
        </Button>
      </div>

      <nav aria-label="AI tool categories" className="do-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
          className={cn(
            "shrink-0 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors",
            category === "all"
              ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
              : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel)]",
          )}
        >
          ✨ Everything ({AI_TOOLS.length})
        </button>
        {AI_CATEGORIES.map((meta) => (
          <button
            key={meta.id}
            type="button"
            onClick={() => setCategory(meta.id)}
            aria-pressed={category === meta.id}
            className={cn(
              "shrink-0 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors",
              category === meta.id
                ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
                : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel)]",
            )}
          >
            {meta.icon} {meta.label}
          </button>
        ))}
      </nav>

      {active ? (
        <Card className="bg-[var(--sky-soft)] p-4">
          <p className="text-sm font-extrabold">
            {active.icon} Choosing a {active.label.toLowerCase()} tool
          </p>
          <p className="mt-1 text-sm font-semibold">{active.guidance}</p>
        </Card>
      ) : null}

      <p className="text-sm font-extrabold text-[var(--muted)]" role="status">
        {results.length} tool{results.length === 1 ? "" : "s"}
        {query ? ` matching “${query}”` : ""}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nothing matches that"
          description="Try a broader word, or switch the category back to everything."
          action={
            <Button
              tone="panel"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setFreeOnly(false);
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((tool) => {
            const free = FREE_LABEL[tool.freeTier];
            const meta = categoryMeta(tool.category);
            return (
              <li key={tool.id}>
                <Card hover className="h-full">
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track("tool_open", { directory: tool.id })}
                    className="flex h-full flex-col gap-2 p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block text-lg font-extrabold">{tool.name}</span>
                        <span className="block text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
                          {tool.maker}
                        </span>
                      </span>
                      <span
                        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                        style={{
                          background: free.tone === "muted" ? "var(--panel)" : `var(--${free.tone}-soft)`,
                          color: free.tone === "muted" ? "var(--muted)" : `var(--${free.tone}-dark)`,
                        }}
                      >
                        {free.text}
                      </span>
                    </div>

                    <p className="text-sm font-semibold leading-snug text-[var(--muted)]">
                      {tool.summary}
                    </p>

                    <p className="mt-auto rounded-xl bg-[var(--panel)] px-3 py-2 text-xs font-bold">
                      <span className="text-[var(--muted)]">Best for: </span>
                      {tool.bestFor}
                    </p>

                    <p className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-[var(--muted)]">
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[var(--grass)]">Open ↗</span>
                    </p>
                  </a>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
