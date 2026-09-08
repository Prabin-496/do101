"use client";

import * as React from "react";
import { useLanguage } from "./LanguageProvider";
import { LOCALES, getLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils/cn";

/**
 * The language chooser. Shows the current language as a short code in the
 * header, and every option in its own script — nobody looking for Japanese
 * wants to hunt for the word "Japanese" written in English.
 */
export function LanguageSwitcher({ floating = false }: { floating?: boolean }) {
  const { locale, setLocale, autoDetected, t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const current = getLocale(locale);

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
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        floating
          ? "fixed bottom-4 right-4 z-40 md:hidden"
          : "hidden md:block",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${t("lang.label")}: ${current.native}. ${t("lang.choose")}`}
        title={t("lang.choose")}
        className={cn(
          "flex items-center gap-1.5 font-extrabold uppercase tracking-wide transition-colors",
          floating
            ? "do-btn [--btn-bg:var(--bg)] [--btn-shadow:var(--border-strong)] [--btn-fg:var(--ink)] border-2 border-[var(--border)] px-4 py-3 text-sm shadow-lg"
            : "h-10 rounded-xl border-2 border-[var(--border)] px-3 text-sm text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]",
        )}
      >
        <span aria-hidden>🌐</span>
        <span>{current.code.toUpperCase()}</span>
        <span aria-hidden className={cn("text-[10px] transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("lang.choose")}
          className={cn(
            "do-pop absolute z-50 w-64 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-2 shadow-2xl",
            floating ? "bottom-full right-0 mb-2" : "right-0 top-full mt-1",
          )}
        >
          <p className="px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
            {t("lang.choose")}
          </p>

          <ul className="do-scroll max-h-[50vh] overflow-y-auto">
            {LOCALES.map((option) => {
              const active = option.code === locale;
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    lang={option.code}
                    onClick={() => {
                      setLocale(option.code);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active ? "bg-[var(--grass-soft)]" : "hover:bg-[var(--panel)]",
                    )}
                  >
                    <span aria-hidden className="text-lg">
                      {option.flag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">{option.native}</span>
                      <span className="block truncate text-[11px] font-semibold text-[var(--muted)]">
                        {option.english}
                        {active && autoDetected ? ` · ${t("lang.detected")}` : ""}
                      </span>
                    </span>
                    {active ? (
                      <span aria-hidden className="text-[var(--grass)]">
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="border-t-2 border-[var(--border)] px-3 pb-1 pt-2 text-[11px] font-semibold leading-snug text-[var(--muted)]">
            {t("lang.uiOnly")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
