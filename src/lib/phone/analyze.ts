import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js/max";
import { GLOBAL_SERVICES } from "./countries";
import type { Analysis } from "./types";

/**
 * Reads a phone number against Google's libphonenumber numbering plans.
 *
 * Everything here is offline and synchronous: the plans are bundled with the
 * page, so nothing about the number leaves the device. The function is
 * deliberately generous about input — people paste numbers with brackets,
 * dots, non-breaking spaces and Arabic-Indic digits — and deliberately strict
 * about conclusions.
 */

/** Every calling code in use, longest first, so the longest match wins. */
const CALLING_CODES: string[] = (() => {
  const set = new Set<string>(Object.keys(GLOBAL_SERVICES));
  for (const country of getCountries()) set.add(getCountryCallingCode(country));
  return [...set].sort((a, b) => b.length - a.length);
})();

export function callingCodeOf(digits: string): string | undefined {
  return CALLING_CODES.find((code) => digits.startsWith(code));
}

const DIGITS = /[0-9٠-٩۰-۹०-९]/g;

/** Keeps ASCII digits and folds the Arabic-Indic and Devanagari sets onto them. */
export function toAsciiDigits(text: string): string {
  return (text.match(DIGITS) ?? [])
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (c <= 0x39) return ch;
      if (c >= 0x0966) return String((c - 0x0966) % 10);
      if (c >= 0x06f0) return String((c - 0x06f0) % 10);
      return String((c - 0x0660) % 10);
    })
    .join("");
}

/**
 * Normalises the shapes people actually type into something libphonenumber
 * will accept: a leading `+`, or bare digits with a region to measure against.
 *
 * `00` is the ITU international access prefix and is how most of the world
 * writes a foreign number on paper, so it is treated as a `+`. `011` is the
 * North American equivalent and is only read that way when the visitor has
 * actually picked a NANP region, because `011…` is a perfectly ordinary start
 * to a number elsewhere.
 */
export function normalizeInput(
  raw: string,
  region?: CountryCode,
): { text: string; hadPlus: boolean; digits: string } {
  const trimmed = raw.trim();
  const digits = toAsciiDigits(trimmed);
  const hasPlus = /\+/.test(trimmed);

  if (hasPlus) return { text: `+${digits}`, hadPlus: true, digits };

  if (digits.startsWith("00") && digits.length > 4) {
    return { text: `+${digits.slice(2)}`, hadPlus: true, digits: digits.slice(2) };
  }

  const nanp = region ? getCountryCallingCode(region) === "1" : false;
  if (nanp && digits.startsWith("011") && digits.length > 5) {
    return { text: `+${digits.slice(3)}`, hadPlus: true, digits: digits.slice(3) };
  }

  return { text: digits, hadPlus: false, digits };
}

const BLANK: Omit<Analysis, "input"> = {
  detectedFrom: "none",
  possibleCountries: [],
  nonGeographic: false,
  type: undefined,
  valid: false,
  possible: false,
  digits: 0,
};

export function analyze(raw: string, region?: CountryCode): Analysis {
  const input = raw.trim();
  if (!input) return { ...BLANK, input, failure: "empty" };

  const { text, hadPlus, digits } = normalizeInput(input, region);

  if (digits.length < 3) {
    return { ...BLANK, input, failure: "not-a-number", digits: digits.length };
  }
  if (!hadPlus && !region) {
    return { ...BLANK, input, failure: "no-region", digits: digits.length };
  }

  const parsed = parsePhoneNumberFromString(text, hadPlus ? undefined : region);
  const lengthProblem = validatePhoneNumberLength(text, hadPlus ? undefined : region);

  if (!parsed) {
    // No PhoneNumber, but the calling code alone is often enough to explain why.
    const callingCode = hadPlus ? callingCodeOf(digits) : region ? getCountryCallingCode(region) : undefined;
    if (hadPlus && !callingCode) {
      return {
        ...BLANK,
        input,
        failure: "unknown-calling-code",
        detectedFrom: "prefix",
        digits: digits.length,
        lengthProblem,
      };
    }
    return {
      ...BLANK,
      input,
      failure: lengthProblem === "NOT_A_NUMBER" ? "not-a-number" : undefined,
      detectedFrom: hadPlus ? "prefix" : "selector",
      selectedRegion: region,
      callingCode,
      nationalNumber: callingCode && hadPlus ? digits.slice(callingCode.length) : digits,
      possibleCountries: callingCode ? countriesFor(callingCode) : [],
      nonGeographic: Boolean(callingCode && callingCode in GLOBAL_SERVICES),
      digits: digits.length,
      lengthProblem,
    };
  }

  const possible = parsed.getPossibleCountries();
  const callingCode = parsed.countryCallingCode;

  return {
    input,
    detectedFrom: hadPlus ? "prefix" : "selector",
    selectedRegion: region,
    country: parsed.country,
    possibleCountries: parsed.country ? [parsed.country] : possible.length ? possible : countriesFor(callingCode),
    callingCode,
    nationalNumber: String(parsed.nationalNumber),
    nonGeographic: parsed.isNonGeographic(),
    e164: parsed.number,
    international: parsed.formatInternational(),
    national: parsed.formatNational(),
    type: parsed.getType(),
    valid: parsed.isValid(),
    possible: parsed.isPossible(),
    lengthProblem,
    digits: String(parsed.nationalNumber).length,
  };
}

/** Every country that shares a calling code, for the ambiguous ones like +1 and +44. */
export function countriesFor(callingCode: string): CountryCode[] {
  return getCountries().filter((country) => getCountryCallingCode(country) === callingCode);
}
