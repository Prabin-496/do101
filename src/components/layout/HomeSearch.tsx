"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { searchTools } from "@/lib/tools/search";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

const SUGGESTIONS = [
  "Compress an image",
  "Convert JPG to PNG",
  "Format JSON",
  "Calculate my age",
  "Generate a QR code",
  "Test my typing speed",
  "Count words",
  "Decode Base64",
];

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [focused, setFocused] = React.useState(false);
  const [placeholder, setPlaceholder] = React.useState(SUGGESTIONS[0]);

  const results = React.useMemo(
    () => (query.trim() ? searchTools(query, 6).map((h) => h.tool) : []),
    [query],
  );

  // Cycles the placeholder so visitors see the range of things DO101 does.
  React.useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % SUGGESTIONS.length;
      setPlaceholder(SUGGESTIONS[i]);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  const open = (route: string, id: string) => {
    track("search_used", { query: query.slice(0, 60), tool: id });
    router.push(route);
  };

  const showResults = focused && results.length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border-[3px] bg-[var(--bg)] px-4 py-3 transition-colors",
          focused ? "border-[var(--grass)]" : "border-[var(--border)]",
        )}
      >
        <span aria-hidden className="text-xl">
          🔎
        </span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              if (results[active]) {
                e.preventDefault();
                open(results[active].route, results[active].id);
              } else if (query.trim()) {
                router.push(`/tools?q=${encodeURIComponent(query.trim())}`);
              }
            }
          }}
          role="combobox"
          aria-label="What do you want to do?"
          aria-expanded={showResults}
          aria-controls="home-search-results"
          aria-autocomplete="list"
          placeholder={placeholder}
          className="w-full bg-transparent text-base font-bold outline-none placeholder:font-semibold placeholder:text-[var(--muted)] sm:text-lg"
        />
        <kbd className="hidden shrink-0 rounded-lg bg-[var(--panel)] px-2 py-1 text-[10px] font-extrabold text-[var(--muted)] sm:block">
          ⌘K
        </kbd>
      </div>

      {showResults ? (
        <div
          id="home-search-results"
          role="listbox"
          aria-label="Matching tools"
          className="do-pop absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-2 text-left shadow-xl"
        >
          {results.map((tool, i) => (
            <button
              key={tool.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => open(tool.route, tool.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                i === active ? "bg-[var(--panel)]" : "",
              )}
            >
              <span aria-hidden className="text-lg">
                {tool.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold">{tool.name}</span>
                <span className="block truncate text-xs font-semibold text-[var(--muted)]">
                  {tool.short}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
