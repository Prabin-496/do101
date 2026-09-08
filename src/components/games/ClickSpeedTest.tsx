"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Stat, Progress } from "@/components/ui/Feedback";
import { Tabs } from "@/components/ui/Tabs";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";

const DURATIONS = [5, 10, 30] as const;

function grade(cps: number): string {
  if (cps >= 10) return "Extraordinary";
  if (cps >= 8) return "Very fast";
  if (cps >= 6.5) return "Fast";
  if (cps >= 5) return "Above average";
  if (cps >= 3.5) return "Average";
  return "Warming up";
}

export function ClickSpeedTest() {
  const [duration, setDuration] = React.useState<number>(5);
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [clicks, setClicks] = React.useState(0);
  const [remaining, setRemaining] = React.useState(duration);
  // Rendered as a prompt, so it has to be state rather than the ref alone.
  const [started, setStarted] = React.useState(false);

  const startedAt = React.useRef(0);
  const clicksRef = React.useRef(0);

  const finish = React.useCallback(() => {
    const total = clicksRef.current;
    const cps = total / duration;

    setResult({
      score: Math.round(cps * 100) / 100,
      display: cps.toFixed(1),
      label: "clicks per second",
      grade: grade(cps),
      blurb: `${total} clicks in ${duration} seconds.`,
      stats: [
        { label: "Total clicks", value: total, tone: "grass" },
        { label: "Duration", value: `${duration}s`, tone: "sky" },
        { label: "Per minute", value: Math.round(cps * 60), tone: "grape" },
      ],
      shareText: `I clicked ${cps.toFixed(1)} times per second on DO101. Can you go faster?`,
    });
    setPhase("done");
  }, [duration]);

  // The timer starts on the first click, not when the page loads.
  React.useEffect(() => {
    if (phase !== "playing" || startedAt.current === 0) return;
    const id = window.setInterval(() => {
      const left = duration - (performance.now() - startedAt.current) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        finish();
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [phase, duration, finish, clicks]);

  const start = () => {
    clicksRef.current = 0;
    startedAt.current = 0;
    setStarted(false);
    setClicks(0);
    setRemaining(duration);
    setResult(null);
    setPhase("playing");
  };

  const click = () => {
    if (phase !== "playing") return;
    if (startedAt.current === 0) {
      startedAt.current = performance.now();
      setStarted(true);
    }
    clicksRef.current += 1;
    setClicks(clicksRef.current);
  };

  const elapsed = duration - remaining;
  const liveCps = elapsed > 0.2 ? clicks / elapsed : 0;

  return (
    <GameShell
      id="click-speed-test"
      route="/games/click-speed-test"
      accent="fire"
      formatBest={(best) => `${best} clicks per second`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel={`Start the ${duration} second test`}
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            How many times can you click in {duration} seconds?
          </p>
          <p>
            The clock starts on your first click, so take your time getting ready. Tapping works
            just as well as clicking.
          </p>
          <div className="pt-2">
            <Tabs
              ariaLabel="Test length"
              value={String(duration)}
              onChange={(v) => {
                setDuration(Number(v));
                setRemaining(Number(v));
              }}
              items={DURATIONS.map((d) => ({ id: String(d), label: `${d} seconds` }))}
            />
          </div>
        </>
      }
      hud={
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Clicks" value={clicks} tone="fire" />
            <Stat label="Time left" value={`${remaining.toFixed(1)}s`} tone="cherry" />
            <Stat label="Clicks / sec" value={liveCps ? liveCps.toFixed(1) : "—"} tone="grass" />
          </div>
          <Progress className="mt-3" value={(elapsed / duration) * 100} tone="fire" />
        </>
      }
    >
      <Card
        role="button"
        tabIndex={0}
        onPointerDown={click}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            click();
          }
        }}
        aria-label="Click as fast as you can"
        className="grid h-[46vh] min-h-[280px] cursor-pointer select-none place-items-center bg-[var(--fire-soft)] transition-transform active:scale-[0.99]"
      >
        <div className="text-center">
          <p className="text-7xl font-extrabold tabular-nums">{clicks}</p>
          <p className="mt-2 text-lg font-extrabold text-[var(--muted)]">
            {started ? "Keep clicking!" : "Click to start the clock"}
          </p>
        </div>
      </Card>
    </GameShell>
  );
}
