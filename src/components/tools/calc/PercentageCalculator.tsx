"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState } from "@/components/ui/Feedback";
import { percentOf, isWhatPercent, percentChange } from "@/lib/calculators/percentage";
import { formatNumber } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

const MODES = [
  { id: "of", label: "What is X% of Y?" },
  { id: "isWhatPercent", label: "X is what % of Y?" },
  { id: "change", label: "% increase / decrease" },
];

export function PercentageCalculator() {
  const [mode, setMode] = React.useState("of");
  const [a, setA] = React.useState("15");
  const [b, setB] = React.useState("480");

  const numA = Number(a);
  const numB = Number(b);
  const valid = a !== "" && b !== "" && Number.isFinite(numA) && Number.isFinite(numB);

  const result = React.useMemo(() => {
    if (!valid) return null;
    if (mode === "of") return percentOf(numA, numB);
    if (mode === "isWhatPercent") return isWhatPercent(numA, numB);
    return percentChange(numA, numB);
  }, [mode, numA, numB, valid]);

  React.useEffect(() => {
    if (result) track("tool_complete", { tool: "percentage", mode });
  }, [result, mode]);

  const labels =
    mode === "of"
      ? ["Percentage (%)", "Of this number"]
      : mode === "isWhatPercent"
        ? ["This number", "Out of this number"]
        : ["From (original)", "To (new value)"];

  return (
    <div className="space-y-4">
      <Tabs ariaLabel="Percentage question" value={mode} onChange={setMode} items={MODES} />

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pc-a">{labels[0]}</Label>
            <Input
              id="pc-a"
              type="number"
              inputMode="decimal"
              value={a}
              onChange={(e) => setA(e.target.value)}
              className="text-lg"
            />
          </div>
          <div>
            <Label htmlFor="pc-b">{labels[1]}</Label>
            <Input
              id="pc-b"
              type="number"
              inputMode="decimal"
              value={b}
              onChange={(e) => setB(e.target.value)}
              className="text-lg"
            />
          </div>
        </div>
      </Card>

      {valid && result === null ? (
        <ErrorState message="That calculation needs a non-zero second number — dividing by zero has no answer." />
      ) : null}

      {result ? (
        <Card className="do-pop bg-[var(--fire-soft)] p-6 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Answer
          </p>
          <p className="mt-2 text-5xl font-extrabold tabular-nums">
            {formatNumber(result.value, 4)}
            {mode === "of" ? "" : "%"}
          </p>
          <p className="mt-3 text-base font-bold">{result.explanation}</p>
          <p className="mt-1 font-mono text-sm font-semibold text-[var(--muted)]">
            {result.formula}
          </p>
          <div className="mt-4 flex justify-center">
            <CopyButton
              value={`${formatNumber(result.value, 4)}${mode === "of" ? "" : "%"}`}
              label="Copy answer"
              tone="fire"
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
