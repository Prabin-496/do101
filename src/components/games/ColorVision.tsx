"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { generateColorRound, type ColorRound } from "@/lib/games/puzzles";
import { cn } from "@/lib/utils/cn";

const LIVES = 3;

export function ColorVision() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [level, setLevel] = React.useState(0);
  const [lives, setLives] = React.useState(LIVES);
  const [round, setRound] = React.useState<ColorRound>(() => generateColorRound(0));
  const [shake, setShake] = React.useState(false);

  const start = () => {
    setLevel(0);
    setLives(LIVES);
    setRound(generateColorRound(0));
    setResult(null);
    setPhase("playing");
  };

  const tap = (index: number) => {
    if (phase !== "playing") return;

    if (index === round.oddIndex) {
      const next = level + 1;
      setLevel(next);
      setRound(generateColorRound(next));
      return;
    }

    setShake(true);
    window.setTimeout(() => setShake(false), 400);
    const remaining = lives - 1;
    setLives(remaining);

    if (remaining <= 0) {
      setResult({
        score: level,
        display: String(level),
        label: level === 1 ? "level" : "levels",
        grade: level >= 25 ? "Exceptional eyes" : level >= 18 ? "Very sharp" : level >= 12 ? "Good" : "Keep looking",
        blurb:
          "The grid grows and the shade difference shrinks each level, so it gets harder in two ways at once.",
        stats: [
          { label: "Level reached", value: level, tone: "grape" },
          { label: "Final grid", value: `${round.size}×${round.size}`, tone: "sky" },
        ],
        shareText: `I reached level ${level} on the DO101 colour vision test. How good are your eyes?`,
      });
      setPhase("done");
    }
  };

  return (
    <GameShell
      id="color-vision"
      route="/games/color-vision"
      accent="grape"
      formatBest={(best) => `level ${best}`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Test my eyes"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            One tile is a slightly different shade. Find it.
          </p>
          <p>
            The grid grows and the difference shrinks with every level, down to a shade separation
            near the limit of what a typical screen can even show. Three misses and it ends.
          </p>
        </>
      }
      hud={
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Level" value={level + 1} tone="grape" />
          <Stat label="Grid" value={`${round.size}×${round.size}`} tone="sky" />
          <Stat label="Lives" value={"❤️".repeat(Math.max(0, lives)) || "—"} tone="cherry" />
        </div>
      }
    >
      <Card className={cn("p-4", shake && "do-shake")}>
        <div
          className="mx-auto grid w-full max-w-md gap-1.5"
          style={{ gridTemplateColumns: `repeat(${round.size}, minmax(0, 1fr))` }}
          role="group"
          aria-label="Find the tile with a different shade"
        >
          {Array.from({ length: round.size * round.size }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => tap(index)}
              aria-label={`Tile ${index + 1}`}
              className="aspect-square rounded-lg transition-transform active:scale-95"
              style={{ background: index === round.oddIndex ? round.oddColor : round.baseColor }}
            />
          ))}
        </div>
      </Card>
      <p className="text-center text-xs font-semibold text-[var(--muted)]">
        Screen brightness and colour settings genuinely affect this one — compare against your own
        past scores rather than someone else&rsquo;s.
      </p>
    </GameShell>
  );
}
