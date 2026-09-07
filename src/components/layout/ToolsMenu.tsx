"use client";

import * as React from "react";
import Link from "next/link";
import { toolsByCategory } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory } from "@/lib/tools/types";
import { cn } from "@/lib/utils/cn";

const HUBS: Array<{ category: ToolCategory; href: string }> = [
  { category: "pdf", href: "/tools/pdf" },
  { category: "image", href: "/tools/image" },
  { category: "converter", href: "/tools/converters" },
  { category: "text", href: "/tools/text" },
  { category: "developer", href: "/tools/developer" },
  { category: "seo", href: "/tools/seo" },
  { category: "calculator", href: "/calculators" },
  { category: "datetime", href: "/tools/datetime" },
  { category: "game", href: "/games" },
];

const SHORTCUTS = [
  { href: "/tools/pdf-merge", label: "Merge PDF" },
  { href: "/tools/pdf-to-word", label: "PDF to Word" },
  { href: "/tools/image-compressor", label: "Compress image" },
  { href: "/tools/heic-to-jpg", label: "HEIC to JPG" },
  { href: "/tools/json-formatter", label: "Format JSON" },
  { href: "/tools/digital-clock", label: "Full-screen clock" },
];

/**
 * Category menu in the header. Every entry is a real link, so it is useful
 * with a keyboard, readable to a crawler, and works before hydration.
 */
export function ToolsMenu({ active }: { active: boolean }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<number | undefined>(undefined);

  // Pointer-out closes on a short delay so the gap between button and panel
  // does not dismiss the menu mid-reach.
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };
  const cancelClose = () => window.clearTimeout(closeTimer.current);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-extrabold uppercase tracking-wide transition-colors",
          active
            ? "bg-[var(--panel)] text-[var(--ink)]"
            : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]",
        )}
      >
        Tools
        <span aria-hidden className={cn("text-[10px] transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open ? (
        <div
          className="do-pop absolute left-0 top-full z-50 mt-1 w-[min(88vw,640px)] rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl"
          onFocus={cancelClose}
          onBlur={scheduleClose}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_190px]">
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
                Categories
              </p>
              <ul className="grid grid-cols-2 gap-1">
                {HUBS.map(({ category, href }) => {
                  const meta = CATEGORY_META[category];
                  const count = toolsByCategory(category).length;
                  return (
                    <li key={category}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-extrabold transition-colors hover:bg-[var(--panel)]"
                      >
                        <span aria-hidden>{meta.icon}</span>
                        <span className="flex-1 truncate">{meta.label}</span>
                        <span className="text-[11px] font-extrabold text-[var(--muted)]">
                          {count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t-2 border-[var(--border)] pt-3 sm:border-l-2 sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
                Jump straight in
              </p>
              <ul className="space-y-1">
                {SHORTCUTS.map((shortcut) => (
                  <li key={shortcut.href}>
                    <Link
                      href={shortcut.href}
                      onClick={() => setOpen(false)}
                      className="block truncate rounded-xl px-2.5 py-1.5 text-sm font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--ink)]"
                    >
                      {shortcut.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link
            href="/tools"
            onClick={() => setOpen(false)}
            className="mt-3 block rounded-xl bg-[var(--panel)] px-3 py-2.5 text-center text-sm font-extrabold hover:bg-[var(--panel-2)]"
          >
            See every tool →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
