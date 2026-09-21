"use client";

import * as React from "react";
import type { CountryCode } from "libphonenumber-js/max";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Input, Label, Select } from "@/components/ui/Field";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { analyze, callingCodeOf, normalizeInput } from "@/lib/phone/analyze";
import { GLOBAL_SERVICES, countryFlag, countryName, regionOptions } from "@/lib/phone/countries";
import { lookupPrefix } from "@/lib/phone/prefix";
import { buildReport } from "@/lib/phone/report";
import { SAFETY_GUIDANCE, signals } from "@/lib/phone/risk";
import { EMPTY_PREFIX_INFO, type Analysis, type PrefixInfo, type Signal } from "@/lib/phone/types";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { ResultCards, SignalList } from "./ResultCards";

const FAILURE_MESSAGE: Record<string, string> = {
  empty: "Type a phone number first.",
  "not-a-number": "That does not have enough digits to be a phone number anywhere.",
  "no-region":
    "There is no + and no country selected, so there is no numbering plan to measure this against. Add the country code — or pick a country from the list.",
  "unknown-calling-code":
    "No country or global service uses that calling code. Check the digits right after the +.",
};

const EXAMPLES: Array<{ label: string; value: string }> = [
  { label: "Japan mobile", value: "+81 90 1234 5678" },
  { label: "US landline", value: "+1 202 555 0143" },
  { label: "India mobile", value: "+91 98765 43210" },
  { label: "UK premium", value: "+44 909 8790123" },
  { label: "Satellite", value: "+870 773 111 632" },
];

interface Result {
  analysis: Analysis;
  found: Signal[];
}

export function PhoneCheck() {
  const [raw, setRaw] = React.useState("");
  const [region, setRegion] = React.useState<CountryCode | "">("");
  const [result, setResult] = React.useState<Result | null>(null);
  const [prefix, setPrefix] = React.useState<PrefixInfo>(EMPTY_PREFIX_INFO);
  const [loadingPrefix, setLoadingPrefix] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const completed = React.useRef(false);
  const requestId = React.useRef(0);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  // Building the list touches every numbering plan, so it is built once.
  const regions = React.useMemo(() => regionOptions(), []);

  /**
   * The country chip under the input, updated as the visitor types. It reads
   * the calling code straight out of the digits so the detection is visible
   * before anything is submitted.
   */
  const detected = React.useMemo(() => {
    const { hadPlus, digits } = normalizeInput(raw, region || undefined);
    if (!hadPlus || digits.length < 1) return null;
    const code = callingCodeOf(digits);
    if (!code) return null;
    const quick = analyze(raw, region || undefined);
    return { code, country: quick.country, service: GLOBAL_SERVICES[code]?.name };
  }, [raw, region]);

  async function check(event?: React.FormEvent) {
    event?.preventDefault();

    const analysis = analyze(raw, region || undefined);
    if (analysis.failure) {
      setFailure(FAILURE_MESSAGE[analysis.failure] ?? FAILURE_MESSAGE["not-a-number"]);
      setResult(null);
      setPrefix(EMPTY_PREFIX_INFO);
      return;
    }

    const id = ++requestId.current;
    setFailure(null);
    setResult({ analysis, found: signals(analysis) });
    setPrefix(EMPTY_PREFIX_INFO);
    setLoadingPrefix(true);

    // On a phone the form fills the screen, so the answer needs bringing up.
    window.requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

    if (!completed.current) {
      completed.current = true;
      track("tool_complete", { tool: "phone-check" });
      recordCompletion();
    }

    try {
      const info = await lookupPrefix(analysis.callingCode, analysis.nationalNumber);
      if (id !== requestId.current) return;
      setPrefix(info);
    } catch {
      // A missing or unreachable table is a known state, not an error worth
      // shouting about: the cards already say "Unknown / not available".
      if (id === requestId.current) setPrefix(EMPTY_PREFIX_INFO);
    } finally {
      if (id === requestId.current) setLoadingPrefix(false);
    }
  }

  function applyExample(value: string) {
    setRaw(value);
    setRegion("");
    setFailure(null);
    setResult(null);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <form onSubmit={check} className="do-card space-y-4 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
          <div>
            <Label htmlFor="phone-region">Country</Label>
            <Select
              id="phone-region"
              value={region}
              onChange={(e) => setRegion(e.target.value as CountryCode | "")}
            >
              <option value="">Detect from the number</option>
              {regions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flag} {option.name} +{option.callingCode}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="phone-number" hint="Spaces, dashes and brackets are fine">
              Phone number
            </Label>
            <Input
              id="phone-number"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              spellCheck={false}
              placeholder="+81 90 1234 5678"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              aria-describedby="phone-detected"
            />
          </div>
        </div>

        <p id="phone-detected" aria-live="polite" className="min-h-5 text-xs font-semibold text-[var(--muted)]">
          {detected ? (
            <>
              <span aria-hidden className="mr-1">
                {detected.country ? countryFlag(detected.country) : "🌐"}
              </span>
              Detected +{detected.code}
              {detected.country
                ? ` — ${countryName(detected.country)}`
                : detected.service
                  ? ` — ${detected.service}, not a country`
                  : " — country not yet decided"}
            </>
          ) : region ? (
            `Reading the number as a local number for ${countryName(region)}.`
          ) : (
            "Start the number with + and the country is detected for you."
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" tone="grass" className="w-full sm:w-auto">
            Check number
          </Button>
          {result || failure ? (
            <Button
              type="button"
              tone="ghost"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                setRaw("");
                setRegion("");
                setResult(null);
                setFailure(null);
                setPrefix(EMPTY_PREFIX_INFO);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-[var(--border)] pt-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Try
          </span>
          {EXAMPLES.map((example) => (
            <button
              key={example.value}
              type="button"
              onClick={() => applyExample(example.value)}
              className="rounded-full bg-[var(--panel-2)] px-3 py-1.5 text-xs font-extrabold hover:bg-[var(--border)]"
            >
              {example.label}
            </button>
          ))}
        </div>
      </form>

      {failure ? <ErrorState title="Cannot check that" message={failure} /> : null}

      <InfoNote>
        <strong>This number is not sent anywhere.</strong> The numbering plans ship with the page
        and the check runs on your device. Looking up a region or carrier fetches one prefix table
        for the country calling code — the same file every visitor checking that country asks for,
        which reveals nothing about your number. Nothing is stored, and there is no account.
      </InfoNote>


      <div ref={resultsRef} aria-live="polite">
        {result ? (
          <div className="do-rise space-y-6">
            <section aria-labelledby="result-heading" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="result-heading" className="text-xl sm:text-2xl">
                  {result.analysis.international ?? result.analysis.input}
                </h2>
                <CopyButton
                  value={() => buildReport(result.analysis, prefix, result.found)}
                  label="Copy results"
                  copiedLabel="Copied!"
                  tone="panel"
                  size="md"
                />
              </div>
              {result.analysis.e164 ? (
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {result.analysis.national && !result.analysis.nonGeographic
                    ? `Dialled locally as ${result.analysis.national} · `
                    : ""}
                  E.164 {result.analysis.e164}
                </p>
              ) : null}
              <ResultCards
                analysis={result.analysis}
                prefix={prefix}
                loadingPrefix={loadingPrefix}
              />
            </section>

            <section aria-labelledby="signals-heading" className="space-y-3">
              <h2 id="signals-heading" className="text-xl sm:text-2xl">
                What the checks noticed
              </h2>
              <p className="text-sm font-semibold text-[var(--muted)]">
                Rules run against the numbering plan and the digits themselves. None of them can
                tell you whether a call is a scam — they tell you what the number is.
              </p>
              <SignalList found={result.found} />
            </section>

            <section aria-labelledby="guidance-heading" className="space-y-3">
              <h2 id="guidance-heading" className="text-xl sm:text-2xl">
                Staying safe on the call
              </h2>
              <ul className="space-y-2">
                {SAFETY_GUIDANCE.map((item) => (
                  <li key={item.title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">{item.title}</p>
                    <p className="mt-0.5 text-sm font-semibold leading-relaxed text-[var(--muted)]">
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>

    </div>
  );
}
