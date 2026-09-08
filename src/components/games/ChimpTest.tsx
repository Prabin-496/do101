"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { pickCells } from "@/lib/games/puzzles";
import { cn } from "@/lib/utils/cn";

type Stage = "showing" | "clicking" | "wrong";

const GRID = 6;
const LIVES = 3;
const START_COUNT = 4;

export function ChimpTest() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [stage, setStage] = React.useState<Stage>("showing");
  const [count, setCount] = React.useState(START_COUNT);
  const [lives, setLives] = React.useState(LIVES);
  const [cells, setCells] = React.useState<number[]>([]);
  const [next, setNext] = React.useState(0);

  const startRound = React.useCallback((howMany: number) => {
    setCells(pickCells(GRID, Math.min(howMany, GRID * GRID)));
    setNext(0);
    setStage("showing");
  }, []);

  const start = () => {
    setCount(START_COUNT);
    setLives(LIVES);
    setResult(null);
    setPhase("playing");
    startRound(START_COUNT);
  };

  const end = (reached: number) => {
    setResult({
      score: reached,
      display: String(reached),
      label: "numbers",
      grade: reached >= 15 ? "Remarkable" : reached >= 10 ? "Strong" : reached >= 7 ? "Solid" : "Keep going",
      blurb:
        "Chimpanzees trained on this task routinely beat humans — the numbers vanish the moment you start.",
      stats: [
        { label: "You reached", value: reached, tone: "fire" },
        { label: "Started at", value: START_COUNT, tone: "sky" },
      ],
      shareText: `I remembered ${reached} numbers on the DO101 chimp test. Think you can beat a chimp?`,
    });
    setPhase("done");
  };

  const tap = (index: number) => {
    if (stage === "wrong") return;

    // The numbers hide as soon as the first one is clicked — that is the test.
    if (stage === "showing") setStage("clicking");

    if (cells[next] === index) {
      const advanced = next + 1;
      setNext(advanced);
      if (advanced === cells.length) {
        const grown = count + 1;
        setCount(grown);
        window.setTimeout(() => startRound(grown), 420);
      }
      return;
    }

    setStage("wrong");
    const remaining = lives - 1;
    setLives(remaining);
    window.setTimeout(() => {
      if (remaining <= 0) end(count - 1);
      else startRound(count);
    }, 900);
  };

  return (
    <GameShell
      id="chimp-test"
      route="/games/chimp-test"
      accent="fire"
      formatBest={(best) => `${best} numbers`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Take the test"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            Click the numbers in order — but they disappear after the first click.
          </p>
          <p>
            Based on the Kyoto University experiment where young chimpanzees outperformed humans on
            exactly this task. Starts at {START_COUNT} numbers and adds one each round.
          </p>
        </>
      }
      hud={
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Numbers" value={count} tone="fire" />
          <Stat label="Next" value={next + 1} tone="grass" />
          <Stat label="Lives" value={"❤️".repeat(Math.max(0, lives)) || "—"} tone="cherry" />
        </div>
      }
    >
      <Card className={cn("p-4", stage === "wrong" && "do-shake")}>
        <div
          className="mx-auto grid w-full max-w-md gap-2"
          style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
          role="group"
          aria-label="Click the numbers in ascending order"
        >
          {Array.from({ length: GRID * GRID }, (_, index) => {
            const position = cells.indexOf(index);
            const isTile = position >= 0;
            const done = isTile && position < next;
            // Numbers are visible until the first click, then only the shape remains.
            const showNumber = isTile && !done && (stage === "showing" || stage === "wrong");

            return (
              <button
                key={index}
                type="button"
                onClick={() => isTile && tap(index)}
                disabled={!isTile || done}
                aria-label={isTile ? `Tile ${position + 1}` : "Empty"}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl text-xl font-extrabold transition-all",
                  !isTile && "opacity-0",
                  done && "opacity-0",
                  isTile && !done && "border-2 border-[var(--border)] bg-[var(--bg)] shadow-[0_2px_0_var(--border-strong)] hover:bg-[var(--panel)]",
                  stage === "wrong" && isTile && !done && "border-[var(--cherry)]",
                )}
              >
                {showNumber ? position + 1 : ""}
              </button>
            );
          })}
        </div>
      </Card>
      <p className="text-center text-sm font-extrabold text-[var(--muted)]" role="status">
        {stage === "showing"
          ? "Memorise the order, then click 1 to begin"
          : stage === "wrong"
            ? "Wrong one — watch again"
            : `Now click ${next + 1}`}
      </p>
    </GameShell>
  );
}
