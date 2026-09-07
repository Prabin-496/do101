"use client";

/**
 * Analytics abstraction. No provider ships by default, so DO101 sends
 * nothing unless a privacy-friendly script is configured later.
 * Events are queued on window so a provider can drain them if added.
 */
export type AnalyticsEvent =
  | "tool_open"
  | "tool_complete"
  | "game_start"
  | "game_complete"
  | "share_result"
  | "ai_request"
  | "search_used";

interface QueuedEvent {
  name: AnalyticsEvent;
  props?: Record<string, string | number | boolean>;
  at: number;
}

declare global {
  interface Window {
    __do101Events?: QueuedEvent[];
    plausible?: (name: string, opts?: { props?: Record<string, unknown> }) => void;
  }
}

export function track(
  name: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  const event: QueuedEvent = { name, props, at: Date.now() };
  window.__do101Events = [...(window.__do101Events ?? []).slice(-49), event];
  // Only forwarded when a consent-free, cookie-free provider is present.
  try {
    window.plausible?.(name, props ? { props } : undefined);
  } catch {
    /* never let analytics break a tool */
  }
}
