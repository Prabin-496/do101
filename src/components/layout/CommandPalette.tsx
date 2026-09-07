"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { searchTools } from "@/lib/tools/search";
import { TOOLS, TOOL_MAP, FEATURED_TOOLS } from "@/lib/tools/tool-registry";
import type { Tool } from "@/lib/tools/types";
import { readLocal, STORAGE_KEYS } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

interface PaletteContext {
  open: () => void;
}

const Ctx = React.createContext<PaletteContext>({ open: () => {} });
export const useCommandPalette = () => React.useContext(Ctx);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = React.useCallback(() => setIsOpen(true), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {isOpen ? <Palette onClose={() => setIsOpen(false)} /> : null}
    </Ctx.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const recent = React.useMemo(() => {
    return readLocal<string[]>(STORAGE_KEYS.recent, [])
      .map((id) => TOOL_MAP[id])
      .filter((t): t is Tool => Boolean(t))
      .slice(0, 5);
  }, []);

  const results = React.useMemo(() => {
    if (!query.trim()) {
      const base = recent.length ? recent : FEATURED_TOOLS;
      return base.slice(0, 8);
    }
    return searchTools(query, 8).map((h) => h.tool);
  }, [query, recent]);

  React.useEffect(() => {
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const go = (tool: Tool) => {
    track("search_used", { query: query.slice(0, 60), tool: tool.id });
    onClose();
    router.push(tool.route);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search DO101 tools"
        onKeyDown={onKeyDown}
        className="do-pop w-full max-w-xl overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b-2 border-[var(--border)] px-4 py-3">
          <span aria-hidden className="text-xl">
            🔎
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="What do you want to do?"
            aria-label="Search tools"
            aria-controls="palette-results"
            className="w-full bg-transparent text-lg font-bold outline-none placeholder:font-semibold placeholder:text-[var(--muted)]"
          />
          <kbd className="hidden shrink-0 rounded-lg border-2 border-[var(--border)] px-2 py-1 text-[10px] font-extrabold text-[var(--muted)] sm:block">
            ESC
          </kbd>
        </div>

        <div
          id="palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Tool results"
          className="do-scroll max-h-[52vh] overflow-y-auto p-2"
        >
          {!query.trim() ? (
            <p className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
              {recent.length ? "Recent" : "Popular"}
            </p>
          ) : null}

          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm font-semibold text-[var(--muted)]">
              No tool matches “{query}”. Try “compress”, “json”, “qr” or “typing”.
            </p>
          ) : (
            results.map((tool, i) => (
              <button
                key={tool.id}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(tool)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  i === active ? "bg-[var(--panel)]" : "",
                )}
              >
                <span aria-hidden className="text-xl">
                  {tool.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{tool.name}</span>
                  <span className="block truncate text-xs font-semibold text-[var(--muted)]">
                    {tool.short}
                  </span>
                </span>
                {i === active ? (
                  <span aria-hidden className="text-xs font-extrabold text-[var(--muted)]">
                    ↵
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-[11px] font-extrabold text-[var(--muted)]">
          <span>{TOOLS.length} tools · all free</span>
          <span className="hidden sm:block">↑↓ to move · ↵ to open</span>
        </div>
      </div>
    </div>
  );
}
