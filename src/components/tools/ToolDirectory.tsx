"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TOOLS } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory } from "@/lib/tools/types";
import { searchTools } from "@/lib/tools/search";
import { ToolCard } from "./ToolCard";
import { EmptyState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

const CATEGORY_ORDER: ToolCategory[] = [
  "image",
  "text",
  "developer",
  "calculator",
  "productivity",
  "game",
];

const SLUG_TO_CATEGORY: Record<string, ToolCategory> = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [CATEGORY_META[c].slug, c]),
);

export function ToolDirectory() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [category, setCategory] = React.useState<ToolCategory | "all">(() => {
    const slug = params.get("category");
    return slug && SLUG_TO_CATEGORY[slug] ? SLUG_TO_CATEGORY[slug] : "all";
  });

  // Keep the URL shareable without pushing an entry for every keystroke.
  React.useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (category !== "all") next.set("category", CATEGORY_META[category].slug);
    const qs = next.toString();
    const id = window.setTimeout(
      () => router.replace(qs ? `/tools?${qs}` : "/tools", { scroll: false }),
      350,
    );
    return () => window.clearTimeout(id);
  }, [query, category, router]);

  const results = React.useMemo(() => {
    const base = query.trim() ? searchTools(query, 40).map((h) => h.tool) : TOOLS;
    return category === "all" ? base : base.filter((t) => t.category === category);
  }, [query, category]);

  const grouped = React.useMemo(() => {
    if (query.trim() || category !== "all") return null;
    return CATEGORY_ORDER.map((c) => ({
      category: c,
      tools: TOOLS.filter((t) => t.category === c),
    }));
  }, [query, category]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl border-[3px] border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-within:border-[var(--grass)]">
        <span aria-hidden className="text-xl">
          🔎
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${TOOLS.length} tools — try "compress", "json" or "typing"`}
          aria-label="Search tools"
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

      <div className="do-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
          ✨ All ({TOOLS.length})
        </FilterChip>
        {CATEGORY_ORDER.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
          </FilterChip>
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={`No tool matches “${query}”`}
          description="Try a simpler word, or browse a category above."
          action={
            <Button
              tone="panel"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              Show everything
            </Button>
          }
        />
      ) : grouped ? (
        <div className="space-y-10">
          {grouped.map(({ category: c, tools }) => (
            <section key={c} aria-labelledby={`cat-${c}`}>
              <div className="mb-4">
                <h2 id={`cat-${c}`} className="flex items-center gap-2 text-2xl">
                  <span aria-hidden>{CATEGORY_META[c].icon}</span>
                  {CATEGORY_META[c].label}
                </h2>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {CATEGORY_META[c].blurb}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm font-extrabold text-[var(--muted)]">
            {results.length} tool{results.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors",
        active
          ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
          : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel)]",
      )}
    >
      {children}
    </button>
  );
}
