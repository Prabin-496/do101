import type { PhoneNumberType } from "libphonenumber-js/max";
import { GLOBAL_SERVICES, countryName } from "./countries";
import type { Analysis, Confidence } from "./types";

/**
 * Plain-English readings of what the numbering plan says.
 *
 * libphonenumber's type comes from the operator ranges a country publishes,
 * so "MOBILE" means "this range is allocated for mobile service", not "a
 * mobile phone answered". The blurbs say so, because the difference is
 * exactly what people get wrong.
 */
export const NUMBER_TYPE_META: Record<PhoneNumberType, { label: string; blurb: string }> = {
  MOBILE: {
    label: "Mobile",
    blurb: "The range is allocated for mobile service, so the number can normally receive texts.",
  },
  FIXED_LINE: {
    label: "Landline",
    blurb: "A fixed line tied to an address, though the address itself is not public.",
  },
  FIXED_LINE_OR_MOBILE: {
    label: "Landline or mobile",
    blurb:
      "This country does not separate the two in its numbering plan, so the range could be either. That is a limit of the plan, not a missing lookup.",
  },
  VOIP: {
    label: "VoIP / internet calling",
    blurb:
      "An internet calling number. These are cheap, quick to obtain and easy to give up, which is why they turn up often in nuisance calling — and also why plenty of ordinary businesses use them.",
  },
  TOLL_FREE: {
    label: "Freephone",
    blurb: "The organisation being called pays for the call rather than you.",
  },
  PREMIUM_RATE: {
    label: "Premium rate",
    blurb:
      "Calls and texts to this range are charged well above a normal call, and part of the charge goes to whoever runs the number.",
  },
  SHARED_COST: {
    label: "Shared cost",
    blurb: "The cost is split between the caller and the organisation being called.",
  },
  PERSONAL_NUMBER: {
    label: "Personal / follow-me number",
    blurb:
      "A number that forwards to wherever its owner is. It tells you nothing about where the call actually lands.",
  },
  PAGER: { label: "Pager", blurb: "A paging service rather than a voice line." },
  UAN: {
    label: "Universal access number",
    blurb: "A single national number for an organisation, routed to whichever site answers.",
  },
  VOICEMAIL: { label: "Voicemail", blurb: "A voicemail access range rather than a subscriber line." },
};

export function typeLabel(analysis: Analysis): { value: string; confidence: Confidence; blurb: string } {
  if (analysis.type) {
    const meta = NUMBER_TYPE_META[analysis.type];
    return { value: meta.label, confidence: analysis.valid ? "verified" : "info", blurb: meta.blurb };
  }
  if (analysis.callingCode && analysis.callingCode in GLOBAL_SERVICES) {
    const service = GLOBAL_SERVICES[analysis.callingCode];
    return { value: service.name, confidence: "verified", blurb: service.detail };
  }
  return {
    value: "Unknown / not available",
    confidence: "unknown",
    blurb:
      "The numbering plan for this country does not publish a type for this range, so nothing can honestly be said about it.",
  };
}

export function validity(analysis: Analysis): {
  value: string;
  confidence: Confidence;
  blurb: string;
} {
  if (analysis.valid) {
    return {
      value: "Valid number",
      confidence: "verified",
      blurb:
        "The number matches a range that is in use in this numbering plan. That means it could exist — not that it is in service, and not that whoever calls from it is who they say.",
    };
  }
  if (analysis.lengthProblem === "TOO_SHORT") {
    return {
      value: "Too short",
      confidence: "verified",
      blurb: "There are fewer digits than any range in this plan allows. Digits are probably missing.",
    };
  }
  if (analysis.lengthProblem === "TOO_LONG") {
    return {
      value: "Too long",
      confidence: "verified",
      blurb: "There are more digits than any range in this plan allows.",
    };
  }
  if (analysis.lengthProblem === "INVALID_LENGTH") {
    return {
      value: "Wrong length",
      confidence: "verified",
      blurb:
        "The digit count is not one this plan uses. Numbers are often mistyped by one digit, so check it against the source.",
    };
  }
  if (analysis.possible) {
    return {
      value: "Not allocated",
      confidence: "verified",
      blurb:
        "The length is right but the prefix does not match any range the country has allocated. A number like this cannot be dialled, though it can still appear on a caller ID.",
    };
  }
  return {
    value: "Not a usable number",
    confidence: "verified",
    blurb: "Nothing in this country's numbering plan matches what was entered.",
  };
}

/** How to describe the country when the plan cannot pin it to exactly one. */
export function countryValue(analysis: Analysis): { value: string; confidence: Confidence } {
  if (analysis.country) {
    return { value: countryName(analysis.country), confidence: "verified" };
  }
  if (analysis.callingCode && analysis.callingCode in GLOBAL_SERVICES) {
    return { value: `Not a country — ${GLOBAL_SERVICES[analysis.callingCode].name}`, confidence: "verified" };
  }
  if (analysis.possibleCountries.length > 1) {
    const shown = analysis.possibleCountries.slice(0, 4).map(countryName);
    const rest = analysis.possibleCountries.length - shown.length;
    return {
      value: `${shown.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`,
      confidence: "info",
    };
  }
  if (analysis.possibleCountries.length === 1) {
    return { value: countryName(analysis.possibleCountries[0]), confidence: "info" };
  }
  return { value: "Unknown / not available", confidence: "unknown" };
}
