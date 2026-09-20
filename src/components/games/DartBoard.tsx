"use client";

import * as React from "react";
import { RADIUS, type ThrowRecord } from "@/lib/games/darts";
import { BEDS, NUMBERS, PAINT, VIEW, clampAim } from "@/lib/games/dartboard";
import { cn } from "@/lib/utils/cn";

/** How wide the landing spread can get, as a fraction of the board radius. */
const MAX_SPREAD = 0.42;
const MIN_SPREAD = 0.018;
/** One full tighten-and-loosen cycle of the steady ring. */
const WOBBLE_MS = 1250;

type Phase = "idle" | "placing" | "steady";

export interface DartBoardProps {
  /** Whether this browser may throw right now. */
  active: boolean;
  /** Darts already thrown this turn, drawn where they landed. */
  throws: ThrowRecord[];
  onThrow: (x: number, y: number) => void;
  /** Shown under the board when it is somebody else's turn. */
  idleHint?: string;
}

export function DartBoard({ active, throws, onThrow, idleHint }: DartBoardProps) {
  const [aim, setAim] = React.useState<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const svgRef = React.useRef<SVGSVGElement>(null);
  const ringRef = React.useRef<SVGCircleElement>(null);
  const spreadRef = React.useRef(MAX_SPREAD);

  // Every change of hands starts from a clean board, which is a state
  // adjustment during render rather than an effect chasing a prop.
  const [wasActive, setWasActive] = React.useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    setAim(null);
    setPhase("idle");
  }

  /**
   * The steady ring is animated by writing straight to the SVG attribute.
   * Re-rendering eighty board beds sixty times a second to move one circle
   * would be a lot of work for a circle.
   */
  React.useEffect(() => {
    if (phase !== "steady") return;
    // Every hand starts unsteady, so a fast double-tap cannot inherit the
    // tight spread left behind by the previous dart.
    spreadRef.current = MAX_SPREAD;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = ((now - started) % WOBBLE_MS) / WOBBLE_MS;
      const tightness = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
      const spread = MIN_SPREAD + (MAX_SPREAD - MIN_SPREAD) * tightness;
      spreadRef.current = spread;
      ringRef.current?.setAttribute("r", String(spread));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const toBoard = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    const span = 2 * VIEW;
    const x = ((clientX - rect.left) / rect.width) * span - VIEW;
    const y = ((clientY - rect.top) / rect.height) * span - VIEW;
    return clampAim(x, y);
  };

  const release = React.useCallback(() => {
    if (!aim) return;
    const spread = spreadRef.current;
    const angle = Math.random() * Math.PI * 2;
    const distance = spread * Math.sqrt(Math.random());
    setPhase("idle");
    setAim(null);
    onThrow(aim.x + Math.cos(angle) * distance, aim.y + Math.sin(angle) * distance);
  }, [aim, onThrow]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!active) return;
    event.preventDefault();
    if (phase === "steady") {
      release();
      return;
    }
    const spot = toBoard(event.clientX, event.clientY);
    if (!spot) return;
    setAim(spot);
    setPhase("steady");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!active) return;
    const step = event.shiftKey ? 0.02 : 0.09;
    const nudge = (dx: number, dy: number) => {
      event.preventDefault();
      setPhase((p) => (p === "steady" ? "steady" : "placing"));
      setAim((a) => clampAim((a?.x ?? 0) + dx, (a?.y ?? 0) + dy));
    };

    switch (event.key) {
      case "ArrowUp":
        return nudge(0, -step);
      case "ArrowDown":
        return nudge(0, step);
      case "ArrowLeft":
        return nudge(-step, 0);
      case "ArrowRight":
        return nudge(step, 0);
      case " ":
      case "Enter":
        event.preventDefault();
        if (phase === "steady") release();
        else if (aim) setPhase("steady");
        else {
          setAim({ x: 0, y: 0 });
          setPhase("placing");
        }
        return;
      case "Escape":
        setAim(null);
        setPhase("idle");
        return;
      default:
    }
  };

  const hint = !active
    ? (idleHint ?? "Waiting for the other players.")
    : phase === "steady"
      ? "Now throw — the tighter the ring, the closer the dart lands."
      : phase === "placing"
        ? "Move with the arrow keys, then press space to steady your hand."
        : "Tap the board where you want the dart to go.";

  return (
    <div className="space-y-3">
      <div
        role="application"
        aria-label="Dartboard. Tap to aim, tap again to throw."
        aria-disabled={!active}
        tabIndex={active ? 0 : -1}
        onKeyDown={onKeyDown}
        className={cn(
          "relative mx-auto aspect-square w-full max-w-[min(32rem,84vw)] touch-none select-none rounded-full outline-none",
          "ring-offset-4 ring-offset-[var(--bg)] focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
          active ? "cursor-crosshair" : "cursor-default opacity-80",
        )}
      >
        <svg
          ref={svgRef}
          viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
          className="h-full w-full"
          onPointerDown={onPointerDown}
        >
          <circle cx={0} cy={0} r={VIEW - 0.01} fill={PAINT.rim} />
          <circle cx={0} cy={0} r={1.045} fill="none" stroke={PAINT.rimEdge} strokeWidth={0.09} />

          {NUMBERS.map(({ sector, x, y }) => (
            <text
              key={sector}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={PAINT.cream}
              fontSize={0.115}
              fontWeight={800}
            >
              {sector}
            </text>
          ))}

          <g stroke={PAINT.wire} strokeWidth={0.004}>
            {BEDS.map((bed, i) => (
              <path key={i} d={bed.d} fill={bed.fill} />
            ))}
            <circle cx={0} cy={0} r={RADIUS.outerBull} fill={PAINT.green} />
            <circle cx={0} cy={0} r={RADIUS.bull} fill={PAINT.red} />
          </g>

          {/* Darts already in the board this turn. */}
          {throws.map((t, i) => (
            <g key={i} className="do-pop">
              <circle cx={t.x} cy={t.y} r={0.055} fill={t.bust ? "#f2f5f6" : "#ffffff"} opacity={0.9} />
              <circle
                cx={t.x}
                cy={t.y}
                r={0.034}
                fill={t.bust ? PAINT.dark : PAINT.red}
                stroke="#fff"
                strokeWidth={0.012}
              />
            </g>
          ))}

          {/* Where the player is aiming, and how steady their hand is. */}
          {aim ? (
            <g pointerEvents="none">
              <circle
                ref={ringRef}
                cx={aim.x}
                cy={aim.y}
                r={phase === "steady" ? MAX_SPREAD : 0.06}
                fill="rgba(255,255,255,0.14)"
                stroke="#ffffff"
                strokeWidth={0.012}
                strokeDasharray="0.05 0.035"
              />
              <line x1={aim.x - 0.07} y1={aim.y} x2={aim.x + 0.07} y2={aim.y} stroke="#fff" strokeWidth={0.012} />
              <line x1={aim.x} y1={aim.y - 0.07} x2={aim.x} y2={aim.y + 0.07} stroke="#fff" strokeWidth={0.012} />
            </g>
          ) : null}
        </svg>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "text-center text-sm font-extrabold",
          active ? "text-[var(--ink)]" : "text-[var(--muted)]",
        )}
      >
        {hint}
      </p>
    </div>
  );
}
