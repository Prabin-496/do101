"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { gradeReaction } from "@/lib/games/puzzles";

const TARGET_COUNT = 30;
const TARGET_SIZE = 56;

interface Target {
  x: number;
  y: number;
  bornAt: number;
}

export function AimTrainer() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [target, setTarget] = React.useState<Target | null>(null);
  const [hits, setHits] = React.useState(0);
  const [misses, setMisses] = React.useState(0);

  // Held in state, not a ref, because the running average is rendered live.
  const [times, setTimes] = React.useState<number[]>([]);
  const areaRef = React.useRef<HTMLDivElement>(null);

  const place = React.useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const { width, height } = area.getBoundingClientRect();
    setTarget({
      // Inset by the target size so it never lands half off the edge.
      x: Math.random() * Math.max(1, width - TARGET_SIZE),
      y: Math.random() * Math.max(1, height - TARGET_SIZE),
      bornAt: performance.now(),
    });
  }, []);

  const start = () => {
    setTimes([]);
    setHits(0);
    setMisses(0);
    setResult(null);
    setPhase("playing");
    // Wait a frame so the play area has been measured.
    requestAnimationFrame(place);
  };

  const hit = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (!target) return;
    const all = [...times, performance.now() - target.bornAt];
    setTimes(all);
    const next = hits + 1;
    setHits(next);

    if (next >= TARGET_COUNT) {
      const average = all.reduce((a, b) => a + b, 0) / all.length;
      const fastest = Math.min(...all);
      const accuracy = (next / (next + misses)) * 100;

      setResult({
        score: Math.round(average),
        display: `${Math.round(average)}`,
        label: "ms per target",
        grade: gradeReaction(average),
        blurb: `${TARGET_COUNT} targets · ${accuracy.toFixed(0)}% of your clicks landed.`,
        stats: [
          { label: "Fastest", value: `${Math.round(fastest)} ms`, tone: "grass" },
          { label: "Accuracy", value: `${accuracy.toFixed(0)}%`, tone: "sky" },
          { label: "Misses", value: misses, tone: "cherry" },
        ],
        shareText: `I averaged ${Math.round(average)} ms per target on the DO101 aim trainer. Beat that?`,
      });
      setPhase("done");
      setTarget(null);
      return;
    }
    place();
  };

  const average = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;

  return (
    <GameShell
      id="aim-trainer"
      route="/games/aim-trainer"
      accent="cherry"
      lowerIsBetter
      formatBest={(best) => `${best} ms per target`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Start hitting targets"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            Hit {TARGET_COUNT} targets as fast as you can.
          </p>
          <p>
            A new target appears the instant you hit the last one. Your score is the average time
            per target — misses count against your accuracy but not your time.
          </p>
        </>
      }
      hud={
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Targets left" value={TARGET_COUNT - hits} tone="cherry" />
          <Stat
            label="Average"
            value={average ? `${Math.round(average)} ms` : "—"}
            tone="grass"
          />
          <Stat label="Misses" value={misses} tone="fire" />
        </div>
      }
    >
      <Card
        className="relative h-[52vh] min-h-[320px] select-none overflow-hidden bg-[var(--panel)]"
        onPointerDown={() => setMisses((m) => m + 1)}
      >
        <div ref={areaRef} className="absolute inset-0">
          {target ? (
            <button
              type="button"
              onPointerDown={hit}
              aria-label="Hit the target"
              className="do-pop absolute grid place-items-center rounded-full bg-[var(--cherry)] shadow-lg ring-4 ring-white/70 transition-transform active:scale-90"
              style={{
                left: target.x,
                top: target.y,
                width: TARGET_SIZE,
                height: TARGET_SIZE,
              }}
            >
              <span className="h-4 w-4 rounded-full bg-white/90" />
            </button>
          ) : null}
        </div>
      </Card>
      <p className="text-xs font-semibold text-[var(--muted)]">
        Clicking anywhere other than the target counts as a miss.
      </p>
    </GameShell>
  );
}
