"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  id: string;
  label: React.ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "do-scroll flex gap-1.5 overflow-x-auto rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-1.5",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "shrink-0 rounded-xl px-3.5 py-2 text-sm font-extrabold transition-colors",
              active
                ? "bg-[var(--bg)] text-[var(--ink)] shadow-[0_2px_0_var(--border-strong)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
