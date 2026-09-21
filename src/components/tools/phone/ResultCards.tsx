"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { countryFlag } from "@/lib/phone/countries";
import { countryValue, typeLabel, validity } from "@/lib/phone/describe";
import { CONFIDENCE_LABEL, type Analysis, type Confidence, type PrefixInfo, type Signal } from "@/lib/phone/types";

const BADGE: Record<Confidence, string> = {
  verified: "bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]",
  info: "bg-[var(--sky-soft)] text-[var(--sky-dark)] dark:text-[var(--sky)]",
  unknown: "bg-[var(--panel-2)] text-[var(--muted)]",
};

const BADGE_HINT: Record<Confidence, string> = {
  verified: "Stated by the published numbering plan.",
  info: "Real data, but indicative — allocations change and numbers get ported.",
  unknown: "The bundled data has nothing for this number.",
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span
      title={BADGE_HINT[level]}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider",
        BADGE[level],
      )}
    >
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

function ResultCard({
  label,
  value,
  confidence,
  blurb,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  confidence: Confidence;
  blurb: string;
  icon: string;
}) {
  return (
    <div className="do-card flex flex-col gap-1.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
          <span aria-hidden className="mr-1.5">
            {icon}
          </span>
          {label}
        </p>
        <ConfidenceBadge level={confidence} />
      </div>
      <p className="text-lg font-extrabold leading-snug break-words">{value}</p>
      <p className="text-xs font-semibold leading-relaxed text-[var(--muted)]">{blurb}</p>
    </div>
  );
}

export function ResultCards({
  analysis,
  prefix,
  loadingPrefix,
}: {
  analysis: Analysis;
  prefix: PrefixInfo;
  loadingPrefix: boolean;
}) {
  const country = countryValue(analysis);
  const type = typeLabel(analysis);
  const valid = validity(analysis);

  const flag = analysis.country ? countryFlag(analysis.country) : "🌐";

  const regionValue = loadingPrefix
    ? "Checking the prefix tables…"
    : (prefix.region ?? "Unknown / not available");
  const regionConfidence: Confidence = prefix.region ? "info" : "unknown";
  // The prefix tables describe allocated ranges. When the number itself is not
  // valid, a hit still says something true about the range it sits in — but
  // saying so without the caveat would read as a fact about the number.
  const unallocated = analysis.valid
    ? ""
    : " The number is not valid, so this describes the range the prefix sits in, not the number.";

  const regionBlurb = prefix.region
    ? `Matched on +${analysis.callingCode} ${prefix.regionPrefix}. This is where the prefix is issued, not where the phone is — the handset could be anywhere on earth, and there is no way to tell from a number.${unallocated}`
    : prefix.regionDataExists
      ? "No entry for this prefix in the bundled table for this country, so nothing is claimed."
      : "No numbering-region table ships for this calling code.";

  const carrierValue = loadingPrefix
    ? "Checking the prefix tables…"
    : (prefix.carrier ?? "Unknown / not available");
  const carrierConfidence: Confidence = prefix.carrier ? "info" : "unknown";
  const carrierBlurb = prefix.carrier
    ? `The network this range was originally allocated to. Number portability means the number may well have moved to a different network since, and the tables cannot see that.${unallocated}`
    : prefix.carrierDataExists
      ? "No carrier entry for this prefix. Landline ranges usually have none, because the tables cover mobile allocations."
      : "No carrier table ships for this calling code.";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ResultCard
        icon={flag}
        label="Country"
        value={country.value}
        confidence={country.confidence}
        blurb={
          analysis.callingCode
            ? `Calling code +${analysis.callingCode}, read ${analysis.detectedFrom === "prefix" ? "from the number's own prefix" : "from the region you selected"}.`
            : "No calling code could be read from this number."
        }
      />
      <ResultCard
        icon="📞"
        label="Number type"
        value={type.value}
        confidence={type.confidence}
        blurb={type.blurb}
      />
      <ResultCard
        icon="🗺️"
        label="Numbering region"
        value={regionValue}
        confidence={loadingPrefix ? "unknown" : regionConfidence}
        blurb={regionBlurb}
      />
      <ResultCard
        icon="📡"
        label="Carrier at allocation"
        value={carrierValue}
        confidence={loadingPrefix ? "unknown" : carrierConfidence}
        blurb={carrierBlurb}
      />
      <ResultCard
        icon={analysis.valid ? "✅" : "⚠️"}
        label="Validity"
        value={valid.value}
        confidence={valid.confidence}
        blurb={valid.blurb}
      />
      <ResultCard
        icon="🔢"
        label="Digits"
        value={`${analysis.digits} after +${analysis.callingCode ?? "?"}`}
        confidence="verified"
        blurb={
          analysis.possibleCountries.length > 1
            ? `+${analysis.callingCode} is shared by ${analysis.possibleCountries.length} countries and territories, so the digits that follow decide which one.`
            : "The national part of the number, with the calling code removed."
        }
      />
    </div>
  );
}

const SIGNAL_STYLE = {
  caution: {
    wrap: "border-[var(--fire)] bg-[var(--fire-soft)]",
    icon: "⚠️",
    label: "Worth knowing",
  },
  info: { wrap: "border-[var(--sky)] bg-[var(--sky-soft)]", icon: "ℹ️", label: "Information" },
  good: { wrap: "border-[var(--grass)] bg-[var(--grass-soft)]", icon: "✅", label: "Note" },
} as const;

export function SignalList({ found }: { found: Signal[] }) {
  if (found.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
        No rule in the local checks matched this number. That is not a clean bill of health — it
        only means nothing in the digits stood out.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {found.map((signal) => {
        const style = SIGNAL_STYLE[signal.tone];
        return (
          <li key={signal.id} className={cn("rounded-2xl border-2 p-4", style.wrap)}>
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-start gap-2 text-sm font-extrabold">
                <span aria-hidden>{style.icon}</span>
                <span>
                  <span className="sr-only">{style.label}: </span>
                  {signal.title}
                </span>
              </p>
              <ConfidenceBadge level={signal.confidence} />
            </div>
            <p className="mt-1 pl-6 text-sm font-semibold leading-relaxed text-[var(--ink)]">
              {signal.detail}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
