"use client";

import * as React from "react";
import { emi as emiOf, loan, yearly } from "@/lib/calculators/loan";
import { Chip, ChipRow, MetricTile, NumberField, Panel } from "../trading/shared";

const money = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: n < 1000 ? 2 : 0 }) : "—";

/**
 * EMI and amortisation.
 *
 * Shows the uncomfortable number up front — how much of the total goes to
 * interest — and what a small overpayment every month does to it, which is the
 * single most useful thing a loan calculator can tell someone.
 */
export function LoanCalculator() {
  const [principal, setPrincipal] = React.useState(500_000);
  const [rate, setRate] = React.useState(9.5);
  const [tenure, setTenure] = React.useState(20);
  const [unit, setUnit] = React.useState<"years" | "months">("years");
  const [extra, setExtra] = React.useState(0);
  const [showMonthly, setShowMonthly] = React.useState(false);

  const months = unit === "years" ? Math.round(tenure * 12) : Math.round(tenure);
  const result = loan({ principal, annualRate: rate, months, extraMonthly: extra });

  if (!result) {
    return (
      <Panel title="Loan details" icon="🏦">
        <p className="text-sm font-semibold text-[var(--muted)]">Enter an amount above zero and a term of at least one month.</p>
      </Panel>
    );
  }

  const interestShare = result.totalPaid > 0 ? (result.totalInterest / result.totalPaid) * 100 : 0;
  const years = yearly(result.schedule);
  const sampleExtra = Math.max(100, Math.round(result.emi * 0.1 / 100) * 100);
  const sample = loan({ principal, annualRate: rate, months, extraMonthly: sampleExtra });

  return (
    <div className="space-y-4">
      <Panel title="Loan details" icon="🏦">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Loan amount" value={principal} min={1} step={1000} onChange={setPrincipal} />
          <NumberField label="Interest rate (yearly)" value={rate} min={0} max={100} step={0.05} onChange={setRate} suffix="%" />
          <div>
            <NumberField label={`Term (${unit})`} value={tenure} min={1} max={unit === "years" ? 50 : 600} onChange={setTenure} />
            <div className="mt-1.5">
              <ChipRow ariaLabel="Term unit">
                <Chip active={unit === "years"} onClick={() => { setUnit("years"); setTenure(Math.max(1, Math.round(tenure / 12))); }}>Years</Chip>
                <Chip active={unit === "months"} onClick={() => { setUnit("months"); setTenure(tenure * 12); }}>Months</Chip>
              </ChipRow>
            </div>
          </div>
          <NumberField label="Extra each month" value={extra} min={0} step={100} hint="optional overpayment" onChange={setExtra} />
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="Monthly payment (EMI)" value={money(result.emi)} tone="grass" hint={extra > 0 ? `plus ${money(extra)} extra` : undefined} />
        <MetricTile label="Total interest" value={money(result.totalInterest)} tone="cherry" />
        <MetricTile label="Total you repay" value={money(result.totalPaid)} />
        <MetricTile
          label="Paid off in"
          value={`${Math.floor(result.monthsTaken / 12)}y ${result.monthsTaken % 12}m`}
          hint={result.monthsSaved > 0 ? `${result.monthsSaved} months early` : `${result.monthsTaken} payments`}
        />
      </div>

      <Panel title="Where your money goes" icon="🥧">
        <div className="flex h-5 overflow-hidden rounded-full" role="img" aria-label={`${interestShare.toFixed(1)} percent of the total repaid is interest.`}>
          <div className="bg-[var(--sky)]" style={{ width: `${100 - interestShare}%` }} />
          <div className="bg-[var(--cherry)]" style={{ width: `${interestShare}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold">
          <strong>{interestShare.toFixed(1)}%</strong> of everything you repay is interest — for every 100
          borrowed you pay back {(100 + result.interestShare).toFixed(0)}.
        </p>
        {extra > 0 ? (
          <p className="mt-2 rounded-2xl border-2 border-[var(--grass)] bg-[var(--grass-soft)] px-4 py-3 text-xs font-semibold">
            Paying {money(extra)} extra every month clears the loan <strong>{result.monthsSaved} months</strong> sooner
            and saves <strong>{money(result.interestSaved)}</strong> in interest.
          </p>
        ) : sample && sample.interestSaved > 0 ? (
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
            For comparison: paying {money(sampleExtra)} more a month would clear it {sample.monthsSaved} months
            sooner and save {money(sample.interestSaved)}. Check your lender allows overpayments without a fee first.
          </p>
        ) : null}
      </Panel>

      <Panel
        title="Repayment schedule"
        icon="📋"
        right={
          <ChipRow ariaLabel="Schedule detail">
            <Chip active={!showMonthly} onClick={() => setShowMonthly(false)}>By year</Chip>
            <Chip active={showMonthly} onClick={() => setShowMonthly(true)}>Every month</Chip>
          </ChipRow>
        }
      >
        <div className="do-scroll max-h-96 overflow-auto rounded-2xl border-2 border-[var(--border)]">
          <table className="w-full min-w-[520px] text-xs font-semibold tabular-nums">
            <thead className="sticky top-0 bg-[var(--panel)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">{showMonthly ? "Month" : "Year"}</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Interest</th>
                <th className="px-3 py-2">Principal</th>
                <th className="px-3 py-2">Balance left</th>
              </tr>
            </thead>
            <tbody>
              {(showMonthly
                ? result.schedule.map((r) => ({ key: r.month, paid: r.payment, interest: r.interest, principal: r.principal, balance: r.balance }))
                : years.map((y) => ({ key: y.year, paid: y.paid, interest: y.interest, principal: y.principal, balance: y.balance }))
              ).map((row) => (
                <tr key={row.key} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5 font-extrabold">{row.key}</td>
                  <td className="px-3 py-1.5">{money(row.paid)}</td>
                  <td className="px-3 py-1.5 text-[var(--cherry-dark)] dark:text-[var(--cherry)]">{money(row.interest)}</td>
                  <td className="px-3 py-1.5">{money(row.principal)}</td>
                  <td className="px-3 py-1.5 font-extrabold">{money(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
          The EMI formula every lender uses: P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), where r is the monthly rate and n
          the number of months. At {rate}% over {months} months that is {money(emiOf(principal, rate, months))}.
          Real loans can add processing fees, insurance and rate changes on floating loans, which this does not include.
        </p>
      </Panel>
    </div>
  );
}
