"use client";

import { useLanguage } from "./LanguageProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Renders one translated string. Kept as a tiny client component so the rest of
 * the homepage stays a server component and ships no extra JavaScript.
 */
export function T({ k }: { k: MessageKey }) {
  const { t } = useLanguage();
  return <>{t(k)}</>;
}
