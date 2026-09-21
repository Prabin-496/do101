import { describe, it, expect } from "vitest";
import { analyze, callingCodeOf, normalizeInput, toAsciiDigits } from "@/lib/phone/analyze";
import { countryFlag, countryName, regionOptions, GLOBAL_SERVICES } from "@/lib/phone/countries";
import { countryValue, typeLabel, validity } from "@/lib/phone/describe";
import {
  lookupPrefix,
  matchPrefix,
  type LookupSources,
  type PrefixTable,
} from "@/lib/phone/prefix";
import { buildReport } from "@/lib/phone/report";
import { dramaRange, isRepeated, isSequential, signals, SAFETY_GUIDANCE } from "@/lib/phone/risk";
import { EMPTY_PREFIX_INFO } from "@/lib/phone/types";

const ids = (input: string, region?: Parameters<typeof analyze>[1]) =>
  signals(analyze(input, region)).map((s) => s.id);

describe("digit normalisation", () => {
  it("keeps ASCII digits and drops the punctuation people type", () => {
    expect(toAsciiDigits("+1 (202) 555-0143")).toBe("12025550143");
    expect(toAsciiDigits("03–12–34–5678")).toBe("0312345678");
  });

  it("folds Arabic-Indic and Devanagari digits onto ASCII", () => {
    expect(toAsciiDigits("٩٨٧٦٥")).toBe("98765");
    expect(toAsciiDigits("९८७")).toBe("987");
  });

  it("reads 00 as the international prefix", () => {
    expect(normalizeInput("0081 90 1234 5678")).toEqual({
      text: "+819012345678",
      hadPlus: true,
      digits: "819012345678",
    });
  });

  it("only reads 011 as an international prefix inside the NANP", () => {
    expect(normalizeInput("011 81 90 1234 5678", "US").text).toBe("+819012345678");
    // 011... is an ordinary start to a number elsewhere, so it is left alone.
    expect(normalizeInput("011 8888 8888", "GB").text).toBe("01188888888");
  });

  it("finds the longest matching calling code", () => {
    expect(callingCodeOf("819012345678")).toBe("81");
    expect(callingCodeOf("12025550143")).toBe("1");
    expect(callingCodeOf("883120001234")).toBe("883");
    expect(callingCodeOf("999123456789")).toBeUndefined();
  });
});

describe("international numbers", () => {
  it("reads a Japanese mobile", () => {
    const a = analyze("+81 90 1234 5678");
    expect(a.country).toBe("JP");
    expect(a.callingCode).toBe("81");
    expect(a.type).toBe("MOBILE");
    expect(a.valid).toBe(true);
    expect(a.e164).toBe("+819012345678");
    expect(a.detectedFrom).toBe("prefix");
  });

  it("reads a Japanese landline typed in local format once Japan is selected", () => {
    const a = analyze("03-1234-5678", "JP");
    expect(a.country).toBe("JP");
    expect(a.type).toBe("FIXED_LINE");
    expect(a.valid).toBe(true);
    expect(a.detectedFrom).toBe("selector");
    expect(a.national).toBe("03-1234-5678");
  });

  it("reads a US number in either notation", () => {
    const international = analyze("+1 (202) 555-0143");
    const local = analyze("(202) 555-0143", "US");
    expect(international.country).toBe("US");
    expect(international.type).toBe("FIXED_LINE_OR_MOBILE");
    expect(local.e164).toBe(international.e164);
  });

  it("reads an Indian mobile with and without the country code", () => {
    const a = analyze("+91 98765 43210");
    const b = analyze("98765 43210", "IN");
    expect(a.country).toBe("IN");
    expect(a.type).toBe("MOBILE");
    expect(b.e164).toBe(a.e164);
  });

  it("keeps every country that shares a calling code when the number does not settle it", () => {
    const a = analyze("+44 7700 900123");
    expect(a.callingCode).toBe("44");
    expect(a.country).toBeUndefined();
    expect(a.possibleCountries.length).toBeGreaterThan(1);
    expect(countryValue(a).confidence).toBe("info");
  });

  it("recognises premium rate and freephone ranges", () => {
    expect(analyze("+1 900 555 0199").type).toBe("PREMIUM_RATE");
    expect(analyze("+1 800 555 0199").type).toBe("TOLL_FREE");
  });

  it("marks ITU global service codes as non-geographic", () => {
    const a = analyze("+870 773 111 632");
    expect(a.nonGeographic).toBe(true);
    expect(a.country).toBeUndefined();
    expect(countryValue(a).value).toContain("Not a country");
    expect(GLOBAL_SERVICES["870"].costly).toBe(true);
  });
});

describe("numbers that cannot be read", () => {
  it("reports an empty box rather than failing silently", () => {
    expect(analyze("").failure).toBe("empty");
    expect(analyze("   ").failure).toBe("empty");
  });

  it("rejects text and stray digits", () => {
    expect(analyze("hello there").failure).toBe("not-a-number");
    expect(analyze("12").failure).toBe("not-a-number");
  });

  it("asks for a region when there is no prefix to work from", () => {
    const a = analyze("5550143");
    expect(a.failure).toBe("no-region");
    expect(a.country).toBeUndefined();
  });

  it("names an unassigned calling code as the problem", () => {
    const a = analyze("+999 123 456 789");
    expect(a.failure).toBe("unknown-calling-code");
    expect(a.detectedFrom).toBe("prefix");
  });

  it("still reports the country when only the length is wrong", () => {
    const short = analyze("+81 90 1234");
    expect(short.failure).toBeUndefined();
    expect(short.country).toBe("JP");
    expect(short.valid).toBe(false);
    expect(short.lengthProblem).toBe("TOO_SHORT");
    expect(validity(short).value).toBe("Too short");
  });

  it("reports a valid-length but unallocated prefix as not allocated", () => {
    const a = analyze("+1 000 555 0143");
    expect(a.valid).toBe(false);
    expect(validity(a).value).toMatch(/Not allocated|Not a usable number/);
  });
});

describe("local risk rules", () => {
  it("spots repeated and sequential digit runs", () => {
    expect(isRepeated("0000000000")).toBe(true);
    expect(isRepeated("0123456789")).toBe(false);
    expect(isSequential("123456789")).toBe(true);
    expect(isSequential("987654321")).toBe(true);
    expect(isSequential("9012345678")).toBe(false);
    expect(isSequential("12345")).toBe(false);
  });

  it("recognises the ranges regulators reserve for drama", () => {
    expect(dramaRange(analyze("+1 202 555 0143"))).toBeTruthy();
    expect(dramaRange(analyze("+44 7700 900123"))).toBeTruthy();
    expect(dramaRange(analyze("+44 20 7946 0321"))).toBeTruthy();
    expect(dramaRange(analyze("+81 90 1234 5678"))).toBeUndefined();
  });

  it("does not call a drama-range number ordinary, nor claim it is invalid when it is not", () => {
    const a = analyze("+1 202 555 0143");
    expect(a.valid).toBe(true);
    const found = signals(a);
    expect(found.map((s) => s.id)).toContain("drama");
    expect(found.map((s) => s.id)).not.toContain("clean");
    expect(found.find((s) => s.id === "drama")?.detail).not.toMatch(/reads as invalid/);
  });

  it("flags premium rate as a cost warning", () => {
    const found = signals(analyze("+1 900 555 0199"));
    const premium = found.find((s) => s.id === "premium");
    expect(premium?.tone).toBe("caution");
  });

  it("flags costly global service codes and leaves freephone alone", () => {
    const satellite = signals(analyze("+870 773 111 632")).find((s) => s.id === "global-service");
    expect(satellite?.tone).toBe("caution");
    const freephone = signals(analyze("+800 1234 5678")).find((s) => s.id === "global-service");
    expect(freephone?.tone).toBe("info");
  });

  it("does not repeat the range's purpose under a global service code", () => {
    const found = ids("+800 1234 5678");
    expect(found).toContain("global-service");
    expect(found).not.toContain("type-toll_free");
    // The same type on an ordinary country number is still worth saying.
    expect(ids("+1 800 555 0199")).toContain("type-toll_free");
  });

  it("notes when the + prefix disagrees with the selected country", () => {
    expect(ids("+81 90 1234 5678", "US")).toContain("region-mismatch");
    expect(ids("+81 90 1234 5678", "JP")).not.toContain("region-mismatch");
  });

  it("gives an ordinary valid number a note, never a clean bill of health", () => {
    const found = signals(analyze("+81 90 1234 5678"));
    const clean = found.find((s) => s.id === "clean");
    expect(clean?.tone).toBe("good");
    expect(clean?.detail).toMatch(/most scam calls/i);
    expect(found.some((s) => s.tone === "caution")).toBe(false);
  });

  it("never claims a number is a scammer or is safe", () => {
    const wording = [
      ...SAFETY_GUIDANCE.flatMap((g) => [g.title, g.detail]),
      ...["+1 900 555 0199", "+81 90 1234 5678", "+870 773 111 632", "+1 000 555 0143"].flatMap(
        (n) => signals(analyze(n)).flatMap((s) => [s.title, s.detail]),
      ),
    ].join(" ");
    expect(wording).not.toMatch(/\b(is a scam|is a scammer|definitely safe|guaranteed safe)\b/i);
  });

  it("says nothing at all about a number that could not be read", () => {
    expect(signals(analyze("hello"))).toEqual([]);
  });
});

describe("prefix tables", () => {
  const geocodes: PrefixTable = {
    names: ["Tokyo", "Yokohama, Kanagawa"],
    prefixes: { "3": 0, "45": 1 },
  };
  const carrier: PrefixTable = { names: ["NTT Docomo"], prefixes: { "9012": 0 } };

  const sources: LookupSources = {
    index: async () => ({ geocodes: ["81"], carrier: ["81"] }),
    table: async (kind) => (kind === "geocodes" ? geocodes : carrier),
  };

  it("prefers the longest matching prefix", () => {
    const table: PrefixTable = { names: ["State", "City"], prefixes: { "201": 0, "2015": 1 } };
    expect(matchPrefix(table, "2015550100")?.name).toBe("City");
    expect(matchPrefix(table, "2019990100")?.name).toBe("State");
    expect(matchPrefix(table, "9999999999")).toBeNull();
  });

  it("returns the region and carrier a number matches", async () => {
    const info = await lookupPrefix("81", "9012345678", sources);
    expect(info.carrier).toBe("NTT Docomo");
    expect(info.carrierPrefix).toBe("9012");
    expect(info.region).toBeNull();
    expect(info.regionDataExists).toBe(true);
  });

  it("matches a landline prefix on the geocode table", async () => {
    const info = await lookupPrefix("81", "312345678", sources);
    expect(info.region).toBe("Tokyo");
    expect(info.carrier).toBeNull();
  });

  it("says nothing when no table ships for the calling code", async () => {
    const info = await lookupPrefix("99", "123456", {
      index: async () => ({ geocodes: [], carrier: [] }),
      table: async () => null,
    });
    expect(info).toEqual(EMPTY_PREFIX_INFO);
  });

  it("does not look anything up without a number", async () => {
    expect(await lookupPrefix(undefined, undefined, sources)).toEqual(EMPTY_PREFIX_INFO);
  });
});

describe("country reference data", () => {
  it("names countries in English regardless of the machine's locale", () => {
    expect(countryName("JP")).toBe("Japan");
    expect(countryName("XK")).toBe("Kosovo");
  });

  it("turns alpha-2 codes into flags and falls back for non-countries", () => {
    expect(countryFlag("JP")).toBe("\u{1F1EF}\u{1F1F5}");
    expect(countryFlag("870")).toBe("\u{1F310}");
  });

  it("offers every supported region, sorted by name", () => {
    const options = regionOptions();
    expect(options.length).toBeGreaterThan(200);
    expect(options.find((o) => o.code === "JP")?.callingCode).toBe("81");
    const names = options.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("the copied report", () => {
  it("labels every line with where it came from", () => {
    const a = analyze("+81 90 1234 5678");
    const text = buildReport(a, { ...EMPTY_PREFIX_INFO, carrier: "NTT Docomo", carrierPrefix: "9012", carrierDataExists: true }, signals(a));
    expect(text).toContain("Country: Japan [Verified]");
    expect(text).toContain("Number type: Mobile [Verified]");
    expect(text).toContain("Carrier at allocation: NTT Docomo [Information]");
    expect(text).toContain("Numbering region: Unknown / not available [Unknown]");
    expect(text).toMatch(/Caller ID can be faked/);
    expect(text).toMatch(/not sent anywhere|was not sent anywhere/);
  });

  it("does not pretend to have looked anything up when parsing failed", () => {
    const a = analyze("hello");
    const text = buildReport(a, EMPTY_PREFIX_INFO, []);
    expect(text).toContain("Could not be read as a phone number");
    expect(text).not.toContain("Country:");
  });

  it("describes an unknown type honestly", () => {
    const label = typeLabel({ ...analyze("+44 7700 900123") });
    expect(label.value).toBe("Unknown / not available");
    expect(label.confidence).toBe("unknown");
  });
});
