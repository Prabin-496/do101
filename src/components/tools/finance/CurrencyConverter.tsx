"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Slider } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/Feedback";
import {
  convert, CURRENCIES, CURRENCY_NAMES, fetchHistory, PEGGED, rate as rateOf, withMargin, type HistoryPoint,
} from "@/lib/currency/rates";
import { Chip, ChipRow, MetricTile, Panel } from "../trading/shared";
import { useEcbRates } from "./use-ecb-rates";

const POPULAR: [string, string][] = [
  ["USD", "EUR"], ["USD", "INR"], ["EUR", "GBP"], ["USD", "JPY"], ["GBP", "USD"], ["USD", "NPR"], ["AUD", "USD"], ["USD", "CAD"],
];
const SNAPSHOT = ["USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD", "CHF", "CNY"];
const RANGES = [
  { id: 30, label: "1 month" },
  { id: 90, label: "3 months" },
  { id: 365, label: "1 year" },
];

function fmt(n: number | null, currency?: string): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const digits = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 6;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })}${currency ? ` ${currency}` : ""}`;
}

/**
 * Currency conversion at the ECB reference rate.
 *
 * The margin slider is the honest part. Everyone quoting "the exchange rate"
 * is quoting the mid-market rate; what arrives in your account is that, less a
 * spread the bank or card or counter keeps. Seeing both numbers side by side
 * is the thing a free converter can do that a bank's own will not.
 */
export function CurrencyConverter() {
  const [amount, setAmount] = React.useState("100");
  const [from, setFrom] = React.useState("USD");
  const [to, setTo] = React.useState("EUR");
  const [margin, setMargin] = React.useState(3);
  const [days, setDays] = React.useState(90);
  const [history, setHistory] = React.useState<{ key: string; points: HistoryPoint[] } | null>(null);

  const { table, error } = useEcbRates(true);
  const value = Number(amount);
  const valid = amount !== "" && Number.isFinite(value);
  const result = table && valid ? convert(value, from, to, table) : null;
  const unit = table ? rateOf(from, to, table) : null;
  const inverse = table ? rateOf(to, from, table) : null;

  const historyKey = `${from}-${to}-${days}`;
  React.useEffect(() => {
    if (from === to) return;
    let cancelled = false;
    fetchHistory(from, to, days).then(
      (points) => {
        if (!cancelled) setHistory({ key: historyKey, points });
      },
      () => {
        if (!cancelled) setHistory({ key: historyKey, points: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [from, to, days, historyKey]);

  const points = history?.key === historyKey ? history.points : null;
  const pegNote = PEGGED[from]?.note ?? PEGGED[to]?.note ?? null;

  return (
    <div className="space-y-4">
      <Panel title="Convert" icon="💱" subtitle={table ? `ECB reference rates for ${table.date}` : "Loading today's reference rates…"}>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_1fr]">
          <div>
            <Label htmlFor="cc-amount">Amount</Label>
            <Input id="cc-amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg" />
          </div>
          <div>
            <Label htmlFor="cc-from">From</Label>
            <Select id="cc-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {CURRENCY_NAMES[c]}</option>)}
            </Select>
          </div>
          <Button tone="panel" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap currencies">⇄</Button>
          <div>
            <Label htmlFor="cc-to">To</Label>
            <Select id="cc-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {CURRENCY_NAMES[c]}</option>)}
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <ChipRow ariaLabel="Popular pairs">
            {POPULAR.map(([a, b]) => (
              <Chip key={`${a}${b}`} active={from === a && to === b} onClick={() => { setFrom(a); setTo(b); }}>
                {a} → {b}
              </Chip>
            ))}
          </ChipRow>
        </div>

        {error ? <ErrorState className="mt-3" message={error} /> : null}

        <div className="mt-4 rounded-2xl bg-[var(--panel)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--muted)]">
            {valid ? value.toLocaleString() : "—"} {from} =
          </p>
          <p className="text-3xl font-extrabold tabular-nums sm:text-4xl">{fmt(result, to)}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            1 {from} = {fmt(unit, to)} · 1 {to} = {fmt(inverse, from)}
          </p>
        </div>
        {pegNote ? <p className="mt-2 text-xs font-semibold text-[var(--muted)]">{pegNote}</p> : null}
      </Panel>

      <Panel title="What you would actually get" icon="🏦" subtitle="Banks, cards and exchange counters add a margin to the rate above.">
        <div className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-extrabold">Margin {margin.toFixed(1)}%</span>
          <Slider min={0} max={8} step={0.1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} aria-label="Provider margin" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricTile label="At the reference rate" value={fmt(result, to)} />
          <MetricTile label={`After a ${margin.toFixed(1)}% margin`} value={fmt(result === null ? null : withMargin(result, margin), to)} tone="grass" />
          <MetricTile label="The margin costs you" value={fmt(result === null ? null : result - withMargin(result, margin), to)} tone="cherry" />
        </div>
        <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
          Airport counters and some cards charge 5% or more; specialist transfer services are often under 1%. Ask
          for the rate you will get and compare it with this one — the difference is the real fee, whatever the
          advertised commission says.
        </p>
      </Panel>

      <Panel
        title={`${from} to ${to} over time`}
        icon="📈"
        right={
          <ChipRow ariaLabel="History range">
            {RANGES.map((r) => <Chip key={r.id} active={days === r.id} onClick={() => setDays(r.id)}>{r.label}</Chip>)}
          </ChipRow>
        }
      >
        <HistoryChart points={points} from={from} to={to} />
      </Panel>

      {table && valid ? (
        <Panel title={`${value.toLocaleString()} ${from} in other currencies`} icon="🌍">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SNAPSHOT.filter((c) => c !== from).slice(0, 6).map((c) => (
              <MetricTile key={c} label={`${c} — ${CURRENCY_NAMES[c]}`} value={fmt(convert(value, from, c, table))} />
            ))}
          </div>
        </Panel>
      ) : null}

      <p className="text-xs font-semibold text-[var(--muted)]">
        Rates are the European Central Bank&rsquo;s daily reference rates, published around 16:00 CET on working
        days and fetched from your browser via the free Frankfurter service. They are for information, not for
        trading, and weekend or holiday rates are the last working day&rsquo;s.
      </p>
    </div>
  );
}

function HistoryChart({ points, from, to }: { points: HistoryPoint[] | null; from: string; to: string }) {
  if (from === to) return <p className="text-xs font-semibold text-[var(--muted)]">Pick two different currencies to see a history.</p>;
  if (points === null) return <p className="text-xs font-semibold text-[var(--muted)]">Loading…</p>;
  if (points.length < 2) return <p className="text-xs font-semibold text-[var(--muted)]">No history came back for this pair.</p>;

  const width = 720;
  const height = 160;
  const rates = points.map((p) => p.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const span = max - min || max * 0.001 || 1;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (r: number) => height - 8 - ((r - min) / span) * (height - 16);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.rate).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points.at(-1)!;
  const change = ((last.rate - first.rate) / first.rate) * 100;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-40 w-full" role="img"
        aria-label={`${from} to ${to} moved ${change.toFixed(2)} percent, from ${fmt(first.rate)} to ${fmt(last.rate)}.`}>
        <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="var(--sky-soft)" />
        <path d={path} fill="none" stroke="var(--sky)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] font-extrabold tabular-nums text-[var(--muted)]">
        <span>{first.date}: {fmt(first.rate)}</span>
        <span>Low {fmt(min)} · High {fmt(max)}</span>
        <span className={change >= 0 ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"}>
          {last.date}: {fmt(last.rate)} ({change >= 0 ? "+" : ""}{change.toFixed(2)}%)
        </span>
      </figcaption>
    </figure>
  );
}
