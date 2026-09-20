"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** A right-click menu, kept inside the canvas so it cannot run off the page. */
export function CanvasContextMenu({
  x,
  y,
  bounds,
  items,
  onClose,
}: {
  x: number;
  y: number;
  bounds: { w: number; h: number };
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    // Capture, so the canvas does not also act on the dismissing click.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  const width = 188;
  const height = items.length * 32 + 12;
  const left = Math.min(x, Math.max(0, bounds.w - width - 4));
  const top = Math.min(y, Math.max(0, bounds.h - height - 4));

  return (
    <div
      ref={ref}
      role="menu"
      className="do-pop absolute z-20 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] p-1.5 shadow-[0_6px_0_var(--border-strong)]"
      style={{ left, top, width }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-extrabold transition-colors",
            item.disabled
              ? "cursor-not-allowed text-[var(--muted)] opacity-50"
              : item.danger
                ? "text-[var(--cherry)] hover:bg-[var(--cherry-soft)]"
                : "hover:bg-[var(--panel)]",
          )}
        >
          <span>{item.label}</span>
          {item.hint ? <span className="text-[10px] font-bold text-[var(--muted)]">{item.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}
