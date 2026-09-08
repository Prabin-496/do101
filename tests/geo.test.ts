import { describe, it, expect } from "vitest";
import { formatArea, haversineKm, searchCountries, type CountryFact } from "@/lib/geo/countries";
import { indexToColor, colorToIndex, shortestDelta } from "@/lib/geo/globe";

const country = (over: Partial<CountryFact> = {}): CountryFact => ({
  code: "JPN",
  code2: "JP",
  numeric: "392",
  name: "Japan",
  official: "Japan",
  flag: "🇯🇵",
  capital: ["Tokyo"],
  region: "Asia",
  subregion: "Eastern Asia",
  area: 377930,
  latlng: [36, 138],
  languages: ["Japanese"],
  currencies: ["JPY"],
  borders: [],
  landlocked: false,
  unMember: true,
  translations: { jpn: "日本", fra: "Japon" },
  ...over,
});

describe("country search", () => {
  const countries = [
    country(),
    country({ code: "NPL", code2: "NP", name: "Nepal", capital: ["Kathmandu"], official: "Federal Democratic Republic of Nepal" }),
    country({ code: "PER", code2: "PE", name: "Peru", capital: ["Lima"], official: "Republic of Peru" }),
  ];

  it("finds a country by name, code and capital", () => {
    expect(searchCountries(countries, "japan")[0].code).toBe("JPN");
    expect(searchCountries(countries, "NP")[0].code).toBe("NPL");
    expect(searchCountries(countries, "lima")[0].code).toBe("PER");
  });

  it("ranks an exact name above a partial match", () => {
    const results = searchCountries(countries, "nepal");
    expect(results[0].code).toBe("NPL");
  });

  it("finds a country by its localised name", () => {
    expect(searchCountries(countries, "japon")[0].code).toBe("JPN");
  });

  it("returns nothing for an empty or unmatched query", () => {
    expect(searchCountries(countries, "")).toHaveLength(0);
    expect(searchCountries(countries, "zzzzz")).toHaveLength(0);
  });

  it("honours the result limit", () => {
    expect(searchCountries(countries, "a", 2).length).toBeLessThanOrEqual(2);
  });
});

describe("area formatting", () => {
  it("scales the unit to the magnitude", () => {
    expect(formatArea(316)).toBe("316 km²");
    expect(formatArea(377930)).toBe("377,930 km²");
    expect(formatArea(17_098_242)).toBe("17.10 million km²");
    expect(formatArea(0)).toBe("—");
  });
});

describe("great-circle distance between countries", () => {
  it("gives a plausible Japan to Nepal distance", () => {
    // Roughly 4,700 km between the two centroids.
    const km = haversineKm([36, 138], [28, 84]);
    expect(km).toBeGreaterThan(4300);
    expect(km).toBeLessThan(5200);
  });
});

describe("globe picking buffer", () => {
  it("round-trips an index through a colour", () => {
    for (const index of [0, 1, 42, 255, 256, 65_535, 200_000]) {
      const rgb = indexToColor(index).match(/\d+/g)!.map(Number);
      expect(colorToIndex(rgb[0], rgb[1], rgb[2])).toBe(index);
    }
  });

  it("never produces pure black, which marks empty space", () => {
    expect(indexToColor(0)).not.toBe("rgb(0, 0, 0)");
  });
});

describe("rotation", () => {
  it("always takes the short way round", () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
    expect(shortestDelta(0, 180)).toBe(180);
    expect(Math.abs(shortestDelta(0, 181))).toBeLessThanOrEqual(180);
  });
});
