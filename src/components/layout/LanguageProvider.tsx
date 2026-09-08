"use client";

import * as React from "react";
import { getMessages, type MessageKey } from "@/lib/i18n/messages";
import { DEFAULT_LOCALE, getLocale, matchLocale } from "@/lib/i18n/locales";
import { writeLocal } from "@/lib/utils/storage";
import { useLocalValue, useIsHydrated } from "@/lib/utils/use-local";

const STORAGE_KEY = "locale";

interface LanguageContext {
  locale: string;
  /** True when the language came from the browser rather than a choice. */
  autoDetected: boolean;
  setLocale: (code: string) => void;
  t: (key: MessageKey) => string;
}

const Ctx = React.createContext<LanguageContext>({
  locale: DEFAULT_LOCALE,
  autoDetected: false,
  setLocale: () => {},
  t: (key) => getMessages(DEFAULT_LOCALE)[key],
});

export const useLanguage = () => React.useContext(Ctx);

/**
 * Chooses the interface language.
 *
 * The first render is always English so the server and client agree; a saved
 * choice or the browser's own preference is applied immediately afterwards.
 * An explicit choice always wins and is remembered on the device — so someone
 * in Japan who prefers English is not overridden on every visit.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // A saved choice is read straight from storage, so no effect is needed and
  // the value stays in sync if another tab changes it.
  const saved = useLocalValue<string | null>(STORAGE_KEY, null);
  const hydrated = useIsHydrated();

  // Detection can only happen in the browser; before hydration everyone —
  // including crawlers — gets English, which keeps the markup consistent.
  const detected = React.useMemo(() => {
    if (!hydrated || saved) return DEFAULT_LOCALE;
    return matchLocale(navigator.languages ?? [navigator.language]);
  }, [hydrated, saved]);

  const locale = saved ? getLocale(saved).code : detected;
  const autoDetected = !saved && detected !== DEFAULT_LOCALE;

  // Assistive technology and the browser both rely on these being correct.
  React.useEffect(() => {
    const meta = getLocale(locale);
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
  }, [locale]);

  // Writing to storage is enough: useLocalValue re-reads it immediately.
  const setLocale = React.useCallback((code: string) => {
    writeLocal(STORAGE_KEY, getLocale(code).code);
  }, []);

  const value = React.useMemo<LanguageContext>(() => {
    const messages = getMessages(locale);
    return {
      locale,
      autoDetected,
      setLocale,
      // Falls back to the English string rather than rendering an empty label.
      t: (key) => messages[key] ?? getMessages(DEFAULT_LOCALE)[key],
    };
  }, [locale, autoDetected, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
