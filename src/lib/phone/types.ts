import type { CountryCode, NumberType, ValidatePhoneNumberLengthResult } from "libphonenumber-js/max";

/**
 * How much weight a single line of the result deserves.
 *
 * The whole point of this tool is that a phone number carries far less
 * information than people assume, so every fact it shows says where it came
 * from. Nothing is presented as a conclusion when it is a guess.
 */
export type Confidence =
  /** Determined from the bundled numbering plan. It is a fact about the number. */
  | "verified"
  /** Real data, but indicative: allocation records go stale, ranges get ported. */
  | "info"
  /** The bundled data has nothing for this number. Not "none" — just not known here. */
  | "unknown";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  verified: "Verified",
  info: "Information",
  unknown: "Unknown",
};

export type Failure =
  /** Nothing typed yet. */
  | "empty"
  /** No digits at all, or far too few to be a phone number anywhere. */
  | "not-a-number"
  /** Digits, but no + prefix and no country chosen, so there is nothing to measure against. */
  | "no-region"
  /** A + prefix that matches no assigned country calling code. */
  | "unknown-calling-code";

export interface Analysis {
  /** Exactly what the visitor typed, kept so the report can quote it back. */
  input: string;
  /** Set when the number could not be read far enough to say anything useful. */
  failure?: Failure;

  /** Whether the country came from the number itself or from the selector. */
  detectedFrom: "prefix" | "selector" | "none";
  /** The region the visitor had selected, if any. */
  selectedRegion?: CountryCode;

  /** ISO 3166-1 alpha-2, only when the plan pins the number to one country. */
  country?: CountryCode;
  /** Every country the calling code and prefix could belong to. */
  possibleCountries: CountryCode[];
  /** Digits after the +, before the national number. */
  callingCode?: string;
  /** The number without its calling code. */
  nationalNumber?: string;

  /** An ITU global service code (satellite, freephone, international networks). */
  nonGeographic: boolean;

  e164?: string;
  international?: string;
  national?: string;

  /** What the plan says this range is for. Undefined when the plan cannot tell. */
  type: NumberType;
  /** The number matches an allocated range in the plan. */
  valid: boolean;
  /** The length works for the plan, even if no range matches. */
  possible: boolean;
  /** Why the length is wrong, when it is. */
  lengthProblem?: ValidatePhoneNumberLengthResult;
  /** Digits in the national number, or in the whole input when unparsed. */
  digits: number;
}

export type SignalTone = "caution" | "info" | "good";

/**
 * One observation about the number. Never a verdict: a signal says what was
 * observed and what it does and does not imply.
 */
export interface Signal {
  id: string;
  tone: SignalTone;
  title: string;
  detail: string;
  confidence: Confidence;
}

/** What the bundled prefix tables know about a number. */
export interface PrefixInfo {
  /** Where the prefix is issued — a numbering region, never a live position. */
  region: string | null;
  /** The network the range was originally allocated to. */
  carrier: string | null;
  /** The longest prefix that matched, so the UI can show what was matched on. */
  regionPrefix: string | null;
  carrierPrefix: string | null;
  /** False when no table ships for this calling code at all. */
  regionDataExists: boolean;
  carrierDataExists: boolean;
}

export const EMPTY_PREFIX_INFO: PrefixInfo = {
  region: null,
  carrier: null,
  regionPrefix: null,
  carrierPrefix: null,
  regionDataExists: false,
  carrierDataExists: false,
};
