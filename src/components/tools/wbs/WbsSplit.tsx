"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Two panes with a bar you can drag between them.
 *
 * The split is stored as a fraction rather than a pixel width, so it still
 * means the same thing after the window is resized or the tool is reopened on
 * a different screen. Below the large breakpoint the panes stack and the bar
 * disappears: side by side on a phone gives two unusable columns.
 */
export function WbsSplit({
  ratio,
  onRatio,
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  /** Share of the width taken by the left pane, 0.25 to 0.75. */
  ratio: number;
  onRatio: (ratio: number) => void;
  left: React.ReactNode;
  right: React.ReactNode;
  leftLabel: string;
  rightLabel: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const clamp = (value: number) => Math.min(0.75, Math.max(0.25, value));

  function onPointerMove(event: React.PointerEvent) {
    if (!dragging.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onRatio(clamp((event.clientX - rect.left) / rect.width));
  }

  function endDrag(event: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0"
      // A custom property rather than an inline width: flex-basis is the
      // main size, which would set the pane's *height* while the panes are
      // stacked. As a variable it can be applied from the large breakpoint up.
      style={{ "--wbs-split": `${(ratio * 100).toFixed(2)}%` } as React.CSSProperties}
    >
      <section
        aria-label={leftLabel}
        className="min-w-0 basis-auto lg:shrink-0 lg:basis-[var(--wbs-split)]"
      >
        {left}
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the panes"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={25}
        aria-valuemax={75}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          dragging.current = true;
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          const forward = event.key === "ArrowRight";
          const back = event.key === "ArrowLeft";
          if (!forward && !back) return;
          event.preventDefault();
          onRatio(clamp(ratio + (forward ? 0.05 : -0.05)));
        }}
        className={cn(
          "group hidden w-3 shrink-0 cursor-col-resize touch-none items-center justify-center rounded-full lg:flex",
          "focus-visible:outline-none",
        )}
      >
        <span className="h-16 w-1 rounded-full bg-[var(--border)] transition group-hover:bg-[var(--sky)] group-focus:bg-[var(--sky)]" />
      </div>

      <section aria-label={rightLabel} className="min-w-0 flex-1">
        {right}
      </section>
    </div>
  );
}
