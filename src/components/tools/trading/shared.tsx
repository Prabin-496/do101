"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Label } from "@/components/ui/Field";
import type { SignalVerdict } from "@/lib/trading/types";

/**
 * The line that belongs on every result in this tool, worded the same way
 * every time so it reads as a standing condition rather than small print that
 * only appears when the numbers are bad.
 */
export function PastPerformanceNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs font-semibold text-[var(--muted)]", className)}>
      Past backtest performance does not predict future results.
    </p>
  );
}

export function Panel({
  title,
  subtitle,
  icon,
  children,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("do-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            {icon ? <span aria-hidden>{icon}</span> : null}
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** A labelled number input that never fights the person typing in it. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  // Kept as text while focused so "0.", "" and "1.5" are all typeable states.
  const [draft, setDraft] = React.useState<string | null>(null);
  const id = React.useId();

  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="do-input tabular-nums"
          value={draft ?? String(value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = Number(event.target.value);
            if (event.target.value !== "" && Number.isFinite(parsed)) {
              onChange(clamp(parsed, min, max));
            }
          }}
          onBlur={() => setDraft(null)}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-[var(--muted)]">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function clamp(value: number, min?: number, max?: number): number {
  let out = value;
  if (min !== undefined) out = Math.max(min, out);
  if (max !== undefined) out = Math.min(max, out);
  return out;
}

export function VerdictBadge({
  verdict,
  score,
  size = "md",
}: {
  verdict: SignalVerdict;
  score?: number;
  size?: "sm" | "md" | "lg";
}) {
  const tone =
    verdict === "buy"
      ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
      : verdict === "sell"
        ? "border-[var(--cherry)] bg-[var(--cherry-soft)] text-[var(--cherry-dark)] dark:text-[var(--cherry)]"
        : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]";
  const sizing = size === "lg" ? "px-4 py-2 text-lg" : size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-xl border-2 font-extrabold uppercase tracking-wide", tone, sizing)}>
      {verdict === "buy" ? "Buy" : verdict === "sell" ? "Sell" : "Neutral"}
      {score !== undefined ? <span className="tabular-nums opacity-80">{score}/100</span> : null}
    </span>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "ink" | "grass" | "cherry" | "muted";
}) {
  const colour =
    tone === "grass"
      ? "text-[var(--grass-dark)] dark:text-[var(--grass)]"
      : tone === "cherry"
        ? "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"
        : tone === "muted"
          ? "text-[var(--muted)]"
          : "text-[var(--ink)]";
  return (
    <div className="rounded-2xl bg-[var(--panel)] px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className={cn("text-lg font-extrabold tabular-nums", colour)}>{value}</p>
      {hint ? <p className="text-[11px] font-semibold text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function WarningList({ items, tone = "fire" }: { items: string[]; tone?: "fire" | "cherry" }) {
  if (items.length === 0) return null;
  const colour =
    tone === "cherry"
      ? "border-[var(--cherry)] bg-[var(--cherry-soft)]"
      : "border-[var(--fire)] bg-[var(--fire-soft)]";
  return (
    <ul className={cn("space-y-1.5 rounded-2xl border-2 px-4 py-3", colour)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-xs font-semibold">
          <span aria-hidden className="mt-px">
            ⚠️
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A horizontal chip row that scrolls rather than wrapping into a wall. */
export function ChipRow({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="do-scroll flex gap-1.5 overflow-x-auto pb-1">
      {children}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition-colors",
        active
          ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
          : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel)]",
      )}
    >
      {children}
    </button>
  );
}
