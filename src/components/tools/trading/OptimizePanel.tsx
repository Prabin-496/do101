"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Feedback";
import type { ExecutionConfig } from "@/lib/trading/backtest";
import { formatRatio, formatSignedMoney } from "@/lib/trading/format";
import {
  EXECUTION_KNOBS,
  KNOB_LABELS,
  OBJECTIVE_LABELS,
  runOptimization,
  type Knob,
  type KnobSpec,
  type Objective,
  type OptimizationResult,
} from "@/lib/trading/optimize";
import { ENGINE_META, type EngineSettings } from "@/lib/trading/engines";
import type { Series } from "@/lib/trading/types";
import { Chip, ChipRow, MetricTile, NumberField, Panel, PastPerformanceNote, WarningList } from "./shared";

/** Sensible sweeps, so nobody has to invent a range to try. */
const RANGES: Record<Knob, number[]> = {
  fastMa: [8, 13, 21, 34],
  slowMa: [34, 50, 89, 144],
  rsiPeriod: [7, 14, 21],
  rsiOversold: [25, 30, 35, 40],
  rsiOverbought: [60, 65, 70, 75],
  bbPeriod: [14, 20, 30],
  donchianPeriod: [10, 20, 30, 50],
  atrPeriod: [7, 14, 21],
  adxMinimum: [0, 15, 20, 25],
  minScore: [50, 55, 60, 70],
  trendMa: [50, 100, 200],
  fastEma: [5, 9, 13, 21],
  slowEma: [21, 34, 50],
  cooldownBars: [0, 5, 10, 20],
  boxLookback: [10, 20, 30],
  liquidityPivot: [2, 3, 5],
  volumeMultiple: [1, 1.2, 1.5, 2],
  strongBodyShare: [0.3, 0.5, 0.7],
  minStopAtr: [0, 0.2, 0.5],
  rr: [1.5, 2, 3],
  atrMultiple: [1, 1.5, 2, 3],
  riskReward: [1, 1.5, 2, 3],
  riskPercent: [0.5, 1, 2],
  stopPips: [15, 30, 50],
  targetPips: [30, 60, 100],
};

/** Only the knobs the running strategy actually has are worth offering. */
const WEIGHTED_KNOBS: Knob[] = [
  "fastMa", "slowMa", "rsiPeriod", "rsiOversold", "rsiOverbought", "bbPeriod",
  "donchianPeriod", "atrPeriod", "adxMinimum", "minScore",
];
const SMART_MONEY_KNOBS: Knob[] = [
  "trendMa", "fastEma", "slowEma", "rsiPeriod", "cooldownBars", "boxLookback",
  "liquidityPivot", "volumeMultiple", "strongBodyShare", "minStopAtr", "rr",
];

const DEFAULT_KNOBS: Record<string, Knob[]> = {
  weighted: ["fastMa", "atrMultiple", "riskReward"],
  "smart-money": ["fastEma", "cooldownBars", "rr"],
};

/**
 * Parameter search, with the machinery for catching it lying built in.
 *
 * The honest framing matters more than the search itself: a grid over four
 * parameters on one gold chart will always produce a winner, and the only
 * question worth asking is whether that winner means anything. So the panel
 * reports the held-back result next to the tuned one, the rank agreement
 * between the two halves across every combination, and whether the winner sits
 * on a plateau or a spike.
 */
export function OptimizePanel({
  series,
  settings,
  execution,
  onApply,
}: {
  series: Series;
  settings: EngineSettings;
  execution: ExecutionConfig;
  onApply: (values: Partial<Record<Knob, number>>) => void;
}) {
  const available = [
    ...(settings.engine === "smart-money" ? SMART_MONEY_KNOBS : WEIGHTED_KNOBS),
    ...EXECUTION_KNOBS,
  ];
  const [knobs, setKnobs] = React.useState<Knob[]>(DEFAULT_KNOBS[settings.engine] ?? []);
  const [objective, setObjective] = React.useState<Objective>("expectancyR");
  const [minTrades, setMinTrades] = React.useState(20);
  const [share, setShare] = React.useState(0.7);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<OptimizationResult | null>(null);
  const cancelled = React.useRef(false);

  const specs: KnobSpec[] = knobs.map((knob) => ({ knob, values: RANGES[knob] }));
  const combinations = specs.reduce((total, spec) => total * spec.values.length, 1);
  // Measured, not guessed: roughly one pass of the engine per combination.
  const estimateSeconds = Math.round((combinations * series.candles.length) / 90_000);

  const run = async () => {
    cancelled.current = false;
    setProgress(0);
    setResult(null);
    const output = await runOptimization(
      series,
      settings,
      execution,
      specs,
      { inSampleShare: share, objective, minTrades, maxCombinations: 240 },
      (done, total) => {
        if (!cancelled.current) setProgress(Math.round((done / total) * 100));
      },
    );
    if (cancelled.current) return;
    setResult(output);
    setProgress(null);
  };

  const ranked = result ? [...result.combinations].sort((a, b) => b.inScore - a.inScore).slice(0, 12) : [];

  return (
    <div className="space-y-4">
      <Panel
        title="Parameter search"
        icon="🔬"
        subtitle="Runs entirely in this browser. Nothing is uploaded and nothing is stored."
      >
        <div className="space-y-4">
          <div>
            <Label hint={`${combinations} combinations · about ${estimateSeconds || 1}s`}>
              What to vary in {ENGINE_META[settings.engine].label}
            </Label>
            <ChipRow ariaLabel="Parameters to search">
              {available.map((knob) => (
                <Chip
                  key={knob}
                  active={knobs.includes(knob)}
                  onClick={() =>
                    setKnobs((current) =>
                      current.includes(knob) ? current.filter((k) => k !== knob) : [...current, knob],
                    )
                  }
                  title={RANGES[knob].join(", ")}
                >
                  {KNOB_LABELS[knob]}
                </Chip>
              ))}
            </ChipRow>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="objective">Rank by</Label>
              <Select id="objective" value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
                {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map((id) => (
                  <option key={id} value={id}>
                    {OBJECTIVE_LABELS[id]}
                  </option>
                ))}
              </Select>
            </div>
            <NumberField label="Minimum trades" value={minTrades} min={1} max={500} hint="to be eligible" onChange={setMinTrades} />
            <NumberField
              label="Tuning share"
              value={Math.round(share * 100)}
              min={30}
              max={90}
              step={5}
              hint="the rest is held back"
              onChange={(v) => setShare(v / 100)}
              suffix="%"
            />
          </div>

          {progress === null ? (
            <Button onClick={() => void run()} disabled={knobs.length === 0}>
              Search {combinations} combinations
            </Button>
          ) : (
            <div className="space-y-2">
              <Progress value={progress} label="Searching" />
              <Button
                tone="panel"
                size="sm"
                onClick={() => {
                  cancelled.current = true;
                  setProgress(null);
                }}
              >
                Stop
              </Button>
            </div>
          )}

          <p className="rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-xs font-semibold">
            <strong>Searching hard enough always finds something.</strong> With a few thousand bars and a few
            hundred combinations, a winner appears whether or not there is anything to win — that is what a
            search does. The three numbers below the table are there to tell you which kind of winner you have.
          </p>
        </div>
      </Panel>

      {result ? (
        <Panel title="What the search found" icon="🧾">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricTile
                label="Best, tuned"
                value={formatRatio(result.best?.inScore)}
                hint={OBJECTIVE_LABELS[objective]}
              />
              <MetricTile
                label="Same settings, held back"
                value={formatRatio(result.best?.outScore)}
                tone={(result.best?.outScore ?? 0) > 0 ? "grass" : "cherry"}
              />
              <MetricTile
                label="Rank agreement"
                value={formatRatio(result.rankCorrelation)}
                hint="−1 to 1, between the halves"
                tone={(result.rankCorrelation ?? 0) > 0.4 ? "grass" : "cherry"}
              />
              <MetricTile
                label="Plateau"
                value={result.plateau === null ? "—" : `${formatRatio(result.plateau)}×`}
                hint="neighbours, against the winner"
                tone={(result.plateau ?? 0) > 0.6 ? "grass" : "cherry"}
              />
            </div>

            <WarningList items={result.warnings} tone="cherry" />

            <div className="do-scroll overflow-x-auto rounded-2xl border-2 border-[var(--border)]">
              <table className="w-full min-w-[640px] text-xs font-semibold tabular-nums">
                <thead className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    {knobs.map((knob) => (
                      <th key={knob} className="px-3 py-2">
                        {KNOB_LABELS[knob]}
                      </th>
                    ))}
                    <th className="px-3 py-2">Tuned</th>
                    <th className="px-3 py-2">Held back</th>
                    <th className="px-3 py-2">Trades</th>
                    <th className="px-3 py-2">Net, held back</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((combination, index) => {
                    const eligible = combination.inSample.metrics.trades >= minTrades;
                    const winner = combination === result.best;
                    return (
                    <tr
                      key={index}
                      title={eligible ? undefined : `Fewer than ${minTrades} trades in the tuning period, so this row was not eligible to win.`}
                      className={`border-t border-[var(--border)] ${winner ? "bg-[var(--grass-soft)]" : ""} ${eligible ? "" : "opacity-50"}`}
                    >
                      {knobs.map((knob) => (
                        <td key={knob} className="px-3 py-1.5">
                          {combination.values[knob]}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 font-extrabold">{formatRatio(combination.inScore)}</td>
                      <td
                        className={`px-3 py-1.5 font-extrabold ${combination.outScore > 0 ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"}`}
                      >
                        {formatRatio(combination.outScore)}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--muted)]">
                        {combination.inSample.metrics.trades} / {combination.outOfSample.metrics.trades}
                      </td>
                      <td className="px-3 py-1.5">{formatSignedMoney(combination.outOfSample.metrics.netProfit)}</td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => onApply(combination.values)}
                          className="font-extrabold underline"
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs font-semibold text-[var(--muted)]">
              The highlighted row is the winner. Rows shown faintly reached fewer than {minTrades} trades in the
              tuning period, so however good their score looks, it rests on too few trades to be eligible — which
              is why the winner is not always the top row.
            </p>
            <p className="text-xs font-semibold text-[var(--muted)]">
              A row worth a second look is one where both columns are positive, the trade counts are healthy on
              both sides, and the rows around it — the neighbouring values, not just this one — are positive too.
              A single brilliant row surrounded by bad ones is noise that happened to line up.
            </p>
            <PastPerformanceNote />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
