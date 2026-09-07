"use client";

import { levelFromXp } from "@/lib/gamify";
import { useLocalValue } from "@/lib/utils/use-local";
import { STORAGE_KEYS } from "@/lib/utils/storage";
import type { StreakState } from "@/lib/gamify";

/** Shows only what this device has actually earned. Hidden until there is something real to show. */
export function StreakBadge() {
  const xp = useLocalValue<number>(STORAGE_KEYS.xp, 0);
  const streak = useLocalValue<StreakState>(STORAGE_KEYS.streak, {
    lastActive: "",
    current: 0,
    best: 0,
  });

  if (streak.current === 0 && xp === 0) return null;
  const { level } = levelFromXp(xp);

  return (
    <div className="flex items-center gap-2">
      {streak.current > 0 ? (
        <span
          title={`${streak.current} day streak on this device`}
          className="flex items-center gap-1 rounded-xl bg-[var(--fire-soft)] px-2.5 py-1.5 text-sm font-extrabold text-[var(--fire-dark)] dark:text-[var(--fire)]"
        >
          <span aria-hidden>🔥</span>
          {streak.current}
          <span className="sr-only">day streak</span>
        </span>
      ) : null}
      {xp > 0 ? (
        <span
          title={`${xp} XP earned on this device — level ${level}`}
          className="hidden items-center gap-1 rounded-xl bg-[var(--sun-soft)] px-2.5 py-1.5 text-sm font-extrabold text-[var(--sun-dark)] dark:text-[var(--sun)] sm:flex"
        >
          <span aria-hidden>⭐</span>
          {xp}
          <span className="sr-only">XP</span>
        </span>
      ) : null}
    </div>
  );
}
