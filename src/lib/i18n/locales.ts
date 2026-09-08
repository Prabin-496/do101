/**
 * DO101's language support.
 *
 * Scope, stated honestly: this translates the **interface** — navigation,
 * buttons, labels, the homepage hero and the footer. The long explanatory copy
 * on each of the 102 tool pages remains in English for now. Machine-translating
 * that much prose would produce text that reads badly and, worse, could state
 * something inaccurate about what a tool does. The framework is here so those
 * pages can be translated properly over time.
 */

export interface Locale {
  code: string;
  /** The language's own name, which is what a chooser should show. */
  native: string;
  english: string;
  flag: string;
  dir: "ltr" | "rtl";
}

export const LOCALES: Locale[] = [
  { code: "en", native: "English", english: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ja", native: "日本語", english: "Japanese", flag: "🇯🇵", dir: "ltr" },
  { code: "es", native: "Español", english: "Spanish", flag: "🇪🇸", dir: "ltr" },
  { code: "fr", native: "Français", english: "French", flag: "🇫🇷", dir: "ltr" },
  { code: "de", native: "Deutsch", english: "German", flag: "🇩🇪", dir: "ltr" },
  { code: "pt", native: "Português", english: "Portuguese", flag: "🇧🇷", dir: "ltr" },
  { code: "hi", native: "हिन्दी", english: "Hindi", flag: "🇮🇳", dir: "ltr" },
  { code: "ne", native: "नेपाली", english: "Nepali", flag: "🇳🇵", dir: "ltr" },
  { code: "zh", native: "中文", english: "Chinese", flag: "🇨🇳", dir: "ltr" },
  { code: "ko", native: "한국어", english: "Korean", flag: "🇰🇷", dir: "ltr" },
  { code: "id", native: "Bahasa Indonesia", english: "Indonesian", flag: "🇮🇩", dir: "ltr" },
  { code: "ar", native: "العربية", english: "Arabic", flag: "🇸🇦", dir: "rtl" },
];

export const DEFAULT_LOCALE = "en";

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export function getLocale(code: string | undefined): Locale {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

/**
 * Picks the best supported language from an Accept-Language header or the
 * browser's language list, honouring quality values and falling back from a
 * regional tag like `ja-JP` to the base language.
 */
export function matchLocale(preferences: string | readonly string[] | undefined): string {
  if (!preferences) return DEFAULT_LOCALE;

  const entries =
    typeof preferences === "string"
      ? preferences
          .split(",")
          .map((part) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.find((p) => p.trim().startsWith("q="));
            return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
          })
          .sort((a, b) => b.q - a.q)
      : preferences.map((tag) => ({ tag: tag.toLowerCase(), q: 1 }));

  for (const { tag } of entries) {
    if (!tag || tag === "*") continue;
    const exact = LOCALE_CODES.find((code) => code === tag);
    if (exact) return exact;
    const base = tag.split("-")[0];
    const partial = LOCALE_CODES.find((code) => code === base);
    if (partial) return partial;
  }

  return DEFAULT_LOCALE;
}
