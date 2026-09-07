"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { celebrate } from "@/lib/celebrate";

export function ResultCard({
  headline,
  primary,
  primaryLabel,
  secondary,
  badge,
  children,
  accent = "cherry",
  celebrateOnMount = false,
}: {
  headline: string;
  primary: React.ReactNode;
  primaryLabel: string;
  secondary?: React.ReactNode;
  badge?: string;
  children?: React.ReactNode;
  accent?: "cherry" | "grass" | "sky" | "grape" | "fire";
  /** Only true for a genuine win: a new personal best or a won race. */
  celebrateOnMount?: boolean;
}) {
  React.useEffect(() => {
    if (celebrateOnMount) void celebrate();
  }, [celebrateOnMount]);

  return (
    <Card
      className="do-pop overflow-hidden text-center"
      style={{ background: `var(--${accent}-soft)` }}
    >
      <div className="p-6 sm:p-8">
        {badge ? (
          <p className="mb-3 inline-block rounded-full bg-[var(--bg)] px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest">
            {badge}
          </p>
        ) : null}
        <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
          {headline}
        </p>
        <p className="mt-1 text-6xl font-extrabold tabular-nums sm:text-7xl">{primary}</p>
        <p className="text-sm font-extrabold uppercase tracking-widest text-[var(--muted)]">
          {primaryLabel}
        </p>
        {secondary ? <div className="mt-4">{secondary}</div> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </Card>
  );
}
