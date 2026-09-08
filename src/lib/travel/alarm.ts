"use client";

/**
 * The alarm itself.
 *
 * Three channels are used together, because no single one is reliable
 * everywhere: vibration (absent on iOS Safari), a synthesised tone through the
 * Web Audio API (needs a prior user gesture, which pressing "start" provides),
 * and a visual takeover of the screen.
 *
 * The audio is generated rather than loaded from a file, so there is nothing to
 * download and the alarm still fires with no network at all.
 */

export interface AlarmCapabilities {
  vibration: boolean;
  audio: boolean;
  wakeLock: boolean;
  geolocation: boolean;
}

export function detectCapabilities(): AlarmCapabilities {
  if (typeof window === "undefined") {
    return { vibration: false, audio: false, wakeLock: false, geolocation: false };
  }
  return {
    vibration: typeof navigator.vibrate === "function",
    audio: typeof window.AudioContext !== "undefined",
    wakeLock: "wakeLock" in navigator,
    geolocation: "geolocation" in navigator,
  };
}

/** A repeating two-tone chime, loud and distinct from a notification ping. */
export class AlarmSound {
  private context: AudioContext | null = null;
  private timer: number | undefined;
  private running = false;

  /**
   * Must be called from a user gesture. Browsers start an AudioContext
   * suspended otherwise, and the alarm would silently fail when it mattered.
   */
  async prime(): Promise<boolean> {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") await this.context.resume();
      return this.context.state === "running";
    } catch {
      return false;
    }
  }

  private beep(frequency: number, startAt: number, duration: number) {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    // A short ramp avoids the click a hard start/stop produces.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.9, startAt + 0.02);
    gain.gain.setValueAtTime(0.9, startAt + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, startAt + duration);

    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }

  start() {
    if (this.running || !this.context) return;
    this.running = true;

    const cycle = () => {
      if (!this.running || !this.context) return;
      const now = this.context.currentTime;
      this.beep(880, now, 0.28);
      this.beep(660, now + 0.34, 0.28);
      this.beep(880, now + 0.68, 0.28);
      this.timer = window.setTimeout(cycle, 1600);
    };
    cycle();
  }

  stop() {
    this.running = false;
    window.clearTimeout(this.timer);
  }

  async close() {
    this.stop();
    await this.context?.close().catch(() => {});
    this.context = null;
  }
}

/** A long, unmistakable vibration pattern, repeated until dismissed. */
export const VIBRATION_PATTERN = [600, 200, 600, 200, 600, 400];

export class Vibrator {
  private timer: number | undefined;

  start() {
    if (typeof navigator.vibrate !== "function") return;
    const pulse = () => {
      navigator.vibrate(VIBRATION_PATTERN);
      this.timer = window.setTimeout(pulse, 2800);
    };
    pulse();
  }

  stop() {
    window.clearTimeout(this.timer);
    if (typeof navigator.vibrate === "function") navigator.vibrate(0);
  }
}

/** Keeps the screen — and therefore the tab — awake while the alarm is armed. */
export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (!("wakeLock" in navigator)) return null;
  try {
    return await navigator.wakeLock.request("screen");
  } catch {
    return null;
  }
}
