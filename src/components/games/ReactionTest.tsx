"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Feedback";
import { ShareResult } from "./ShareResult";
import { ResultCard } from "./ResultCard";
import { saveBest, recordCompletion } from "@/lib/gamify";
import { useLocalValue } from "@/lib/utils/use-local";
import { STORAGE_KEYS } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";

type State = "idle" | "waiting" | "ready" | "tooSoon" | "clicked" | "finished";

const ROUNDS = 5;

function grade(ms: number): string {
  if (ms < 150) return "Lightning";
  if (ms < 200) return "Very fast";
  if (ms < 250) return "Fast";
  if (ms < 320) return "Average";
  return "Take another go";
}

export function ReactionTest() {
  const [state, setState] = React.useState<State>("idle");
  const [times, setTimes] = React.useState<number[]>([]);
  const [last, setLast] = React.useState<number | null>(null);
  const best = useLocalValue<number | null>(STORAGE_KEYS.best("reaction-test"), null);
  const [isNewBest, setIsNewBest] = React.useState(false);

  const greenAt = React.useRef(0);
  const timeoutRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const armRound = React.useCallback(() => {
    setState("waiting");
    const delay = 1200 + Math.random() * 3300;
    timeoutRef.current = window.setTimeout(() => {
      greenAt.current = performance.now();
      setState("ready");
    }, delay);
  }, []);

  const start = React.useCallback(() => {
    setTimes([]);
    setLast(null);
    setIsNewBest(false);
    track("game_start", { game: "reaction-test" });
    armRound();
  }, [armRound]);

  const handleHit = React.useCallback(() => {
    if (state === "idle" || state === "finished") {
      start();
      return;
    }
    if (state === "waiting") {
      window.clearTimeout(timeoutRef.current);
      setState("tooSoon");
      return;
    }
    if (state === "tooSoon") {
      armRound();
      return;
    }
    if (state === "ready") {
      const ms = Math.round(performance.now() - greenAt.current);
      setLast(ms);
      const next = [...times, ms];
      setTimes(next);
      if (next.length >= ROUNDS) {
        const average = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
        setIsNewBest(saveBest("reaction-test", average, false));
        recordCompletion(15);
        track("game_complete", { game: "reaction-test", average });
        setState("finished");
      } else {
        setState("clicked");
      }
      return;
    }
    if (state === "clicked") {
      armRound();
    }
  }, [state, times, armRound, start]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleHit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleHit]);

  const average = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;

  const panel = {
    idle: { bg: "var(--sky)", title: "Reaction time test", sub: "Click, tap or press space to start." },
    waiting: { bg: "var(--cherry)", title: "Wait for green…", sub: "Do not click yet." },
    ready: { bg: "var(--grass)", title: "CLICK!", sub: "Now!" },
    tooSoon: { bg: "var(--fire)", title: "Too soon!", sub: "You clicked before it turned green. Click to try again." },
    clicked: {
      bg: "var(--grape)",
      title: last !== null ? `${last} ms` : "",
      sub: `Round ${times.length} of ${ROUNDS} — click for the next one.`,
    },
    finished: { bg: "var(--grass)", title: "Done!", sub: "" },
  }[state];

  if (state === "finished") {
    return (
      <div className="space-y-4">
        <ResultCard
          headline="Average reaction time"
          primary={`${average}`}
          primaryLabel="milliseconds"
          badge={isNewBest ? "🎉 New personal best!" : grade(average)}
          accent="grass"
          celebrateOnMount={isNewBest}
          secondary={
            <p className="text-sm font-extrabold text-[var(--muted)]">
              {times.map((t) => `${t} ms`).join(" · ")}
            </p>
          }
        >
          <div className="space-y-4">
            <ShareResult
              gameId="reaction-test"
              text={`I got a ${average} ms average reaction time on DO101. Can you beat it?`}
              url="/games/reaction-test"
            />
            <Button tone="grass" onClick={start}>
              Try again
            </Button>
          </div>
        </ResultCard>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Fastest" value={`${Math.min(...times)} ms`} tone="grass" />
          <Stat label="Slowest" value={`${Math.max(...times)} ms`} tone="cherry" />
          <Stat
            label="Your record"
            value={best !== null ? `${best} ms` : "—"}
            tone="sun"
            hint="on this device"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleHit}
        aria-live="polite"
        className="flex h-72 w-full select-none flex-col items-center justify-center rounded-2xl border-2 border-[var(--border)] text-center transition-colors sm:h-96"
        style={{ background: panel.bg, color: "#fff" }}
      >
        <span className="px-6 text-4xl font-extrabold sm:text-6xl">{panel.title}</span>
        <span className="mt-3 px-6 text-base font-extrabold opacity-90">{panel.sub}</span>
      </button>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Round" value={`${Math.min(times.length + 1, ROUNDS)} / ${ROUNDS}`} />
        <Stat label="Average so far" value={times.length ? `${average} ms` : "—"} tone="sky" />
        <Stat
          label="Your record"
          value={best !== null ? `${best} ms` : "—"}
          tone="sun"
          hint="on this device"
        />
      </div>

      {times.length ? (
        <Card className="p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Rounds
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {times.map((t, i) => (
              <span
                key={i}
                className="rounded-xl bg-[var(--panel)] px-3 py-1.5 text-sm font-extrabold tabular-nums"
              >
                {t} ms
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <p className="text-xs font-semibold text-[var(--muted)]">
        Timing uses the browser&rsquo;s high-resolution clock. Your display adds a few milliseconds of
        its own, so compare results against your own history rather than other people&rsquo;s setups.
      </p>
    </div>
  );
}
