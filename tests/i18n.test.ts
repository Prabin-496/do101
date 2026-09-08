import { describe, it, expect } from "vitest";
import { matchLocale, getLocale, LOCALES, LOCALE_CODES, DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getMessages, type Messages } from "@/lib/i18n/messages";

describe("locale matching", () => {
  it("picks Japanese for a Japanese browser", () => {
    expect(matchLocale("ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("ja");
    expect(matchLocale(["ja-JP", "en-US"])).toBe("ja");
  });

  it("falls back from a regional tag to the base language", () => {
    expect(matchLocale("pt-BR")).toBe("pt");
    expect(matchLocale("zh-Hans-CN")).toBe("zh");
    expect(matchLocale("es-419")).toBe("es");
  });

  it("honours quality values rather than document order", () => {
    // German is listed second but preferred.
    expect(matchLocale("fr;q=0.2,de;q=0.9")).toBe("de");
  });

  it("skips languages DO101 does not have", () => {
    expect(matchLocale("sv-SE,sv;q=0.9,fr;q=0.5")).toBe("fr");
  });

  it("defaults to English for unknown, empty or wildcard input", () => {
    expect(matchLocale("sv-SE,da;q=0.8")).toBe(DEFAULT_LOCALE);
    expect(matchLocale("")).toBe(DEFAULT_LOCALE);
    expect(matchLocale("*")).toBe(DEFAULT_LOCALE);
    expect(matchLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("is case insensitive", () => {
    expect(matchLocale("JA-JP")).toBe("ja");
  });
});

describe("locale registry", () => {
  it("has unique codes and marks Arabic right-to-left", () => {
    expect(new Set(LOCALE_CODES).size).toBe(LOCALES.length);
    expect(getLocale("ar").dir).toBe("rtl");
    expect(getLocale("ja").dir).toBe("ltr");
  });

  it("falls back to English for an unknown code", () => {
    expect(getLocale("xx").code).toBe("en");
    expect(getLocale(undefined).code).toBe("en");
  });

  it("names every language in its own script", () => {
    expect(getLocale("ja").native).toBe("日本語");
    expect(getLocale("ne").native).toBe("नेपाली");
    expect(getLocale("ar").native).toBe("العربية");
  });
});

describe("translations", () => {
  const englishKeys = Object.keys(getMessages("en")) as Array<keyof Messages>;

  it("translates every key in every language", () => {
    for (const locale of LOCALES) {
      const messages = getMessages(locale.code);
      for (const key of englishKeys) {
        expect(messages[key], `${locale.code} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("actually differs from English rather than copying it", () => {
    for (const locale of LOCALES.filter((l) => l.code !== "en")) {
      const messages = getMessages(locale.code);
      const untranslated = englishKeys.filter(
        // "PDF" and "AI" legitimately stay the same in several languages.
        (key) => messages[key] === getMessages("en")[key] && !["nav.pdf", "nav.ai"].includes(key),
      );
      expect(untranslated, `${locale.code} left ${untranslated.length} strings in English`).toHaveLength(0);
    }
  });

  it("falls back to English for an unknown locale", () => {
    expect(getMessages("xx")).toEqual(getMessages("en"));
  });
});
