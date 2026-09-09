"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Stat, Progress } from "@/components/ui/Feedback";
import { ShareResult } from "./ShareResult";
import { ResultCard } from "./ResultCard";
import {
  computeTypingStats,
  generateTypingText,
  typingGrade,
  TYPING_DURATIONS,
  type TypingStats,
} from "@/lib/games/typing";
import {
  TYPING_LANGUAGES, convertInput, getLanguage, type TypingLanguage,
} from "@/lib/games/languages";
import { writeLocal } from "@/lib/utils/storage";
import { saveBest, recordCompletion } from "@/lib/gamify";
import { useLocalValue } from "@/lib/utils/use-local";
import { STORAGE_KEYS } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";

type Phase = "idle" | "running" | "done";

const LANGUAGE_KEY = "typing-language";

export function TypingTest() {
  const router = useRouter();
  const storedLanguage = useLocalValue<string>(LANGUAGE_KEY, "en");
  const language = getLanguage(storedLanguage);
  const [duration, setDuration] = React.useState<number>(30);
  const [text, setText] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [remainingRaw, setRemaining] = React.useState(duration);
  const [stats, setStats] = React.useState<TypingStats | null>(null);
  const bestId = language.id === "en" ? "typing-test" : `typing-test-${language.id}`;
  const best = useLocalValue<number | null>(STORAGE_KEYS.best(bestId), null);
  const [isNewBest, setIsNewBest] = React.useState(false);

  const startedAt = React.useRef<number>(0);
  const typedRef = React.useRef("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const caretRef = React.useRef<HTMLSpanElement>(null);

  // The prompt is random, so it can only be produced in the browser: the server
  // and the first client render must agree, and they agree on "empty".
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only randomness
  React.useEffect(() => setText(generateTypingText(70, undefined, language.words)), [language]);

  const finish = React.useCallback(
    (finalTyped: string, elapsed: number) => {
      const result = computeTypingStats(text, finalTyped, elapsed);
      setStats(result);
      setPhase("done");
      const headline = language.metric === "cpm" ? result.cpm : result.wpm;
      setIsNewBest(saveBest(bestId, Math.round(headline)));
      recordCompletion(15);
      track("game_complete", {
        game: "typing-test",
        language: language.id,
        wpm: Math.round(result.wpm),
        accuracy: Math.round(result.accuracy),
        duration,
      });
    },
    [text, duration, language, bestId],
  );

  // Countdown
  React.useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        finish(typedRef.current, duration);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, duration, finish]);

  // Before the first keystroke the clock simply shows the chosen duration.
  const remaining = phase === "idle" ? duration : remainingRaw;

  const converted = React.useMemo(() => convertInput(typed, language), [typed, language]);

  // Live stats while typing
  const liveStats = React.useMemo(() => {
    if (phase !== "running") return null;
    const elapsed = Math.max(0.5, (duration - remaining));
    return computeTypingStats(text, converted.compare, elapsed);
  }, [phase, converted, text, duration, remaining]);

  React.useEffect(() => {
    typedRef.current = converted.compare;
  }, [converted]);

  React.useEffect(() => {
    caretRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [converted.compare.length]);

  const onChange = (value: string) => {
    if (phase === "done") return;
    if (phase === "idle") {
      startedAt.current = Date.now();
      setPhase("running");
      track("game_start", { game: "typing-test", duration });
    }
    const next = convertInput(value, language);
    if (next.compare.length > text.length) return;
    setTyped(value);
    if (next.compare.length === text.length) {
      finish(next.compare, (Date.now() - startedAt.current) / 1000);
    }
  };

  const restart = (newDuration = duration) => {
    setDuration(newDuration);
    setText(generateTypingText(70, undefined, language.words));
    setTyped("");
    setStats(null);
    setPhase("idle");
    setRemaining(newDuration);
    setIsNewBest(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const metricLabel = language.metric === "cpm" ? "CPM" : "WPM";

  function changeLanguage(next: TypingLanguage) {
    if (next.id === language.id) return;
    writeLocal(LANGUAGE_KEY, next.id);
    setText(generateTypingText(70, undefined, next.words));
    setTyped("");
    setStats(null);
    setPhase("idle");
    setRemaining(duration);
    setIsNewBest(false);
  }

  // The grade bands were calibrated on English words per minute, so they are
  // only shown where that is what is being measured.
  const grade = stats && language.metric === "wpm" ? typingGrade(stats.wpm) : null;

  if (phase === "done" && stats) {
    return (
      <div className="space-y-4">
        <ResultCard
          headline="Your result"
          primary={Math.round(language.metric === "cpm" ? stats.cpm : stats.wpm)}
          primaryLabel={language.metric === "cpm" ? "Characters per minute" : "Words per minute"}
          badge={isNewBest ? "🎉 New personal best!" : grade?.label}
          accent="cherry"
          celebrateOnMount={isNewBest}
          secondary={
            <p className="text-lg font-extrabold">
              {stats.accuracy.toFixed(1)}% accuracy · {stats.incorrectChars} error
              {stats.incorrectChars === 1 ? "" : "s"}
            </p>
          }
        >
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[var(--muted)]">{grade?.blurb}</p>
            <ShareResult
              gameId="typing-test"
              text={`I scored ${Math.round(language.metric === "cpm" ? stats.cpm : stats.wpm)} ${metricLabel} in ${language.name} with ${stats.accuracy.toFixed(0)}% accuracy on DO101. Can you beat me?`}
              url="/games/typing-test"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Button tone="grass" onClick={() => restart()}>
                Try again
              </Button>
              <Button tone="panel" onClick={() => router.push("/games/typing-battle")}>
                ⚔️ Challenge a friend
              </Button>
            </div>
          </div>
        </ResultCard>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Raw WPM" value={Math.round(stats.rawWpm)} tone="sky" />
          <Stat label="CPM" value={Math.round(stats.cpm)} tone="grape" />
          <Stat label="Correct chars" value={stats.correctChars} tone="grass" />
          <Stat label="Wrong chars" value={stats.incorrectChars} tone="cherry" />
        </div>

        {best !== null ? (
          <p className="text-center text-sm font-extrabold text-[var(--muted)]">
            🏆 Personal best in {language.name} on this device: {best} {metricLabel}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="do-scroll flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Language">
        {TYPING_LANGUAGES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === language.id}
            onClick={() => changeLanguage(option)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition",
              option.id === language.id
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]",
            )}
          >
            <span aria-hidden>{option.flag}</span>
            <span lang={option.id}>{option.native}</span>
          </button>
        ))}
      </div>

      {language.requirement ? (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-[var(--sky)] bg-[var(--sky-soft)] px-4 py-2.5 text-sm font-semibold">
          <span aria-hidden>⌨️</span>
          {language.requirement}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          ariaLabel="Test duration"
          value={String(duration)}
          onChange={(v) => restart(Number(v))}
          items={TYPING_DURATIONS.map((d) => ({ id: String(d), label: `${d}s` }))}
        />
        {best !== null ? (
          <span className="rounded-xl bg-[var(--sun-soft)] px-3 py-2 text-sm font-extrabold">
            🏆 Best {best} {metricLabel}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Time left"
          value={`${Math.ceil(remaining)}s`}
          tone={remaining < 6 && phase === "running" ? "cherry" : "fire"}
        />
        <Stat
          label={metricLabel}
          value={liveStats ? Math.round(language.metric === "cpm" ? liveStats.cpm : liveStats.wpm) : 0}
          tone="grass"
        />
        <Stat
          label="Accuracy"
          value={`${liveStats ? liveStats.accuracy.toFixed(0) : 100}%`}
          tone="sky"
        />
      </div>

      <Progress
        value={phase === "running" ? ((duration - remaining) / duration) * 100 : 0}
        tone="cherry"
      />

      <Card
        className="relative cursor-text p-5 sm:p-7"
        onClick={() => inputRef.current?.focus()}
      >
        <p
          className={cn(
            "do-scroll max-h-64 overflow-y-auto break-words text-lg leading-relaxed tracking-wide sm:text-xl",
            language.script === "latin" ? "font-mono" : "font-bold",
          )}
          dir={language.direction}
          lang={language.id}
          aria-hidden
        >
          {text.split("").map((char, i) => {
            const isTyped = i < converted.compare.length;
            const correct = isTyped && converted.compare[i] === char;
            const isCaret = i === converted.compare.length;
            return (
              <span
                key={i}
                ref={isCaret ? caretRef : undefined}
                className={cn(
                  "relative",
                  isTyped
                    ? correct
                      ? "text-[var(--grass)]"
                      : "rounded bg-[var(--cherry-soft)] text-[var(--cherry)] underline decoration-wavy"
                    : "text-[var(--muted)]",
                  isCaret &&
                    "before:absolute before:-left-0.5 before:top-0 before:h-full before:w-0.5 before:animate-pulse before:bg-[var(--sky)] before:content-['']",
                )}
              >
                {char}
              </span>
            );
          })}
        </p>

        <label htmlFor="typing-input" className="sr-only">
          Type the text shown above
        </label>
        <textarea
          id="typing-input"
          ref={inputRef}
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          dir={language.input === "romaji-to-kana" ? "ltr" : language.direction}
          className="absolute inset-0 h-full w-full cursor-text resize-none rounded-2xl bg-transparent p-5 font-mono text-lg leading-relaxed tracking-wide text-transparent caret-transparent outline-none sm:p-7 sm:text-xl"
        />

        {language.input === "romaji-to-kana" && converted.pending ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm font-extrabold">
            <span className="rounded-lg bg-[var(--sun-soft)] px-2 py-1 font-mono lowercase">
              {converted.pending}
            </span>
            <span className="ml-2 text-[var(--muted)]">…finishing this syllable</span>
          </p>
        ) : phase === "idle" ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm font-extrabold text-[var(--muted)]">
            {language.input === "romaji-to-kana"
              ? "Type romaji — it turns into kana as you go"
              : "Start typing — the timer begins on your first keystroke"}
          </p>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button tone="grass" onClick={() => inputRef.current?.focus()}>
          {phase === "running" ? "Keep typing" : "Start typing"}
        </Button>
        <Button tone="ghost" onClick={() => restart()}>
          New text
        </Button>
      </div>

      <p className="text-xs font-semibold text-[var(--muted)]">
        On a phone? Tap the text box to bring up the keyboard. Autocorrect is switched off so your
        accuracy is measured fairly.{" "}
        {language.input === "romaji-to-kana"
          ? "Japanese is typed as romaji and converted to kana here, so no IME is needed — and a half-finished syllable never counts as a mistake."
          : "Personal bests are kept separately for each language."}
      </p>
    </div>
  );
}
