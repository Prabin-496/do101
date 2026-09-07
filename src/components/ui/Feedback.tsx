"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon = "✨",
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] px-6 py-10 text-center",
        className,
      )}
    >
      <span className="do-bob text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="mt-3 text-base font-extrabold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm font-semibold text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "That didn't work",
  message,
  action,
  className,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "do-shake rounded-2xl border-2 border-[var(--cherry)] bg-[var(--cherry-soft)] p-4",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--cherry-dark)] dark:text-[var(--cherry)]">
        <span aria-hidden>⚠️</span>
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="do-pop flex items-center gap-2 rounded-2xl border-2 border-[var(--grass)] bg-[var(--grass-soft)] px-4 py-3 text-sm font-extrabold text-[var(--grass-dark)] dark:text-[var(--grass)]"
    >
      <span aria-hidden>✅</span>
      {children}
    </p>
  );
}

export function InfoNote({
  children,
  icon = "🔒",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border-2 border-[var(--sky)] bg-[var(--sky-soft)] px-4 py-3 text-sm font-semibold text-[var(--ink)]">
      <span aria-hidden className="mt-px">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

export function Progress({
  value,
  tone = "grass",
  label,
  className,
}: {
  value: number;
  tone?: "grass" | "sky" | "fire" | "cherry" | "grape" | "sun";
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-1 flex justify-between text-xs font-extrabold text-[var(--muted)]">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div
        className="h-4 w-full overflow-hidden rounded-full bg-[var(--panel-2)]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: `var(--${tone})`,
            boxShadow: "inset 0 3px 0 rgba(255,255,255,.35)",
          }}
        />
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "ink",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "ink" | "grass" | "sky" | "fire" | "cherry" | "grape" | "sun";
  className?: string;
}) {
  return (
    <div className={cn("do-card px-4 py-3", className)}>
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-0.5 text-2xl font-extrabold tabular-nums"
        style={{ color: tone === "ink" ? "var(--ink)" : `var(--${tone})` }}
      >
        {value}
      </p>
      {hint ? <p className="text-xs font-semibold text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
