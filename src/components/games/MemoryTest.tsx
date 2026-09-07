"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Feedback";
import { ShareResult } from "./ShareResult";
import { ResultCard } from "./ResultCard";
import { saveBest, recordCompletion } from "@/lib/gamify";
import { useLocalValue } from "@/lib/utils/use-local";
import { STORAGE_KEYS } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

type Phase = "idle" | "showing" | "input" | "wrong" | "gameover";

const TILES = 9;
const TILE_COLORS = [
  "var(--grass)", "var(--sky)", "var(--grape)",
  "var(--fire)", "var(--sun)", "var(--cherry)",
  "var(--sky)", "var(--grape)", "var(--grass)",
];

export function MemoryTest() {
  const [sequence, setSequence] = React.useState<number[]>([]);
  const [step, setStep] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [lit, setLit] = React.useState<number | null>(null);
  const best = useLocalValue<number | null>(STORAGE_KEYS.best("memory-test"), null);
  const [isNewBest, setIsNewBest] = React.useState(false);

  const timers = React.useRef<number[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const playSequence = React.useCallback((seq: number[]) => {
    setPhase("showing");
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const speed = Math.max(320, 700 - seq.length * 25);

    seq.forEach((tile, i) => {
      timers.current.push(
        window.setTimeout(() => setLit(tile), i * speed + 250),
        window.setTimeout(() => setLit(null), i * speed + 250 + speed * 0.6),
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        setPhase("input");
        setStep(0);
      }, seq.length * speed + 300),
    );
  }, []);

  const nextLevel = React.useCallback(
    (current: number[]) => {
      const next = [...current, Math.floor(Math.random() * TILES)];
      setSequence(next);
      playSequence(next);
    },
    [playSequence],
  );

  const start = () => {
    setIsNewBest(false);
    track("game_start", { game: "memory-test" });
    nextLevel([]);
  };

  const press = (tile: number) => {
    if (phase !== "input") return;
    setLit(tile);
    window.setTimeout(() => setLit(null), 160);

    if (sequence[step] === tile) {
      if (step + 1 === sequence.length) {
        window.setTimeout(() => nextLevel(sequence), 620);
      } else {
        setStep(step + 1);
      }
    } else {
      const reached = sequence.length - 1;
      setIsNewBest(saveBest("memory-test", reached));
      if (reached > 0) recordCompletion(10);
      track("game_complete", { game: "memory-test", level: reached });
      setPhase("wrong");
      window.setTimeout(() => setPhase("gameover"), 700);
    }
  };

  const level = sequence.length;

  if (phase === "gameover") {
    const reached = level - 1;
    return (
      <div className="space-y-4">
        <ResultCard
          headline="You reached"
          primary={reached}
          primaryLabel={reached === 1 ? "step" : "steps"}
          badge={isNewBest ? "🎉 New personal best!" : undefined}
          accent="grape"
          celebrateOnMount={isNewBest}
          secondary={
            <p className="text-sm font-semibold text-[var(--muted)]">
              Most people manage between 7 and 9 steps.
            </p>
          }
        >
          <div className="space-y-4">
            <ShareResult
              gameId="memory-test"
              text={`I remembered a ${reached}-step sequence on DO101. How far can you get?`}
              url="/games/memory-test"
            />
            <Button
              tone="grass"
              onClick={() => {
                setSequence([]);
                setPhase("idle");
                start();
              }}
            >
              Play again
            </Button>
          </div>
        </ResultCard>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="This run" value={reached} tone="grape" />
          <Stat label="Your record" value={best ?? "—"} tone="sun" hint="on this device" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Level" value={level || "—"} tone="grape" />
        <Stat
          label="Status"
          value={
            phase === "showing" ? "Watch" : phase === "input" ? "Your turn" : phase === "wrong" ? "Wrong!" : "Ready"
          }
          tone={phase === "wrong" ? "cherry" : "sky"}
        />
        <Stat label="Your record" value={best ?? "—"} tone="sun" hint="on this device" />
      </div>

      <div
        className={cn(
          "mx-auto grid max-w-sm grid-cols-3 gap-3",
          phase === "wrong" && "do-shake",
        )}
        role="group"
        aria-label="Memory tiles"
      >
        {Array.from({ length: TILES }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => press(i)}
            disabled={phase !== "input"}
            aria-label={`Tile ${i + 1}`}
            className={cn(
              "aspect-square rounded-2xl border-2 border-[var(--border)] transition-all duration-150",
              phase === "input" ? "cursor-pointer hover:scale-[1.03]" : "cursor-default",
              lit === i ? "scale-105 border-transparent" : "bg-[var(--panel)]",
            )}
            style={lit === i ? { background: TILE_COLORS[i] } : undefined}
          />
        ))}
      </div>

      <p className="text-center text-sm font-extrabold text-[var(--muted)]" role="status">
        {phase === "idle"
          ? "Watch the sequence, then repeat it. Each level adds one step."
          : phase === "showing"
            ? "Watch carefully…"
            : phase === "input"
              ? `Repeat the sequence — ${step} of ${sequence.length} done`
              : "Not quite!"}
      </p>

      {phase === "idle" ? (
        <div className="flex justify-center">
          <Button tone="grape" size="lg" onClick={start}>
            Start
          </Button>
        </div>
      ) : null}
    </div>
  );
}
