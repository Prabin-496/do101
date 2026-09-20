"use client";

import { useSyncExternalStore } from "react";

/**
 * The wall clock, read the way React wants an external source read.
 *
 * A component cannot call `Date.now()` while rendering: the server renders at
 * one millisecond and the browser hydrates at another, and React reports the
 * difference as a hydration mismatch. Here the clock is a store instead — it
 * reads null until this browser subscribes, so the server render and the first
 * client render always agree, and the real time arrives immediately after.
 *
 * One timer is shared by every component using the hook, and it stops when the
 * last one unmounts.
 */

const TICK_MS = 1000;

let current = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (timer === null) {
    current = Date.now();
    timer = window.setInterval(() => {
      current = Date.now();
      for (const listener of listeners) listener();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/** Epoch milliseconds, or null until the browser has taken over. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => (current === 0 ? null : current),
    () => null,
  );
}
