"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Stat, Progress } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { cn } from "@/lib/utils/cn";

const COLORS = [
  { name: "RED", hex: "#ff4b4b" },
  { name: "GREEN", hex: "#4cc93f" },
  { name: "BLUE", hex: "#22b8f0" },
  { name: "PURPLE", hex: "#b45cff" },
  { name: "ORANGE", hex: "#ff8a00" },
  { name: "YELLOW", hex: "#e0a800" },
];

const DURATION = 45;

interface Round {
  word: string;
  ink: string;
  matches: boolean;
}

/** Half the rounds match, so guessing one way scores no better than chance. */
function makeRound(): Round {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)];
  const matches = Math.random() < 0.5;
  const ink = matches
    ? word
    : COLORS.filter((c) => c.name !== word.name)[Math.floor(Math.random() * (COLORS.length - 1))];
  return { word: word.name, ink: ink.hex, matches };
}

export function ColorMatch() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [round, setRound] = React.useState<Round>(() => makeRound());
  const [correct, setCorrect] = React.useState(0);
  const [wrong, setWrong] = React.useState(0);
  const [remaining, setRemaining] = React.useState(DURATION);
  const [flash, setFlash] = React.useState<"right" | "wrong" | null>(null);

  const startedAt = React.useRef(0);
  const scoreRef = React.useRef({ correct: 0, wrong: 0 });
  const times = React.useRef<number[]>([]);
  const shownAt = React.useRef(0);

  const finish = React.useCallback(() => {
    const { correct: right, wrong: missed } = scoreRef.current;
    const total = right + missed;
    const accuracy = total ? (right / total) * 100 : 0;
    const average = times.current.length
      ? times.current.reduce((a, b) => a + b, 0) / times.current.length
      : 0;

    setResult({
      score: right,
      display: String(right),
      label: "correct answers",
      grade: right >= 60 ? "Exceptional" : right >= 45 ? "Very sharp" : right >= 30 ? "Solid" : "Keep practising",
      blurb: `${accuracy.toFixed(0)}% accuracy, ${Math.round(average)} ms per answer.`,
      stats: [
        { label: "Correct", value: right, tone: "grass" },
        { label: "Wrong", value: missed, tone: "cherry" },
        { label: "Accuracy", value: `${accuracy.toFixed(0)}%`, tone: "sky" },
        { label: "Avg answer", value: `${Math.round(average)} ms`, tone: "grape" },
      ],
      shareText: `I got ${right} right in the DO101 colour match test with ${accuracy.toFixed(0)}% accuracy. Your turn.`,
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
    scoreRef.current = { correct: 0, wrong: 0 };
    times.current = [];
    startedAt.current = performance.now();
    shownAt.current = performance.now();
    setCorrect(0);
    setWrong(0);
    setRemaining(DURATION);
    setRound(makeRound());
    setResult(null);
    setFlash(null);
    setPhase("playing");
  };

  const answer = (said: boolean) => {
    if (phase !== "playing") return;
    times.current.push(performance.now() - shownAt.current);

    if (said === round.matches) {
      scoreRef.current.correct += 1;
      setCorrect(scoreRef.current.correct);
      setFlash("right");
    } else {
      scoreRef.current.wrong += 1;
      setWrong(scoreRef.current.wrong);
      setFlash("wrong");
    }

    window.setTimeout(() => setFlash(null), 160);
    shownAt.current = performance.now();
    setRound(makeRound());
  };

  // Keyboard play is much faster than tapping, so both are supported.
  React.useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") answer(true);
      if (e.key === "ArrowRight") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <GameShell
      id="color-match"
      route="/games/color-match"
      accent="grape"
      formatBest={(best) => `${best} correct`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel={`Start the ${DURATION} second test`}
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            Does the <em>word</em> match the <em>colour it is printed in</em>?
          </p>
          <p>
            A classic Stroop test: reading is automatic, so your brain has to actively suppress the
            word to see the ink. Arrow keys work — left for match, right for no match.
          </p>
        </>
      }
      hud={
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Correct" value={correct} tone="grass" />
            <Stat label="Wrong" value={wrong} tone="cherry" />
            <Stat label="Time left" value={`${Math.ceil(remaining)}s`} tone="fire" />
          </div>
          <Progress className="mt-3" value={((DURATION - remaining) / DURATION) * 100} tone="grape" />
        </>
      }
    >
      <Card
        className={cn(
          "grid h-[34vh] min-h-[200px] place-items-center transition-colors",
          flash === "right" && "bg-[var(--grass-soft)]",
          flash === "wrong" && "bg-[var(--cherry-soft)]",
        )}
      >
        <p
          className="text-6xl font-extrabold tracking-tight sm:text-8xl"
          style={{ color: round.ink }}
          aria-label={`The word ${round.word}`}
        >
          {round.word}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button tone="grass" size="lg" onClick={() => answer(true)}>
          ✓ Match
        </Button>
        <Button tone="cherry" size="lg" onClick={() => answer(false)}>
          ✕ No match
        </Button>
      </div>
      <p className="text-center text-xs font-semibold text-[var(--muted)]">
        Keyboard: ← for match, → for no match
      </p>
    </GameShell>
  );
}
