"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Stat, Progress } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { pickWord, scramble } from "@/lib/games/puzzles";
import { cn } from "@/lib/utils/cn";

const DURATION = 90;

export function WordScramble() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [word, setWord] = React.useState("");
  const [shuffled, setShuffled] = React.useState("");
  const [guess, setGuess] = React.useState("");
  const [solved, setSolved] = React.useState(0);
  const [skipped, setSkipped] = React.useState(0);
  const [remaining, setRemaining] = React.useState(DURATION);
  const [flash, setFlash] = React.useState<"right" | "wrong" | null>(null);

  const startedAt = React.useRef(0);
  const score = React.useRef({ solved: 0, skipped: 0 });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const nextWord = React.useCallback(() => {
    const chosen = pickWord();
    setWord(chosen);
    setShuffled(scramble(chosen));
    setGuess("");
  }, []);

  const finish = React.useCallback(() => {
    const { solved: right, skipped: passed } = score.current;
    setResult({
      score: right,
      display: String(right),
      label: right === 1 ? "word unscrambled" : "words unscrambled",
      grade: right >= 25 ? "Wordsmith" : right >= 18 ? "Very quick" : right >= 12 ? "Solid" : "Keep going",
      blurb: passed ? `You skipped ${passed}.` : "You did not skip a single one.",
      stats: [
        { label: "Solved", value: right, tone: "grass" },
        { label: "Skipped", value: passed, tone: "fire" },
        { label: "Per minute", value: Math.round((right / DURATION) * 60), tone: "sky" },
      ],
      shareText: `I unscrambled ${right} words in 90 seconds on DO101. Your turn.`,
    });
    setPhase("done");
  }, []);

  React.useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      const left = DURATION - (performance.now() - startedAt.current) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        finish();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  const start = () => {
    score.current = { solved: 0, skipped: 0 };
    startedAt.current = performance.now();
    setSolved(0);
    setSkipped(0);
    setRemaining(DURATION);
    setResult(null);
    nextWord();
    setPhase("playing");
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (phase !== "playing") return;

    if (guess.trim().toLowerCase() === word) {
      score.current.solved += 1;
      setSolved(score.current.solved);
      setFlash("right");
      nextWord();
    } else {
      setFlash("wrong");
      setGuess("");
    }
    window.setTimeout(() => setFlash(null), 160);
  };

  const skip = () => {
    score.current.skipped += 1;
    setSkipped(score.current.skipped);
    nextWord();
    inputRef.current?.focus();
  };

  return (
    <GameShell
      id="word-scramble"
      route="/games/word-scramble"
      accent="grass"
      formatBest={(best) => `${best} words`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Start the 90 second round"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            Unscramble as many words as you can in 90 seconds.
          </p>
          <p>
            Every word is six letters. Skipping is free but counts against you at the end — it is
            usually faster than staring at a hard one.
          </p>
        </>
      }
      hud={
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Solved" value={solved} tone="grass" />
            <Stat label="Skipped" value={skipped} tone="fire" />
            <Stat label="Time left" value={`${Math.ceil(remaining)}s`} tone="cherry" />
          </div>
          <Progress className="mt-3" value={((DURATION - remaining) / DURATION) * 100} tone="grass" />
        </>
      }
    >
      <Card
        className={cn(
          "grid min-h-[260px] place-items-center p-6 transition-colors",
          flash === "right" && "bg-[var(--grass-soft)]",
          flash === "wrong" && "do-shake bg-[var(--cherry-soft)]",
        )}
      >
        <form onSubmit={submit} className="w-full max-w-sm text-center">
          <div className="flex flex-wrap justify-center gap-2" aria-label={`Scrambled word: ${shuffled}`}>
            {[...shuffled].map((letter, i) => (
              <span
                key={`${letter}-${i}`}
                aria-hidden
                className="grid h-12 w-11 place-items-center rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] text-2xl font-extrabold uppercase shadow-[0_2px_0_var(--border-strong)]"
              >
                {letter}
              </span>
            ))}
          </div>

          <label htmlFor="scramble-answer" className="sr-only">
            Your answer
          </label>
          <Input
            id="scramble-answer"
            ref={inputRef}
            value={guess}
            onChange={(e) => setGuess(e.target.value.replace(/[^a-zA-Z]/g, ""))}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Type the word"
            className="mt-6 text-center text-2xl"
          />

          <div className="mt-3 flex gap-2">
            <Button type="submit" tone="grass" className="flex-1">
              Submit
            </Button>
            <Button type="button" tone="panel" onClick={skip}>
              Skip
            </Button>
          </div>
        </form>
      </Card>
    </GameShell>
  );
}
