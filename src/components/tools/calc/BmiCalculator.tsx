"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { CopyButton } from "@/components/ui/CopyButton";
import { InfoNote } from "@/components/ui/Feedback";
import { calculateBmi, imperialToMetric, BMI_BANDS } from "@/lib/calculators/bmi";
import { formatNumber, clamp } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

export function BmiCalculator() {
  const [units, setUnits] = React.useState<"metric" | "imperial">("metric");
  const [cm, setCm] = React.useState("175");
  const [kg, setKg] = React.useState("70");
  const [ft, setFt] = React.useState("5");
  const [inch, setInch] = React.useState("9");
  const [lb, setLb] = React.useState("154");

  const result = React.useMemo(() => {
    if (units === "metric") return calculateBmi(Number(kg), Number(cm));
    const { heightCm, weightKg } = imperialToMetric(Number(ft), Number(inch), Number(lb));
    return calculateBmi(weightKg, heightCm);
  }, [units, cm, kg, ft, inch, lb]);

  React.useEffect(() => {
    if (result) track("tool_complete", { tool: "bmi" });
  }, [result]);

  // Scale position: 15 → 40 maps across the bar.
  const markerPct = result ? clamp(((result.bmi - 15) / 25) * 100, 0, 100) : 0;

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="Units"
        value={units}
        onChange={(v) => setUnits(v as "metric" | "imperial")}
        items={[
          { id: "metric", label: "Metric (cm / kg)" },
          { id: "imperial", label: "Imperial (ft, in / lb)" },
        ]}
      />

      <Card className="p-5">
        {units === "metric" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bmi-cm">Height (cm)</Label>
              <Input
                id="bmi-cm"
                type="number"
                inputMode="decimal"
                value={cm}
                onChange={(e) => setCm(e.target.value)}
                className="text-lg"
              />
            </div>
            <div>
              <Label htmlFor="bmi-kg">Weight (kg)</Label>
              <Input
                id="bmi-kg"
                type="number"
                inputMode="decimal"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                className="text-lg"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="bmi-ft">Height (feet)</Label>
              <Input
                id="bmi-ft"
                type="number"
                inputMode="numeric"
                value={ft}
                onChange={(e) => setFt(e.target.value)}
                className="text-lg"
              />
            </div>
            <div>
              <Label htmlFor="bmi-in">Height (inches)</Label>
              <Input
                id="bmi-in"
                type="number"
                inputMode="numeric"
                value={inch}
                onChange={(e) => setInch(e.target.value)}
                className="text-lg"
              />
            </div>
            <div>
              <Label htmlFor="bmi-lb">Weight (pounds)</Label>
              <Input
                id="bmi-lb"
                type="number"
                inputMode="decimal"
                value={lb}
                onChange={(e) => setLb(e.target.value)}
                className="text-lg"
              />
            </div>
          </div>
        )}
      </Card>

      {result ? (
        <>
          <Card className="do-pop p-6 text-center">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              Your BMI
            </p>
            <p className="mt-2 text-6xl font-extrabold tabular-nums">
              {formatNumber(result.bmi, 1)}
            </p>
            <p className="mt-2 text-lg font-extrabold">{result.category}</p>

            <div className="mt-6">
              <div className="relative h-5 overflow-hidden rounded-full">
                <div className="flex h-full">
                  <span className="h-full flex-[3.5] bg-[var(--sky)]" />
                  <span className="h-full flex-[6.5] bg-[var(--grass)]" />
                  <span className="h-full flex-[5] bg-[var(--sun)]" />
                  <span className="h-full flex-[5] bg-[var(--fire)]" />
                  <span className="h-full flex-[5] bg-[var(--cherry)]" />
                </div>
                <span
                  className="absolute top-[-4px] h-[28px] w-1.5 -translate-x-1/2 rounded-full bg-[var(--ink)] ring-2 ring-[var(--bg)]"
                  style={{ left: `${markerPct}%` }}
                  aria-hidden
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-extrabold text-[var(--muted)]">
                <span>15</span>
                <span>18.5</span>
                <span>25</span>
                <span>30</span>
                <span>40+</span>
              </div>
            </div>

            <p className="mt-5 text-sm font-semibold text-[var(--muted)]">
              A BMI in the healthy range for your height means roughly{" "}
              <strong className="text-[var(--ink)]">
                {units === "metric"
                  ? `${formatNumber(result.healthyMinKg, 1)}–${formatNumber(result.healthyMaxKg, 1)} kg`
                  : `${formatNumber(result.healthyMinKg * 2.2046, 0)}–${formatNumber(result.healthyMaxKg * 2.2046, 0)} lb`}
              </strong>
              .
            </p>

            <div className="mt-4 flex justify-center">
              <CopyButton
                value={`BMI ${formatNumber(result.bmi, 1)} — ${result.category}`}
                label="Copy result"
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <h3 className="border-b-2 border-[var(--border)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Adult BMI categories
            </h3>
            <ul>
              {BMI_BANDS.map((band) => (
                <li
                  key={band.label}
                  className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-2.5 last:border-0"
                  style={
                    band.label === result.category
                      ? { background: `var(--${band.accent}-soft)` }
                      : undefined
                  }
                >
                  <span className="text-sm font-extrabold">{band.label}</span>
                  <span className="font-mono text-sm text-[var(--muted)]">
                    {band.min} – {band.max === Infinity ? "∞" : band.max}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-semibold">
          Enter a height and weight above zero to see your BMI.
        </p>
      )}

      <InfoNote icon="🩺">
        <strong>This is general information, not medical advice.</strong> BMI is a rough screening
        number for adults. It cannot tell muscle from fat and is not valid for children, pregnancy
        or athletes. Talk to a healthcare professional about your own health.
      </InfoNote>
    </div>
  );
}
