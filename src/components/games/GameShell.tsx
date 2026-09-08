"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Feedback";
import { ShareResult } from "./ShareResult";
import { ResultCard } from "./ResultCard";
import { saveBest, recordCompletion } from "@/lib/gamify";
import { useLocalValue } from "@/lib/utils/use-local";
import { STORAGE_KEYS } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

export type GamePhase = "idle" | "playing" | "done";

export interface GameResult {
  /** The number stored as the personal best and shared. */
  score: number;
  /** How the score reads, e.g. "412 ms" or "18 levels". */
  display: string;
  label: string;
  /** Short verdict shown as a badge, e.g. "Very fast". */
  grade?: string;
  blurb?: string;
  /** Secondary numbers shown under the result. */
  stats?: Array<{ label: string; value: React.ReactNode; tone?: "grass" | "sky" | "cherry" | "fire" | "grape" }>;
  /** The sentence people paste into a chat. */
  shareText: string;
}

interface GameShellProps {
  id: string;
  route: string;
  accent?: "cherry" | "grass" | "sky" | "grape" | "fire";
  /** Lower scores win — reaction times, solve times. */
  lowerIsBetter?: boolean;
  /** How the personal best reads, e.g. "412 ms". */
  formatBest?: (best: number) => string;
  phase: GamePhase;
  result: GameResult | null;
  onStart: () => void;
  onRestart: () => void;
  startLabel?: string;
  /** Rules, shown before the first play. */
  intro: React.ReactNode;
  /** Live readouts shown above the board while playing. */
  hud?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The frame every DO101 game shares: how it starts, how the score is shown,
 * how a personal best is recorded and how a result gets shared.
 *
 * Keeping it in one place means a new game is only its own rules, and every
 * game feels the same to play — which is most of what makes a set of small
 * games feel like a product rather than a folder of experiments.
 */
export function GameShell({
  id,
  route,
  accent = "cherry",
  lowerIsBetter = false,
  formatBest,
  phase,
  result,
  onStart,
  onRestart,
  startLabel = "Start",
  intro,
  hud,
  children,
}: GameShellProps) {
  const best = useLocalValue<number | null>(STORAGE_KEYS.best(id), null);
  const [isNewBest, setIsNewBest] = React.useState(false);
  const recorded = React.useRef<GameResult | null>(null);

  // Record the score once per completed round, not on every re-render.
  React.useEffect(() => {
    if (phase !== "done" || !result || recorded.current === result) return;
    recorded.current = result;
    setIsNewBest(saveBest(id, result.score, !lowerIsBetter));
    recordCompletion(12);
    track("game_complete", { game: id, score: result.score });
  }, [phase, result, id, lowerIsBetter]);

  const start = () => {
    recorded.current = null;
    setIsNewBest(false);
    track("game_start", { game: id });
    onStart();
  };

  const bestLabel = best === null ? null : (formatBest?.(best) ?? String(best));

  if (phase === "done" && result) {
    return (
      <div className="space-y-4">
        <ResultCard
          headline="Your result"
          primary={result.display}
          primaryLabel={result.label}
          badge={isNewBest ? "🎉 New personal best!" : result.grade}
          accent={accent}
          celebrateOnMount={isNewBest}
          secondary={
            result.blurb ? (
              <p className="text-sm font-semibold text-[var(--muted)]">{result.blurb}</p>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <ShareResult gameId={id} text={result.shareText} url={route} />
            <Button
              tone="grass"
              size="lg"
              onClick={() => {
                recorded.current = null;
                setIsNewBest(false);
                onRestart();
              }}
            >
              Play again
            </Button>
          </div>
        </ResultCard>

        {result.stats?.length ? (
          <div
            className={cn(
              "grid gap-3",
              result.stats.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
            )}
          >
            {result.stats.map((stat) => (
              <Stat key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
            ))}
          </div>
        ) : null}

        {bestLabel ? (
          <p className="text-center text-sm font-extrabold text-[var(--muted)]">
            🏆 Best on this device: {bestLabel}
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center sm:p-10">
          <div className="mx-auto max-w-md space-y-3 text-sm font-semibold text-[var(--muted)]">
            {intro}
          </div>
          <Button tone={accent} size="lg" className="mt-6" onClick={start}>
            {startLabel}
          </Button>
          {bestLabel ? (
            <p className="mt-4 text-sm font-extrabold text-[var(--muted)]">
              🏆 Your best: {bestLabel}
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hud ? <div>{hud}</div> : null}
      {children}
      <Button tone="ghost" onClick={onRestart}>
        Give up and restart
      </Button>
    </div>
  );
}
