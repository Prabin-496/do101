import { EMPTY_PREFIX_INFO, type PrefixInfo } from "./types";

/**
 * Looks a number up in the bundled prefix tables.
 *
 * The tables are Google's libphonenumber geocoding and carrier resources,
 * split by calling code by scripts/build-phone-data.mjs and served as static
 * files. A lookup fetches one file, matches the longest prefix, and keeps the
 * table in memory for the rest of the visit. There is no request to a lookup
 * service and nothing about the number is sent anywhere: the browser asks for
 * /phone-data/geocodes/81.json, which is the same file every +81 visitor asks
 * for and says nothing about which number is being checked.
 */

export interface PrefixTable {
  names: string[];
  prefixes: Record<string, number>;
}

export interface PrefixIndex {
  geocodes: string[];
  carrier: string[];
}

export type TableKind = "geocodes" | "carrier";

/**
 * Longest-prefix match, which is how libphonenumber's own geocoder resolves
 * these tables: +1 201 555 0100 prefers an entry for 2015 over one for 201.
 */
export function matchPrefix(
  table: PrefixTable,
  nationalNumber: string,
): { name: string; prefix: string } | null {
  for (let length = nationalNumber.length; length > 0; length--) {
    const prefix = nationalNumber.slice(0, length);
    const at = table.prefixes[prefix];
    if (at !== undefined && table.names[at]) {
      return { name: table.names[at], prefix };
    }
  }
  return null;
}

export interface LookupSources {
  index(): Promise<PrefixIndex>;
  table(kind: TableKind, callingCode: string): Promise<PrefixTable | null>;
}

const indexCache = new Map<string, Promise<PrefixIndex>>();
const tableCache = new Map<string, Promise<PrefixTable | null>>();

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** The default sources: static files under /phone-data, fetched once each. */
export const staticSources: LookupSources = {
  index() {
    let cached = indexCache.get("index");
    if (!cached) {
      cached = getJson<PrefixIndex>("/phone-data/index.json").then(
        (data) => data ?? { geocodes: [], carrier: [] },
      );
      indexCache.set("index", cached);
    }
    return cached;
  },
  table(kind, callingCode) {
    const key = `${kind}/${callingCode}`;
    let cached = tableCache.get(key);
    if (!cached) {
      cached = getJson<PrefixTable>(`/phone-data/${key}.json`);
      tableCache.set(key, cached);
    }
    return cached;
  },
};

export async function lookupPrefix(
  callingCode: string | undefined,
  nationalNumber: string | undefined,
  sources: LookupSources = staticSources,
): Promise<PrefixInfo> {
  if (!callingCode || !nationalNumber) return EMPTY_PREFIX_INFO;

  const index = await sources.index();
  const regionDataExists = index.geocodes.includes(callingCode);
  const carrierDataExists = index.carrier.includes(callingCode);

  const [geo, carrier] = await Promise.all([
    regionDataExists ? sources.table("geocodes", callingCode) : Promise.resolve(null),
    carrierDataExists ? sources.table("carrier", callingCode) : Promise.resolve(null),
  ]);

  const regionHit = geo ? matchPrefix(geo, nationalNumber) : null;
  const carrierHit = carrier ? matchPrefix(carrier, nationalNumber) : null;

  return {
    region: regionHit?.name ?? null,
    carrier: carrierHit?.name ?? null,
    regionPrefix: regionHit?.prefix ?? null,
    carrierPrefix: carrierHit?.prefix ?? null,
    regionDataExists,
    carrierDataExists,
  };
}
