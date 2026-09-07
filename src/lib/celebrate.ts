"use client";

/**
 * Fires a short burst of confetti for a genuine win — a new personal best or a
 * won race, never just for finishing. Skipped entirely when the visitor has
 * asked for reduced motion, and loaded lazily so it costs nothing otherwise.
 */
export async function celebrate(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  try {
    const { default: confetti } = await import("canvas-confetti");
    const colors = ["#4CC93F", "#22B8F0", "#B45CFF", "#FF8A00", "#FFC800"];
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
    window.setTimeout(
      () => confetti({ particleCount: 40, spread: 100, origin: { y: 0.6 }, colors, disableForReducedMotion: true }),
      180,
    );
  } catch {
    /* confetti is decoration — never let it break a result screen */
  }
}
