"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState, InfoNote, Stat } from "@/components/ui/Feedback";
import {
  CATEGORY_LABELS, SHORTCUTS, searchShortcuts,
  type Shortcut, type ShortcutCategory,
} from "@/lib/excel/shortcuts";
import { useIsHydrated } from "@/lib/utils/use-local";
import { cn } from "@/lib/utils/cn";

/** Splits "Ctrl + Shift + L" into keys so each can be drawn as a keycap. */
function Keys({ combo }: { combo: string }) {
  if (combo === "—") {
    return <span className="text-xs font-bold text-[var(--muted)]">No default shortcut</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {combo.split(/\s*\+\s*/).map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <span className="text-xs font-bold text-[var(--muted)]">+</span> : null}
          <kbd className="rounded-lg border-2 border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 font-mono text-xs font-extrabold shadow-[0_2px_0_var(--border-strong)]">
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

export function ExcelShortcuts() {
  const hydrated = useIsHydrated();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<ShortcutCategory | "all">("all");
  const [platform, setPlatform] = React.useState<"windows" | "mac" | null>(null);
  const [essentialsOnly, setEssentialsOnly] = React.useState(false);

  // Default to the reader's own platform once we can actually detect it.
  const detected = React.useMemo<"windows" | "mac">(() => {
    if (!hydrated || typeof navigator === "undefined") return "windows";
    return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "mac" : "windows";
  }, [hydrated]);
  const os = platform ?? detected;

  const results = React.useMemo(() => {
    const found = searchShortcuts(query, category);
    return essentialsOnly ? found.filter((s) => s.essential) : found;
  }, [query, category, essentialsOnly]);

  const grouped = React.useMemo(() => {
    const order = Object.keys(CATEGORY_LABELS) as ShortcutCategory[];
    return order
      .map((key) => ({ key, items: results.filter((s) => s.category === key) }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  const essentialCount = SHORTCUTS.filter((s) => s.essential).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Shortcuts" value={String(SHORTCUTS.length)} tone="grass" />
        <Stat label="Worth learning first" value={String(essentialCount)} tone="sun" />
        <Stat label="Categories" value={String(Object.keys(CATEGORY_LABELS).length)} tone="sky" />
        <Stat label="Showing" value={String(results.length)} tone="grape" />
      </div>

      <Card className="p-4">
        <label htmlFor="xl-search" className="sr-only">Search shortcuts</label>
        <Input
          id="xl-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by what you want to do — filter, paste values, freeze headers…"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border-2 border-[var(--border)] p-1" role="group" aria-label="Platform">
            {(["windows", "mac"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={os === option}
                onClick={() => setPlatform(option)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-extrabold transition",
                  os === option ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--muted)]",
                )}
              >
                {option === "windows" ? "Windows" : "Mac"}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            tone={essentialsOnly ? "grass" : "panel"}
            onClick={() => setEssentialsOnly((v) => !v)}
            aria-pressed={essentialsOnly}
          >
            ⭐ Just the essentials
          </Button>

          {query || category !== "all" || essentialsOnly ? (
            <Button
              size="sm"
              tone="ghost"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setEssentialsOnly(false);
              }}
            >
              Reset
            </Button>
          ) : null}
        </div>

        <div className="do-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
            className={cn(
              "shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-extrabold transition",
              category === "all"
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                : "border-[var(--border)] text-[var(--muted)]",
            )}
          >
            All
          </button>
          {(Object.keys(CATEGORY_LABELS) as ShortcutCategory[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-extrabold transition",
                category === key
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                  : "border-[var(--border)] text-[var(--muted)]",
              )}
            >
              <span aria-hidden>{CATEGORY_LABELS[key].icon}</span>
              {CATEGORY_LABELS[key].label}
            </button>
          ))}
        </div>
      </Card>

      {results.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nothing matches"
          description="Try describing what you want to do rather than the keys — for example “stop numbers changing” finds Paste Values."
        />
      ) : (
        grouped.map((group) => (
          <Card key={group.key} className="p-5">
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <span aria-hidden>{CATEGORY_LABELS[group.key].icon}</span>
              {CATEGORY_LABELS[group.key].label}
              <span className="text-[var(--muted)]">({group.items.length})</span>
            </p>
            <ul className="mt-3 space-y-2">
              {group.items.map((shortcut: Shortcut, index) => (
                <li
                  key={`${shortcut.action}-${index}`}
                  className={cn(
                    "rounded-2xl border-2 p-3",
                    shortcut.essential
                      ? "border-[var(--sun)] bg-[var(--sun-soft)]"
                      : "border-[var(--border)]",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold">
                        {shortcut.essential ? <span aria-label="Essential">⭐ </span> : null}
                        {shortcut.action}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                        {shortcut.useCase}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Keys combo={os === "mac" ? shortcut.mac : shortcut.windows} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <InfoNote icon="⌨️">
        <strong className="font-extrabold">Shortcuts vary by version and language.</strong>{" "}
        These cover Microsoft 365 and Excel 2016 onwards. A few Windows shortcuts have
        no Mac equivalent, and some depend on your keyboard layout — on a Mac you may
        also need to enable &ldquo;Use F1, F2 as standard function keys&rdquo; in System
        Settings for the F-key shortcuts to work. Where there is no default binding,
        the list says so rather than inventing one.
      </InfoNote>
    </div>
  );
}
