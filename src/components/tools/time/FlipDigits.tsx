"use client";

import * as React from "react";

/**
 * A split-flap card, the Fliqlo look done in CSS.
 *
 * Two static halves show the current value; when it changes, an animated pair
 * folds the old top down and swings the new bottom up. Sizing is driven
 * entirely by the font size passed in, so one component scales from a page
 * preview to a full-screen screensaver without extra breakpoints.
 */
function FlipCard({ value, label }: { value: string; label: string }) {
  // React's documented pattern for state derived from a prop: adjust during
  // render rather than in an effect, so the new digit and its outgoing twin
  // are committed together and the fold never shows a stale frame.
  const [current, setCurrent] = React.useState(value);
  const [previous, setPrevious] = React.useState<string | null>(null);

  if (value !== current) {
    setPrevious(current);
    setCurrent(value);
  }

  // Retire the animating halves once the fold has finished.
  React.useEffect(() => {
    if (previous === null) return;
    const id = window.setTimeout(() => setPrevious(null), 700);
    return () => window.clearTimeout(id);
  }, [previous, current]);

  return (
    <div className="flex flex-col items-center gap-[0.14em]">
      <div
        className="flip-card"
        style={{ width: "1.28em", height: "1.72em", fontSize: "inherit" }}
        aria-hidden
      >
        <div className="flip-half flip-half-top">
          <span>{current}</span>
        </div>
        <div className="flip-half flip-half-bottom">
          <span>{current}</span>
        </div>

        {previous !== null ? (
          <>
            <div key={`t-${current}`} className="flip-anim flip-anim-top">
              <span>{previous}</span>
            </div>
            <div key={`b-${current}`} className="flip-anim flip-anim-bottom">
              <span>{current}</span>
            </div>
          </>
        ) : null}
      </div>
      <span
        className="font-sans font-extrabold uppercase tracking-[0.18em] opacity-45"
        style={{ fontSize: "0.13em" }}
      >
        {label}
      </span>
    </div>
  );
}

export function FlipDigits({
  groups,
  fontSize,
}: {
  groups: Array<{ value: string; label: string }>;
  fontSize: string;
}) {
  return (
    <div
      className="flex items-start justify-center font-mono tabular-nums"
      style={{ fontSize, gap: "0.16em", fontWeight: 600 }}
    >
      {groups.map((group, i) => (
        <React.Fragment key={group.label}>
          {i > 0 ? (
            <span
              aria-hidden
              className="self-center opacity-35"
              style={{ fontSize: "0.5em", marginTop: "-0.3em" }}
            >
              :
            </span>
          ) : null}
          <FlipCard value={group.value} label={group.label} />
        </React.Fragment>
      ))}
    </div>
  );
}
