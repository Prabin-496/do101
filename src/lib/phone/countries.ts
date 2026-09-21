import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/max";

/**
 * Country names and flags for the region selector and the result cards.
 *
 * Names come from `Intl.DisplayNames`, which every current browser and Node
 * carries, so no country-name list has to be shipped. The locale is pinned to
 * English rather than the visitor's, because the server renders this list too
 * and a locale-dependent name would hydrate differently on each machine.
 */
const DISPLAY = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

/** Codes libphonenumber supports that ISO region names do not cover. */
const NAME_OVERRIDES: Partial<Record<CountryCode, string>> = {
  AC: "Ascension Island",
  TA: "Tristan da Cunha",
  XK: "Kosovo",
};

export function countryName(code: CountryCode | string): string {
  const override = NAME_OVERRIDES[code as CountryCode];
  if (override) return override;
  try {
    return DISPLAY?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Alpha-2 to the pair of regional indicator symbols browsers draw as a flag. */
export function countryFlag(code: CountryCode | string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export interface RegionOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

/** Every region libphonenumber has a numbering plan for, sorted by name. */
export function regionOptions(): RegionOption[] {
  return getCountries()
    .map((code) => ({
      code,
      name: countryName(code),
      callingCode: getCountryCallingCode(code),
      flag: countryFlag(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/**
 * ITU-assigned global service codes: ranges that belong to a service rather
 * than to a country.
 *
 * These matter because a caller ID starting +882 looks like a country code to
 * most people and is not one, and because several of them bill far above a
 * normal call — which is the entire business model behind a missed call that
 * invites you to ring back.
 *
 * Assignments are from ITU-T Recommendation E.164; libphonenumber carries the
 * same set under its `nonGeographic` metadata.
 */
export interface GlobalService {
  name: string;
  detail: string;
  /** True when calls to the range routinely cost far more than a normal call. */
  costly: boolean;
}

export const GLOBAL_SERVICES: Record<string, GlobalService> = {
  "800": {
    name: "Universal International Freephone",
    detail:
      "A worldwide freephone number, so the person called pays instead of you. It belongs to an organisation rather than to a country.",
    costly: false,
  },
  "808": {
    name: "International Shared Cost Service",
    detail: "The cost of the call is split between you and the organisation you are ringing.",
    costly: false,
  },
  "870": {
    name: "Inmarsat satellite",
    detail:
      "A satellite terminal, typically on a ship, an aircraft or a remote site. It is not in any country.",
    costly: true,
  },
  "878": {
    name: "Universal Personal Telecommunications",
    detail:
      "A personal number that follows someone around and forwards to wherever they are. It says nothing about where they are.",
    costly: false,
  },
  "881": {
    name: "Global mobile satellite",
    detail: "A satellite handset — Iridium, Thuraya, Globalstar and similar networks.",
    costly: true,
  },
  "882": {
    name: "International network",
    detail:
      "A network that operates across borders rather than inside one country, such as a maritime or corporate network.",
    costly: true,
  },
  "883": {
    name: "International network",
    detail:
      "A network that operates across borders rather than inside one country, such as a maritime or corporate network.",
    costly: true,
  },
  "888": {
    name: "Disaster relief (OCHA)",
    detail:
      "Reserved by the ITU for United Nations disaster-relief operations. Very few numbers in it are live.",
    costly: false,
  },
  "979": {
    name: "International Premium Rate Service",
    detail:
      "A premium-rate range with no country behind it. Calls are billed well above a normal international call.",
    costly: true,
  },
};
