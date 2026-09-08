"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import {
  newGame,
  move,
  addRandomTile,
  canMove,
  highestTile,
  hasWon,
  tileStyle,
  SIZE,
  type Board,
  type Direction,
} from "@/lib/games/2048";
import { cn } from "@/lib/utils/cn";

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export function Game2048() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [board, setBoard] = React.useState<Board>(() => newGame());
  const [score, setScore] = React.useState(0);
  const [won, setWon] = React.useState(false);
  const [keepGoing, setKeepGoing] = React.useState(false);

  const boardRef = React.useRef(board);
  const scoreRef = React.useRef(0);
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const end = React.useCallback((finalBoard: Board, finalScore: number) => {
    const best = highestTile(finalBoard);
    setResult({
      score: finalScore,
      display: finalScore.toLocaleString(),
      label: "points",
      grade:
        best >= 2048 ? "You made 2048!" : best >= 1024 ? "So close" : best >= 512 ? "Strong run" : "Keep going",
      blurb: `Your highest tile was ${best}.`,
      stats: [
        { label: "Highest tile", value: best, tone: "grape" },
        { label: "Score", value: finalScore.toLocaleString(), tone: "grass" },
      ],
      shareText: `I scored ${finalScore.toLocaleString()} with a ${best} tile on DO101's 2048. Beat that?`,
    });
    setPhase("done");
  }, []);

  const push = React.useCallback(
    (direction: Direction) => {
      const current = boardRef.current;
      const outcome = move(current, direction);
      if (!outcome.moved) return;

      const withTile = addRandomTile(outcome.board);
      const nextScore = scoreRef.current + outcome.gained;

      scoreRef.current = nextScore;
      boardRef.current = withTile;
      setBoard(withTile);
      setScore(nextScore);

      if (hasWon(withTile) && !won) setWon(true);
      if (!canMove(withTile)) end(withTile, nextScore);
    },
    [won, end],
  );

  React.useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (event: KeyboardEvent) => {
      const direction = KEYS[event.key];
      if (!direction) return;
      event.preventDefault();
      push(direction);
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, push]);

  const start = () => {
    const fresh = newGame();
    boardRef.current = fresh;
    scoreRef.current = 0;
    setBoard(fresh);
    setScore(0);
    setWon(false);
    setKeepGoing(false);
    setResult(null);
    setPhase("playing");
  };

  /** A swipe counts once it clears 30 px, in whichever axis moved most. */
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;

    push(
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up",
    );
  };

  return (
    <GameShell
      id="2048"
      route="/games/2048"
      accent="grape"
      formatBest={(best) => `${best.toLocaleString()} points`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Start a new game"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            Slide the tiles. Equal numbers merge. Reach 2048.
          </p>
          <p>
            Arrow keys or WASD on a keyboard, swipe on a phone. A tile that has just merged cannot
            merge again in the same move — which is what makes the endgame hard.
          </p>
        </>
      }
      hud={
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Score" value={score.toLocaleString()} tone="grape" />
          <Stat label="Highest tile" value={highestTile(board)} tone="grass" />
          <Stat label="Moves left" value={canMove(board) ? "yes" : "none"} tone="sky" />
        </div>
      }
    >
      {won && !keepGoing ? (
        <Card className="do-pop bg-[var(--grass-soft)] p-5 text-center">
          <p className="text-2xl font-extrabold">🎉 You reached 2048!</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button tone="grass" onClick={() => setKeepGoing(true)}>
              Keep going for a higher score
            </Button>
            <Button tone="panel" onClick={() => end(board, score)}>
              Finish here
            </Button>
          </div>
        </Card>
      ) : null}

      <Card
        className="select-none p-3 sm:p-4"
        onTouchStart={(e) =>
          (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })
        }
        onTouchEnd={onTouchEnd}
      >
        <div
          className="mx-auto grid w-full max-w-md gap-2 rounded-2xl bg-[var(--panel2)] p-2"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
          role="grid"
          aria-label={`2048 board, score ${score}`}
        >
          {board.flat().map((value, index) => {
            const style = tileStyle(value);
            return (
              <div
                key={index}
                role="gridcell"
                aria-label={value ? String(value) : "empty"}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl font-extrabold tabular-nums transition-all duration-100",
                  value ? "do-pop shadow-[0_2px_0_rgba(0,0,0,.12)]" : "",
                  // Long numbers need to shrink or they overflow the tile.
                  value >= 1024 ? "text-xl sm:text-2xl" : value >= 128 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
                )}
                style={{
                  background: value ? style.bg : "var(--panel)",
                  color: style.fg,
                }}
              >
                {value || ""}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mx-auto grid max-w-[220px] grid-cols-3 gap-2 sm:hidden">
        <span />
        <Button tone="panel" aria-label="Up" onClick={() => push("up")}>
          ↑
        </Button>
        <span />
        <Button tone="panel" aria-label="Left" onClick={() => push("left")}>
          ←
        </Button>
        <Button tone="panel" aria-label="Down" onClick={() => push("down")}>
          ↓
        </Button>
        <Button tone="panel" aria-label="Right" onClick={() => push("right")}>
          →
        </Button>
      </div>

      <p className="text-center text-xs font-semibold text-[var(--muted)]">
        Arrow keys, WASD, swipe, or the buttons above.
      </p>
    </GameShell>
  );
}
