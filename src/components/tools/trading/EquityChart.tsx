"use client";

import * as React from "react";
import { drawdownSeries, type EquityPoint } from "@/lib/trading/metrics";
import { formatMoney } from "@/lib/trading/format";

/**
 * The equity curve, with the drawdown drawn underneath it.
 *
 * Two plots rather than one line: the curve says what was made, and the band
 * below says what it felt like along the way. A curve alone hides the fact
 * that a run ending up 40% spent four months 30% under water.
 */
export function EquityChart({
  equity,
  initialBalance,
  splitTime,
  height = 180,
}: {
  equity: EquityPoint[];
  initialBalance: number;
  /** Where the in-sample half ends, when a run was split. */
  splitTime?: number | null;
  height?: number;
}) {
  const width = 720;
  const curveHeight = height - 46;

  if (equity.length < 2) {
    return (
      <p className="rounded-2xl bg-[var(--panel)] px-4 py-6 text-center text-xs font-semibold text-[var(--muted)]">
        No equity curve yet — run a backtest first.
      </p>
    );
  }

  const values = equity.map((p) => p.equity);
  const min = Math.min(...values, initialBalance);
  const max = Math.max(...values, initialBalance);
  const span = max - min || 1;
  const drawdowns = drawdownSeries(equity);
  const worst = Math.max(...drawdowns, 0.0001);

  const x = (i: number) => (i / (equity.length - 1)) * width;
  const y = (value: number) => curveHeight - ((value - min) / span) * (curveHeight - 8) - 4;

  const line = equity.map((point, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(point.equity).toFixed(1)}`).join(" ");
  const area = `${line} L ${width} ${curveHeight} L 0 ${curveHeight} Z`;
  const ddTop = curveHeight + 10;
  const ddHeight = height - ddTop - 12;
  const ddPath = drawdowns
    .map((value, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${(ddTop + (value / worst) * ddHeight).toFixed(1)}`)
    .join(" ");

  const splitIndex = splitTime ? equity.findIndex((p) => p.time >= splitTime) : -1;
  const final = equity.at(-1)!.equity;
  const up = final >= initialBalance;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-[180px] w-full"
        role="img"
        aria-label={`Equity curve from ${formatMoney(initialBalance)} to ${formatMoney(final)}, with a deepest drawdown of ${(worst * 100).toFixed(1)} percent.`}
      >
        <line x1="0" x2={width} y1={y(initialBalance)} y2={y(initialBalance)} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="4 4" />
        <path d={area} fill={up ? "var(--grass-soft)" : "var(--cherry-soft)"} />
        <path d={line} fill="none" stroke={up ? "var(--grass)" : "var(--cherry)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />

        {splitIndex > 0 ? (
          <>
            <line x1={x(splitIndex)} x2={x(splitIndex)} y1="0" y2={height - 12} stroke="var(--fire)" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={x(splitIndex) + 4} y="12" fontSize="10" fontWeight="800" fill="var(--fire-dark)">
              held back from here →
            </text>
          </>
        ) : null}

        <path d={`${ddPath} L ${width} ${ddTop} L 0 ${ddTop} Z`} fill="var(--cherry-soft)" />
        <path d={ddPath} fill="none" stroke="var(--cherry)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <text x="2" y={ddTop - 2} fontSize="9" fontWeight="800" fill="var(--muted)">
          drawdown, deepest {(worst * 100).toFixed(1)}%
        </text>
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] font-extrabold tabular-nums text-[var(--muted)]">
        <span>Start {formatMoney(initialBalance)}</span>
        <span>Peak {formatMoney(max)}</span>
        <span className={up ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"}>
          End {formatMoney(final)}
        </span>
      </figcaption>
    </figure>
  );
}
