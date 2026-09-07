"use client";

import { useSyncExternalStore } from "react";

/**
 * Reads DO101's localStorage as an external store.
 *
 * Server and the first client render both see the fallback, so hydration always
 * matches; the stored value arrives immediately afterwards. Every component
 * reading a key re-renders when any DO101 code writes it, which is why a new
 * personal best updates the badge in the header without a page reload.
 */
const PREFIX = "do101:";

const cache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(onChange: () => void): () => void {
  window.addEventListener("do101:storage", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("do101:storage", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Snapshots must be referentially stable, so parsed values are cached per key. */
function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  try {
    const value = JSON.parse(raw) as T;
    cache.set(key, { raw, value });
    return value;
  } catch {
    return fallback;
  }
}

export function useLocalValue<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => snapshot<T>(key, fallback),
    () => fallback,
  );
}

const noopSubscribe = () => () => {};

/**
 * True only after hydration. Used where the first paint must match the server
 * but the real answer depends on the browser.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Whether this browser can open the native share sheet. */
export function useCanShare(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}
