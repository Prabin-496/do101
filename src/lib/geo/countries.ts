/**
 * Country reference data.
 *
 * Facts come from the `world-countries` dataset, which is published under the
 * Open Database Licence — the globe page credits it, as ODbL requires. Only
 * fields that actually exist in the dataset are exposed here: no population
 * figures are shown, because the dataset does not carry them and inventing
 * them would be worse than omitting them.
 */

export interface CountryFact {
  /** ISO 3166-1 alpha-3, which is also the key used by the map topology. */
  code: string;
  /** ISO 3166-1 alpha-2, used for flag lookups. */
  code2: string;
  /** Numeric ISO code — how the TopoJSON identifies each shape. */
  numeric: string;
  name: string;
  official: string;
  flag: string;
  capital: string[];
  region: string;
  subregion: string;
  /** Square kilometres. */
  area: number;
  latlng: [number, number];
  languages: string[];
  currencies: string[];
  /** Alpha-3 codes of land neighbours. */
  borders: string[];
  landlocked: boolean;
  unMember: boolean;
  /** Localised names, keyed by three-letter language code. */
  translations: Record<string, string>;
}

export const REGION_COLORS: Record<string, string> = {
  Africa: "#f0a04b",
  Americas: "#5bc8ac",
  Asia: "#ef7c8e",
  Europe: "#7aa2f7",
  Oceania: "#b48ead",
  Antarctic: "#a8b8c4",
  "": "#9aa7b1",
};

interface RawCountry {
  cca2: string;
  cca3: string;
  ccn3?: string;
  name: { common: string; official: string };
  flag: string;
  capital?: string[];
  region: string;
  subregion?: string;
  area: number;
  latlng: number[];
  languages?: Record<string, string>;
  currencies?: Record<string, unknown>;
  borders?: string[];
  landlocked: boolean;
  unMember: boolean;
  translations?: Record<string, { common: string; official: string }>;
}

/** Loaded lazily: the dataset is ~1 MB and only the globe needs it. */
export async function loadCountries(): Promise<CountryFact[]> {
  const dataset = await import("world-countries");
  const raw = (dataset.default ?? dataset) as unknown as RawCountry[];

  return raw
    .map((country) => ({
      code: country.cca3,
      code2: country.cca2,
      numeric: country.ccn3 ?? "",
      name: country.name.common,
      official: country.name.official,
      flag: country.flag,
      capital: country.capital ?? [],
      region: country.region || "",
      subregion: country.subregion || "",
      area: country.area,
      latlng: [country.latlng[0] ?? 0, country.latlng[1] ?? 0] as [number, number],
      languages: Object.values(country.languages ?? {}),
      currencies: Object.keys(country.currencies ?? {}),
      borders: country.borders ?? [],
      landlocked: country.landlocked,
      unMember: country.unMember,
      translations: Object.fromEntries(
        Object.entries(country.translations ?? {}).map(([lang, value]) => [lang, value.common]),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Formats an area with a sensible unit, since countries span nine orders of magnitude. */
export function formatArea(km2: number): string {
  if (!Number.isFinite(km2) || km2 <= 0) return "—";
  if (km2 < 1000) return `${km2.toLocaleString()} km²`;
  if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(2)} million km²`;
  return `${Math.round(km2).toLocaleString()} km²`;
}

/** Great-circle distance in kilometres, used for "how far from here". */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function searchCountries(countries: CountryFact[], query: string, limit = 8): CountryFact[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = countries
    .map((country) => {
      const name = country.name.toLowerCase();
      const official = country.official.toLowerCase();
      const capital = country.capital.join(" ").toLowerCase();

      let score = -1;
      if (name === q || country.code.toLowerCase() === q || country.code2.toLowerCase() === q) {
        score = 100;
      } else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (capital.startsWith(q)) score = 50;
      else if (official.includes(q)) score = 40;
      else if (capital.includes(q)) score = 30;
      else if (Object.values(country.translations).some((t) => t.toLowerCase().startsWith(q))) {
        score = 45;
      }
      return { country, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.country.name.localeCompare(b.country.name));

  return scored.slice(0, limit).map((entry) => entry.country);
}
