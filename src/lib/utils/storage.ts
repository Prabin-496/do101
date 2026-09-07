"use client";

/**
 * localStorage helpers that never throw. Private-mode browsers, disabled
 * storage and quota errors all degrade to "no stored value".
 */
const PREFIX = "do101:";

export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("do101:storage", { detail: { key } }));
  } catch {
    /* storage unavailable — feature degrades silently */
  }
}

export function removeLocal(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
    window.dispatchEvent(new CustomEvent("do101:storage", { detail: { key } }));
  } catch {
    /* ignore */
  }
}

/** Wipes every DO101 key. Used by the "reset local data" control. */
export function clearAllLocal(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    window.dispatchEvent(new CustomEvent("do101:storage", { detail: { key: "*" } }));
  } catch {
    /* ignore */
  }
}

export const STORAGE_KEYS = {
  recent: "recent-tools",
  favorites: "favorite-tools",
  xp: "xp",
  streak: "streak",
  best: (id: string) => `best:${id}`,
} as const;
