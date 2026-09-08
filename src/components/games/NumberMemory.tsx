"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Stat, Progress } from "@/components/ui/Feedback";
import { GameShell, type GamePhase, type GameResult } from "./GameShell";
import { gradeLevel } from "@/lib/games/puzzles";

type Stage = "showing" | "typing" | "wrong";

const SHOW_MS_BASE = 1600;

export function NumberMemory() {
  const [phase, setPhase] = React.useState<GamePhase>("idle");
  const [result, setResult] = React.useState<GameResult | null>(null);
  const [stage, setStage] = React.useState<Stage>("showing");
  const [level, setLevel] = React.useState(1);
  const [number, setNumber] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [remaining, setRemaining] = React.useState(100);

  const inputRef = React.useRef<HTMLInputElement>(null);

  /** One extra digit per level; the display time grows with it. */
  const showMs = SHOW_MS_BASE + level * 260;

  const startLevel = React.useCallback((next: number) => {
    const digits = Array.from({ length: next }, () => Math.floor(Math.random() * 10)).join("");
    setNumber(digits);
    setAnswer("");
    setStage("showing");
    setRemaining(100);
  }, []);

  React.useEffect(() => {
    if (phase !== "playing" || stage !== "showing") return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const left = 100 - ((performance.now() - started) / showMs) * 100;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        setStage("typing");
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [phase, stage, showMs]);

  const start = () => {
    setLevel(1);
    setResult(null);
    setPhase("playing");
    startLevel(1);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (answer === number) {
      const next = level + 1;
      setLevel(next);
      startLevel(next);
      return;
    }

    setStage("wrong");
    window.setTimeout(() => {
      setResult({
        score: level - 1,
        display: String(level - 1),
        label: level - 1 === 1 ? "digit" : "digits",
        grade: gradeLevel(level - 1, 7),
        blurb: `The number was ${number} — you entered ${answer || "nothing"}.`,
        stats: [
          { label: "You reached", value: `${level - 1} digits`, tone: "grape" },
          { label: "Average person", value: "7 digits", tone: "sky" },
        ],
        shareText: `I remembered a ${level - 1}-digit number on DO101. How many can you hold?`,
      });
      setPhase("done");
    }, 900);
  };

  return (
    <GameShell
      id="number-memory"
      route="/games/number-memory"
      accent="grape"
      formatBest={(best) => `${best} digits`}
      phase={phase}
      result={result}
      onStart={start}
      onRestart={start}
      startLabel="Start remembering"
      intro={
        <>
          <p className="text-base font-extrabold text-[var(--ink)]">
            A number flashes up. Type it back.
          </p>
          <p>
            Each level adds one more digit. Most people manage about seven — the classic limit of
            short-term memory. Grouping the digits in pairs helps more than staring harder.
          </p>
        </>
      }
      hud={<Stat label="Digits" value={level} tone="grape" />}
    >
      {stage === "showing" ? (
        <Card className="grid h-[40vh] min-h-[240px] place-items-center bg-[var(--grape-soft)]">
          <div className="w-full px-6 text-center">
            <p className="break-all font-mono text-5xl font-extrabold tabular-nums sm:text-7xl">
              {number}
            </p>
            <Progress className="mt-8" value={remaining} tone="grape" />
          </div>
        </Card>
      ) : (
        <Card className={`grid h-[40vh] min-h-[240px] place-items-center ${stage === "wrong" ? "do-shake bg-[var(--cherry-soft)]" : ""}`}>
          <form onSubmit={submit} className="w-full max-w-sm px-6 text-center">
            <label htmlFor="number-answer" className="text-sm font-extrabold text-[var(--muted)]">
              {stage === "wrong" ? `It was ${number}` : "What was the number?"}
            </label>
            <Input
              id="number-answer"
              ref={inputRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="off"
              disabled={stage === "wrong"}
              className="mt-3 text-center font-mono text-3xl"
            />
            <Button type="submit" tone="grape" size="lg" className="mt-4 w-full" disabled={stage === "wrong"}>
              Submit
            </Button>
          </form>
        </Card>
      )}
    </GameShell>
  );
}
