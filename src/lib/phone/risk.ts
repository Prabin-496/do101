import { GLOBAL_SERVICES, countryName } from "./countries";
import { NUMBER_TYPE_META } from "./describe";
import type { Analysis, Signal } from "./types";

/**
 * Rule-based observations about a number, all derived from the bundled
 * numbering plan or from the digits themselves.
 *
 * There is no spam database here, and there is not going to be one: a free
 * browser tool cannot host crowd-sourced reports honestly, and the ones that
 * claim to are mostly guessing. Everything below is something the numbering
 * plan actually says, phrased as an observation rather than a verdict. A
 * valid, ordinary-looking number is the most common kind of scam call there
 * is, so a clean result never means safe.
 */

/**
 * Ranges the regulators reserve so that films, adverts and documentation can
 * print a number without anyone's phone ringing.
 *
 * Limited on purpose to ranges published by NANPA (555-0100 to 555-0199) and
 * by Ofcom in the UK National Telephone Numbering Plan. Other countries
 * reserve ranges too; they are left out rather than guessed at.
 */
interface DramaRange {
  callingCode: string;
  label: string;
  matches(nationalNumber: string): boolean;
}

const DRAMA_RANGES: DramaRange[] = [
  {
    callingCode: "1",
    label: "555-0100 to 555-0199, reserved by NANPA for fictional use",
    matches: (n) =>
      n.length === 10 && n.slice(3, 6) === "555" && n.slice(6) >= "0100" && n.slice(6) <= "0199",
  },
  {
    callingCode: "44",
    label: "07700 900000 to 900999, Ofcom's reserved mobile drama range",
    matches: (n) => n.length === 10 && n.startsWith("7700900"),
  },
  {
    callingCode: "44",
    label: "020 7946 0000 to 0999, Ofcom's reserved London drama range",
    matches: (n) => n.length === 10 && n.startsWith("2079460"),
  },
  {
    callingCode: "44",
    label: "01632 960000 to 960999, Ofcom's reserved drama range",
    matches: (n) => n.length === 10 && n.startsWith("1632960"),
  },
];

export function dramaRange(analysis: Analysis): DramaRange | undefined {
  const { callingCode, nationalNumber } = analysis;
  if (!callingCode || !nationalNumber) return undefined;
  return DRAMA_RANGES.find((r) => r.callingCode === callingCode && r.matches(nationalNumber));
}

/** True when the digits are one value repeated, e.g. 0000000000. */
export function isRepeated(digits: string): boolean {
  return digits.length >= 6 && /^(\d)\1+$/.test(digits);
}

/** True when the digits step by one the whole way, e.g. 123456789 or 987654321. */
export function isSequential(digits: string): boolean {
  if (digits.length < 6) return false;
  const step = Number(digits[1]) - Number(digits[0]);
  if (step !== 1 && step !== -1) return false;
  for (let i = 2; i < digits.length; i++) {
    if (Number(digits[i]) - Number(digits[i - 1]) !== step) return false;
  }
  return true;
}

const NOTEWORTHY_TYPES = new Set([
  "VOIP",
  "PERSONAL_NUMBER",
  "SHARED_COST",
  "TOLL_FREE",
  "UAN",
  "VOICEMAIL",
  "PAGER",
]);

export function signals(analysis: Analysis): Signal[] {
  if (analysis.failure) return [];

  const out: Signal[] = [];
  const cautions = () => out.filter((s) => s.tone === "caution").length;

  const drama = dramaRange(analysis);
  if (drama) {
    out.push({
      id: "drama",
      tone: "info",
      title: "Reserved for drama and examples",
      detail: `This number falls in ${drama.label}. Numbers in it are never given to a subscriber, so nobody's phone rings${analysis.valid ? "" : " — which is why it also reads as invalid"}. Seeing one usually means it came from a script, a screenshot or a form's placeholder text.`,
      confidence: "verified",
    });
  }

  if (analysis.lengthProblem === "TOO_SHORT" || analysis.lengthProblem === "TOO_LONG") {
    out.push({
      id: "length",
      tone: "caution",
      title: analysis.lengthProblem === "TOO_SHORT" ? "Too few digits" : "Too many digits",
      detail:
        "The digit count does not fit any range in this numbering plan. Most often that is a typo or a missing country code rather than anything sinister — check it against wherever you got it.",
      confidence: "verified",
    });
  } else if (!analysis.valid && analysis.possible && !drama) {
    out.push({
      id: "unallocated",
      tone: "caution",
      title: "Prefix is not allocated",
      detail:
        "The length is right, but no operator in this country has been given this range. A number like this cannot be dialled — yet it can still show up on your screen, because caller ID is supplied by the caller and is not checked.",
      confidence: "verified",
    });
  }

  if (analysis.type === "PREMIUM_RATE") {
    out.push({
      id: "premium",
      tone: "caution",
      title: "Premium rate — calls cost extra",
      detail:
        "Whoever runs this number earns a share of what your call costs. If you got a single missed call from it, returning the call is the point of the exercise. Look up the organisation and ring a number you found yourself.",
      confidence: "verified",
    });
  }

  const service = analysis.callingCode ? GLOBAL_SERVICES[analysis.callingCode] : undefined;
  if (service) {
    out.push({
      id: "global-service",
      tone: service.costly ? "caution" : "info",
      title: `+${analysis.callingCode} is a global service code, not a country`,
      detail: service.costly
        ? `${service.detail} Calls are billed far above a normal international call, so a missed call from this range is worth leaving alone.`
        : service.detail,
      confidence: "verified",
    });
  }

  // A global service code already explains what the range is for, so repeating
  // "Freephone" underneath "+800 is a global service code" adds nothing.
  if (!service && analysis.type && NOTEWORTHY_TYPES.has(analysis.type)) {
    out.push({
      id: `type-${analysis.type.toLowerCase()}`,
      tone: "info",
      title: NUMBER_TYPE_META[analysis.type].label,
      detail: NUMBER_TYPE_META[analysis.type].blurb,
      confidence: "verified",
    });
  }

  if (!analysis.country && analysis.possibleCountries.length > 1) {
    out.push({
      id: "shared-code",
      tone: "info",
      title: `+${analysis.callingCode} is shared by ${analysis.possibleCountries.length} countries`,
      detail:
        "The calling code alone does not identify a country here — the digits after it decide. Because this number is not valid, there is nothing to narrow it down with.",
      confidence: "verified",
    });
  }

  if (analysis.selectedRegion && analysis.country && analysis.selectedRegion !== analysis.country) {
    out.push({
      id: "region-mismatch",
      tone: "info",
      title: "Not from the country you picked",
      detail: `You selected ${countryName(analysis.selectedRegion)}, but the + prefix puts this number in ${countryName(analysis.country)}. The prefix wins — it is part of the number.`,
      confidence: "verified",
    });
  }

  const national = analysis.nationalNumber ?? "";
  if (isRepeated(national) || isSequential(national)) {
    out.push({
      id: "pattern",
      tone: "info",
      title: "The digits form a simple pattern",
      detail:
        "A straight run or a single repeated digit is what placeholder and test entries look like. Real numbers occasionally look like this too, so it is worth noticing rather than acting on.",
      confidence: "verified",
    });
  }

  if (analysis.valid && !drama && cautions() === 0) {
    out.push({
      id: "clean",
      tone: "good",
      title: "Nothing unusual in the number itself",
      detail:
        "It is a well-formed, allocated number of an ordinary kind. That is genuinely all it means: most scam calls come from numbers exactly like this one, and many are not the caller's real number at all.",
      confidence: "verified",
    });
  }

  return out;
}

/**
 * Advice that holds regardless of what the lookup found. Shown every time,
 * because the honest headline of this tool is that a number cannot tell you
 * who is calling.
 */
export const SAFETY_GUIDANCE: Array<{ title: string; detail: string }> = [
  {
    title: "Caller ID can be faked, and faking it is easy",
    detail:
      "The number you see is supplied by the caller's own system and is not verified along the way. Scammers routinely display a bank's real switchboard number, a government line, or a number one digit from your own. A number matching the organisation proves nothing.",
  },
  {
    title: "Hang up and ring back on a number you found yourself",
    detail:
      "Take the number from the back of your card, the official website or your last statement — never one read out to you, sent in the message, or shown on the screen. On a landline, wait half a minute or use a different phone, in case the line is still held open.",
  },
  {
    title: "Pressure and secrecy are the tell, not the number",
    detail:
      "Urgency, a threat of arrest or account closure, a request to move money to a \"safe account\", to install remote-access software, or to read out a one-time code — those are the signals worth acting on. No real bank, tax office or police force asks for any of them.",
  },
  {
    title: "Do not ring back a single missed call from abroad",
    detail:
      "One ring from an unfamiliar international or satellite range is a known trick: the number is premium rate and the charge starts the moment you call. If it matters, they will call again or leave a message.",
  },
  {
    title: "Report it where it counts",
    detail:
      "Your phone's block-and-report button feeds the network's own filtering, which is far more effective than any website. Then tell the organisation being impersonated, and your national reporting line for fraud.",
  },
];
