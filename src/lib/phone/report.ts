import { countryValue, typeLabel, validity } from "./describe";
import { CONFIDENCE_LABEL, type Analysis, type PrefixInfo, type Signal } from "./types";

/**
 * The plain-text version of the result, for the Copy button.
 *
 * Every line carries its own confidence label, so a result pasted into a chat
 * or a fraud report keeps the distinction between what the numbering plan
 * states and what is merely indicative.
 */
export function buildReport(
  analysis: Analysis,
  prefix: PrefixInfo,
  found: Signal[],
): string {
  const lines: string[] = ["Phone number check — DO101 PhoneCheck", ""];

  const row = (label: string, value: string, confidence?: string) =>
    lines.push(`${label}: ${value}${confidence ? ` [${confidence}]` : ""}`);

  row("Entered", analysis.input);

  if (analysis.failure) {
    row("Result", "Could not be read as a phone number");
    lines.push("", "Nothing was looked up, because there was nothing to look up.");
    return lines.join("\n");
  }

  if (analysis.e164) row("E.164", analysis.e164);
  if (analysis.international) row("International", analysis.international);
  if (analysis.national) row("National", analysis.national);

  const country = countryValue(analysis);
  row("Country", country.value, CONFIDENCE_LABEL[country.confidence]);
  if (analysis.callingCode) row("Calling code", `+${analysis.callingCode}`, CONFIDENCE_LABEL.verified);

  const type = typeLabel(analysis);
  row("Number type", type.value, CONFIDENCE_LABEL[type.confidence]);

  row(
    "Numbering region",
    prefix.region ?? "Unknown / not available",
    CONFIDENCE_LABEL[prefix.region ? "info" : "unknown"],
  );
  if (prefix.regionPrefix) row("Matched prefix", `+${analysis.callingCode} ${prefix.regionPrefix}`);

  row(
    "Carrier at allocation",
    prefix.carrier ?? "Unknown / not available",
    CONFIDENCE_LABEL[prefix.carrier ? "info" : "unknown"],
  );

  const valid = validity(analysis);
  row("Validity", valid.value, CONFIDENCE_LABEL[valid.confidence]);

  lines.push("", "Observations:");
  if (found.length === 0) {
    lines.push("- None. That is not a clean bill of health.");
  } else {
    for (const signal of found) {
      lines.push(`- [${signal.tone === "caution" ? "Caution" : signal.tone === "good" ? "Note" : "Info"}] ${signal.title}: ${signal.detail}`);
    }
  }

  lines.push(
    "",
    "Caller ID can be faked. This check reads the number against published numbering plans;",
    "it cannot tell you who is calling, whether the number is in service, or where the phone is.",
    "Checked locally in the browser — the number was not sent anywhere.",
  );

  return lines.join("\n");
}
