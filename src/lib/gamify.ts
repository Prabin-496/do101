"use client";

import { readLocal, writeLocal, STORAGE_KEYS } from "./utils/storage";

/**
 * A light, honest progress layer: XP and streaks are computed from what YOU
 * actually did on this device and stored only in your own browser. Nothing is
 * sent anywhere and no number is invented.
 */

export interface StreakState {
  /** ISO date (YYYY-MM-DD) of the last active day. */
  lastActive: string;
  current: number;
  best: number;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterday(): string {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getXp(): number {
  return readLocal<number>(STORAGE_KEYS.xp, 0);
}

export function addXp(amount: number): number {
  const next = Math.max(0, getXp() + amount);
  writeLocal(STORAGE_KEYS.xp, next);
  return next;
}

export function getStreak(): StreakState {
  return readLocal<StreakState>(STORAGE_KEYS.streak, {
    lastActive: "",
    current: 0,
    best: 0,
  });
}

/** Called when the visitor actually completes something. */
export function touchStreak(): StreakState {
  const state = getStreak();
  const t = today();
  if (state.lastActive === t) return state;

  const current = state.lastActive === yesterday() ? state.current + 1 : 1;
  const next: StreakState = {
    lastActive: t,
    current,
    best: Math.max(current, state.best),
  };
  writeLocal(STORAGE_KEYS.streak, next);
  return next;
}

/** XP thresholds are flat and simple: 100 XP per level. */
export function levelFromXp(xp: number) {
  const level = Math.floor(xp / 100) + 1;
  const into = xp % 100;
  return { level, into, toNext: 100 - into, progress: into };
}

export function recordCompletion(xp = 10): void {
  addXp(xp);
  touchStreak();
}

/** Personal bests, per tool, stored locally. Returns true when improved. */
export function saveBest(toolId: string, value: number, higherIsBetter = true): boolean {
  const key = STORAGE_KEYS.best(toolId);
  const previous = readLocal<number | null>(key, null);
  const improved =
    previous === null || (higherIsBetter ? value > previous : value < previous);
  if (improved) writeLocal(key, value);
  return improved;
}

export function getBest(toolId: string): number | null {
  return readLocal<number | null>(STORAGE_KEYS.best(toolId), null);
}
