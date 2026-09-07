"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { timeAgo } from "@/lib/news/rank";
import { CATEGORY_LABELS, type NewsItem } from "@/lib/news/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

const PAGE_SIZE = 30;

/**
 * The headline list. Search and "load more" are client side so the server can
 * hand over one cached, fully-rendered page rather than re-fetching per query.
 */
export function NewsList({
  items,
  showCategory = true,
}: {
  items: NewsItem[];
  showCategory?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const [source, setSource] = React.useState<string>("all");

  const sources = React.useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const item of items) {
      const entry = counts.get(item.sourceId) ?? { name: item.sourceName, count: 0 };
      entry.count++;
      counts.set(item.sourceId, entry);
    }
    return [...counts.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (source !== "all" && item.sourceId !== source) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.excerpt.toLowerCase().includes(q) ||
        item.sourceName.toLowerCase().includes(q)
      );
    });
  }, [items, query, source]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border-[3px] border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 focus-within:border-[var(--grass)]">
          <span aria-hidden className="text-lg">
            🔎
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search these headlines…"
            aria-label="Search headlines"
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

        <label className="sr-only" htmlFor="news-source">
          Filter by source
        </label>
        <select
          id="news-source"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className="do-input cursor-pointer sm:w-56"
        >
          <option value="all">All sources ({items.length})</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm font-extrabold text-[var(--muted)]" role="status">
        {filtered.length} headline{filtered.length === 1 ? "" : "s"}
        {query ? ` matching “${query}”` : ""}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📰"
          title="Nothing matches that"
          description="Try a shorter search, or switch the source filter back to all."
          action={
            <Button
              tone="panel"
              onClick={() => {
                setQuery("");
                setSource("all");
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {shown.map((item) => (
              <li key={item.id}>
                <Card hover className="group">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={() => track("tool_open", { news: item.sourceId })}
                    className="block p-4 sm:p-5"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider">
                      <span className="rounded-lg bg-[var(--panel)] px-2 py-1 text-[var(--ink)]">
                        {item.sourceName}
                      </span>
                      {showCategory ? (
                        <span className="rounded-lg bg-[var(--sky-soft)] px-2 py-1 text-[var(--sky-dark)] dark:text-[var(--sky)]">
                          {CATEGORY_LABELS[item.category].icon}{" "}
                          {CATEGORY_LABELS[item.category].label}
                        </span>
                      ) : null}
                      <span className="text-[var(--muted)]">{timeAgo(item.publishedAt)}</span>
                    </div>

                    <h3 className="text-lg leading-snug group-hover:underline">{item.title}</h3>

                    {item.excerpt ? (
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-relaxed text-[var(--muted)]">
                        {item.excerpt}
                      </p>
                    ) : null}

                    <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-[var(--grass)]">
                      Read at {item.sourceName} ↗
                    </p>
                  </a>
                </Card>
              </li>
            ))}
          </ul>

          {visible < filtered.length ? (
            <div className="flex justify-center pt-2">
              <Button
                tone="panel"
                size="lg"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
              </Button>
            </div>
          ) : (
            <p className={cn("pt-2 text-center text-sm font-semibold text-[var(--muted)]")}>
              That is every headline in this window.
            </p>
          )}
        </>
      )}
    </div>
  );
}
