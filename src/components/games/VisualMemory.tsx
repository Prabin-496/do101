"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { pickCells, gradeLevel } from "@/lib/games/puzzles";
import { cn } from "@/lib/utils/cn";

type Stage = "showing" | "guessing" | "resolving";

const LIVES = 3;

export function VisualMemory() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [stage, setStage] = React.useState<Stage>("showing");
  const [level, setLevel] = React.useState(1);
  const [lives, setLives] = React.useState(LIVES);
  const [pattern, setPattern] = React.useState<number[]>([]);
  const [found, setFound] = React.useState<number[]>([]);
  const [wrong, setWrong] = React.useState<number[]>([]);

  // The grid grows every third level; the pattern grows every level.
  const size = Math.min(7, 3 + Math.floor(level / 3));
  const tiles = size * size;

  const startLevel = React.useCallback((next: number, remainingLives: number) => {
    const gridSize = Math.min(7, 3 + Math.floor(next / 3));
    setPattern(pickCells(gridSize, Math.min(gridSize * gridSize - 1, next + 2)));
    setFound([]);
    setWrong([]);
    setStage("showing");
    setLives(remainingLives);
    window.setTimeout(() => setStage("guessing"), 900 + next * 90);
  }, []);

  const end = React.useCallback(
    (reached: number) => {
      setResult({
        score: reached,
        display: String(reached),
        label: reached === 1 ? "level" : "levels",
        grade: gradeLevel(reached, 9),
        blurb: "The grid grows every third level, so the later ones are genuinely harder.",
        stats: [
          { label: "Level reached", value: reached, tone: "sky" },
          { label: "Average person", value: "9", tone: "grass" },
        ],
        shareText: `I reached level ${reached} on the DO101 visual memory test. Can you go further?`,
      });
      setPhase("done");
    },
    [],
  );

  const start = () => {
    setLevel(1);
    setResult(null);
    setPhase("playing");
    startLevel(1, LIVES);
  };

  const tap = (index: number) => {
    if (stage !== "guessing" || found.includes(index) || wrong.includes(index)) return;

    if (pattern.includes(index)) {
      const nextFound = [...found, index];
      setFound(nextFound);

      if (nextFound.length === pattern.length) {
        setStage("resolving");
        const next = level + 1;
        window.setTimeout(() => {
          setLevel(next);
          startLevel(next, lives);
        }, 550);
      }
      return;
    }

    const nextWrong = [...wrong, index];
    setWrong(nextWrong);
    const remaining = lives - 1;
    setLives(remaining);

    if (remaining <= 0) {
      setStage("resolving");
      window.setTimeout(() => end(level - 1), 800);
    }
  };

  return (
    <GameShell
      id="visual-memory"
      route="/games/visual-memory"
      accent="sky"
      formatBest={(best) => `level ${best}`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Start the test"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            Squares flash. Tap them all back.
          </p>
          <p>
            Every level adds another square, and the grid itself grows every third level. Three
            wrong taps and the run ends.
          </p>
        </>
      }
      hud={
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Level" value={level} tone="sky" />
          <Stat label="Squares" value={pattern.length} tone="grape" />
          <Stat label="Lives" value={"❤️".repeat(Math.max(0, lives)) || "—"} tone="cherry" />
        </div>
      }
    >
      <Card className={cn("p-4", wrong.length > 0 && stage === "guessing" && "do-shake")}>
        <div
          className="mx-auto grid w-full max-w-md gap-2"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          role="group"
          aria-label={stage === "showing" ? "Memorise the pattern" : "Tap the squares you saw"}
        >
          {Array.from({ length: tiles }, (_, index) => {
            const revealed = stage === "showing" && pattern.includes(index);
            const isFound = found.includes(index);
            const isWrong = wrong.includes(index);
            return (
              <button
                key={index}
                type="button"
                onClick={() => tap(index)}
                disabled={stage !== "guessing"}
                aria-label={`Square ${index + 1}`}
                className={cn(
                  "aspect-square rounded-xl border-2 transition-all duration-200",
                  revealed || isFound
                    ? "scale-[1.04] border-transparent bg-[var(--sky)]"
                    : isWrong
                      ? "border-transparent bg-[var(--cherry)]"
                      : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)]",
                  stage === "guessing" && "cursor-pointer",
                )}
              />
            );
          })}
        </div>
      </Card>
      <p className="text-center text-sm font-extrabold text-[var(--muted)]" role="status">
        {stage === "showing"
          ? "Memorise the pattern…"
          : `Found ${found.length} of ${pattern.length}`}
      </p>
    </GameShell>
  );
}
