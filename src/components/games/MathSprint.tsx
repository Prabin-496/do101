"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Stat, Progress } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { generateMathProblem, type MathProblem } from "@/lib/games/puzzles";
import { cn } from "@/lib/utils/cn";

const DURATION = 60;

export function MathSprint() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [problem, setProblem] = React.useState<MathProblem>(() => generateMathProblem(0));
  const [answer, setAnswer] = React.useState("");
  const [solved, setSolved] = React.useState(0);
  const [wrong, setWrong] = React.useState(0);
  const [remaining, setRemaining] = React.useState(DURATION);
  const [flash, setFlash] = React.useState<"right" | "wrong" | null>(null);

  const startedAt = React.useRef(0);
  const score = React.useRef({ solved: 0, wrong: 0 });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const finish = React.useCallback(() => {
    const { solved: right, wrong: missed } = score.current;
    const accuracy = right + missed ? (right / (right + missed)) * 100 : 0;

    setResult({
      score: right,
      display: String(right),
      label: "solved in 60 seconds",
      grade: right >= 45 ? "Lightning" : right >= 32 ? "Very quick" : right >= 22 ? "Solid" : "Keep practising",
      blurb: `${accuracy.toFixed(0)}% of your answers were right. The problems get harder as you go.`,
      stats: [
        { label: "Solved", value: right, tone: "grass" },
        { label: "Wrong", value: missed, tone: "cherry" },
        { label: "Per minute", value: right, tone: "sky" },
      ],
      shareText: `I solved ${right} maths problems in 60 seconds on DO101. Can you beat it?`,
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
    score.current = { solved: 0, wrong: 0 };
    startedAt.current = performance.now();
    setSolved(0);
    setWrong(0);
    setAnswer("");
    setRemaining(DURATION);
    setProblem(generateMathProblem(0));
    setResult(null);
    setPhase("playing");
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (phase !== "playing" || answer === "") return;

    if (Number(answer) === problem.answer) {
      score.current.solved += 1;
      setSolved(score.current.solved);
      setFlash("right");
      setProblem(generateMathProblem(score.current.solved));
    } else {
      score.current.wrong += 1;
      setWrong(score.current.wrong);
      setFlash("wrong");
    }

    setAnswer("");
    window.setTimeout(() => setFlash(null), 160);
  };

  return (
    <GameShell
      id="math-sprint"
      route="/games/math-sprint"
      accent="sky"
      formatBest={(best) => `${best} solved`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Start the 60 second sprint"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            Solve as many as you can in 60 seconds.
          </p>
          <p>
            Starts with addition and subtraction, then brings in multiplication and division as your
            streak grows. Every division works out to a whole number.
          </p>
        </>
      }
      hud={
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Solved" value={solved} tone="grass" />
            <Stat label="Wrong" value={wrong} tone="cherry" />
            <Stat label="Time left" value={`${Math.ceil(remaining)}s`} tone="fire" />
          </div>
          <Progress className="mt-3" value={((DURATION - remaining) / DURATION) * 100} tone="sky" />
        </>
      }
    >
      <Card
        className={cn(
          "grid min-h-[240px] place-items-center p-6 transition-colors",
          flash === "right" && "bg-[var(--grass-soft)]",
          flash === "wrong" && "bg-[var(--cherry-soft)]",
        )}
      >
        <form onSubmit={submit} className="w-full max-w-xs text-center">
          <p className="font-mono text-5xl font-extrabold tabular-nums sm:text-6xl">
            {problem.question}
          </p>
          <label htmlFor="math-answer" className="sr-only">
            Your answer
          </label>
          <Input
            id="math-answer"
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value.replace(/[^\d-]/g, ""))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="?"
            className="mt-6 text-center font-mono text-3xl"
          />
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
            Press Enter to submit
          </p>
        </form>
      </Card>
    </GameShell>
  );
}
