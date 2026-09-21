"use client";

import * as React from "react";
import { formatPips, formatPrice, formatMoney, formatPercent, formatRatio, formatBarTime } from "@/lib/trading/format";
import type { TradePlan } from "@/lib/trading/plan";
import type { Signal } from "@/lib/trading/strategy";
import { instrumentOf, type Series } from "@/lib/trading/types";
import { MetricTile, Panel, VerdictBadge, WarningList } from "./shared";

/**
 * What the rules concluded, and — the part that matters — exactly why.
 *
 * Every rule is listed whether it agreed or not. A panel that only shows the
 * reasons supporting its own conclusion is a sales pitch; the ones that
 * disagreed are the most useful thing on the screen.
 */
export function SignalPanel({
  signal,
  series,
  plan,
  onPaperTrade,
}: {
  signal: Signal | null;
  series: Series;
  plan: TradePlan | null;
  onPaperTrade?: (plan: TradePlan) => void;
}) {
  const instrument = instrumentOf(series);
  if (!signal) {
    return (
      <Panel title="Signal" icon="🎯">
        <p className="text-sm font-semibold text-[var(--muted)]">Load a chart to read the rules.</p>
      </Panel>
    );
  }

  const gated = signal.rules.some((r) => r.kind !== undefined);
  const agreeing = signal.rules.filter((r) => (signal.verdict === "sell" ? r.vote === -1 : r.vote === 1));
  const against = signal.rules.filter((r) => (signal.verdict === "sell" ? r.vote === 1 : r.vote === -1));
  const quiet = signal.rules.filter((r) => r.vote === 0);

  return (
    <Panel
      title="Signal"
      icon="🎯"
      subtitle={`Read from the close of the ${formatBarTime(signal.time, series.timeframe)} UTC bar on ${series.symbol}.`}
      right={<VerdictBadge verdict={signal.verdict} score={signal.score} size="lg" />}
    >
      <div className="space-y-4">
        <p className="rounded-2xl border-2 border-[var(--sky)] bg-[var(--sky-soft)] px-4 py-3 text-xs font-semibold">
          This is the output of the rules below, applied to past price. It is not a forecast, and it can be
          wrong. <strong>What the score means here:</strong> {signal.scoreMeaning}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricTile
            label={gated ? "Conditions met" : "Agreement"}
            value={`${signal.score}/100`}
            hint={
              gated
                ? `${Math.max(signal.bullishWeight, signal.bearishWeight)} of ${signal.totalWeight}, ${signal.readingSide} side`
                : `weight ${signal.bullishWeight} for, ${signal.bearishWeight} against, out of ${signal.totalWeight}`
            }
          />
          <MetricTile label="Structure" value={signal.trend.trend === "up" ? "Uptrend" : signal.trend.trend === "down" ? "Downtrend" : "Range"} tone={signal.trend.trend === "range" ? "muted" : "ink"} />
          <MetricTile label="ATR" value={signal.atr === null ? "—" : formatPrice(signal.atr, instrument)} hint="Average bar range" />
          <MetricTile label="Last close" value={formatPrice(signal.close, instrument)} />
        </div>

        {gated ? (
          <GateView signal={signal} />
        ) : (
          <>
            <RuleList title="Reasons for this read" tone="for" rules={agreeing} />
            <RuleList title="Pointing the other way" tone="against" rules={against} />
            <RuleList title="No opinion on this bar" tone="quiet" rules={quiet} />
          </>
        )}

        <WarningList items={signal.cautions} />

        <div>
          <h4 className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            What would invalidate it
          </h4>
          <ul className="space-y-1">
            {signal.invalidations.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs font-semibold">
                <span aria-hidden className="text-[var(--cherry)]">
                  ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {plan ? <PlanBlock plan={plan} series={series} onPaperTrade={onPaperTrade} /> : null}
      </div>
    </Panel>
  );
}

/**
 * A gate-and-trigger strategy, shown as the chain it is.
 *
 * Every filter is pass or fail, every trigger fired or did not, and the side
 * being read is named — so "RSI on the right side of 50" failing reads as the
 * one thing standing between this bar and a trade, not as a vote against it.
 */
function GateView({ signal }: { signal: Signal }) {
  const filters = signal.rules.filter((r) => r.kind === "filter");
  const triggers = signal.rules.filter((r) => r.kind === "trigger");
  const blocked = filters.filter((r) => !r.passed);
  const fired = triggers.filter((r) => r.passed);
  const side = signal.readingSide === "sell" ? "sell" : "buy";

  let headline: string;
  if (signal.verdict !== "neutral") {
    headline = `Every filter passed and ${fired.map((t) => t.label.toLowerCase()).join(" and ")} fired, so this is a ${side}.`;
  } else if (blocked.length > 0 && fired.length > 0) {
    headline = `On the ${side} side, ${fired.length === 1 ? "a trigger fired" : `${fired.length} triggers fired`}, but ${blocked.length === 1 ? "one filter blocks it" : `${blocked.length} filters block it`}.`;
  } else if (blocked.length > 0) {
    headline = `The ${side} side is closest to firing, and ${blocked.length === 1 ? "one filter is" : `${blocked.length} filters are`} still in the way.`;
  } else {
    headline = `Every ${side}-side filter passes; it is waiting for one of the triggers.`;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-extrabold">{headline}</p>
      <ConditionList title="Filters — all must pass" items={filters} passMark="✓" failMark="✕" />
      <ConditionList title="Triggers — one must fire" items={triggers} passMark="✓" failMark="·" />
    </div>
  );
}

function ConditionList({
  title,
  items,
  passMark,
  failMark,
}: {
  title: string;
  items: { id: string; label: string; detail: string; passed?: boolean }[];
  passMark: string;
  failMark: string;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">{title}</h4>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs font-semibold">
            <span
              aria-label={item.passed ? "passed" : "not passed"}
              className={`mt-px font-extrabold ${item.passed ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : failMark === "✕" ? "text-[var(--cherry-dark)] dark:text-[var(--cherry)]" : "text-[var(--muted)]"}`}
            >
              {item.passed ? passMark : failMark}
            </span>
            <span className="min-w-0">
              <strong>{item.label}</strong>
              <span className="block text-[var(--muted)]">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RuleList({
  title,
  rules,
  tone,
}: {
  title: string;
  rules: { id: string; label: string; detail: string; weight: number }[];
  tone: "for" | "against" | "quiet";
}) {
  if (rules.length === 0) return null;
  const mark = tone === "for" ? "✓" : tone === "against" ? "✕" : "·";
  const colour =
    tone === "for"
      ? "text-[var(--grass-dark)] dark:text-[var(--grass)]"
      : tone === "against"
        ? "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"
        : "text-[var(--muted)]";

  return (
    <div>
      <h4 className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">{title}</h4>
      <ul className="space-y-1">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-start gap-2 text-xs font-semibold">
            <span aria-hidden className={`mt-px font-extrabold ${colour}`}>
              {mark}
            </span>
            <span className="min-w-0">
              <strong>{rule.label}</strong>
              <span className="ml-1 rounded bg-[var(--panel-2)] px-1 text-[10px] tabular-nums text-[var(--muted)]">
                weight {rule.weight}
              </span>
              <span className="block text-[var(--muted)]">{rule.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanBlock({
  plan,
  series,
  onPaperTrade,
}: {
  plan: TradePlan;
  series: Series;
  onPaperTrade?: (plan: TradePlan) => void;
}) {
  const instrument = instrumentOf(series);
  return (
    <div className="rounded-2xl border-2 border-[var(--border)] p-4">
      <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
        Worked example, using your risk settings
      </h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile
          label="Analytical entry zone"
          value={`${formatPrice(plan.entryLow, instrument)} – ${formatPrice(plan.entryHigh, instrument)}`}
        />
        <MetricTile label="Example stop" value={formatPrice(plan.stop, instrument)} hint={formatPips(plan.stopPips)} tone="cherry" />
        <MetricTile label="Example target" value={formatPrice(plan.target, instrument)} hint={formatPips(plan.targetPips)} tone="grass" />
        <MetricTile label="Reward : risk" value={formatRatio(plan.riskReward)} hint={plan.breakEvenWinRate === null ? undefined : `breaks even at ${formatPercent(plan.breakEvenWinRate)} wins`} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="Position size" value={plan.sizing.lots === 0 ? "—" : `${plan.sizing.lots.toFixed(2)} lots`} hint={plan.sizing.lots === 0 ? "below the minimum" : `${Math.round(plan.sizing.units).toLocaleString()} units`} />
        <MetricTile label="If the stop is hit" value={formatMoney(-plan.potentialLoss)} tone="cherry" />
        <MetricTile label="If the target is hit" value={formatMoney(plan.potentialProfit)} tone="grass" />
        <MetricTile label="Margin needed" value={formatMoney(plan.sizing.marginRequired)} hint={`at ${plan.sizing.marginRequired > 0 ? "your chosen leverage" : "—"}`} />
      </div>

      <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
        Levels at 1R, 2R and 3R:{" "}
        {plan.rLevels.map((level) => `${level.r}R ${formatPrice(level.price, instrument)}`).join(" · ")}
        {plan.structureTarget !== null
          ? `. The nearest price the market actually turned at is ${formatPrice(plan.structureTarget, instrument)}, which is usually the more realistic target of the two.`
          : "."}
      </p>
      {plan.sizing.note ? (
        <p className="mt-1 text-xs font-extrabold text-[var(--fire-dark)] dark:text-[var(--fire)]">{plan.sizing.note}</p>
      ) : null}

      {onPaperTrade ? (
        <button
          type="button"
          onClick={() => onPaperTrade(plan)}
          disabled={plan.sizing.lots === 0}
          className="do-btn mt-3 rounded-xl px-4 py-2 text-xs [--btn-bg:var(--panel)] [--btn-fg:var(--ink)] [--btn-shadow:var(--border-strong)] disabled:opacity-40"
        >
          Open this as a paper trade
        </button>
      ) : null}
    </div>
  );
}
