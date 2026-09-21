"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TalkButtonProps {
  /** False when there is no microphone, or nobody to talk to yet. */
  ready: boolean;
  talking: boolean;
  /** 0 to 1, how loudly the microphone is hearing you right now. */
  level: number;
  /** Tap once to start and once to stop, instead of holding. */
  handsFree: boolean;
  onStart: () => void;
  onStop: () => void;
  hint?: string;
}

/**
 * Press and hold to talk.
 *
 * The one rule this component exists to keep: there is no way to end up
 * transmitting without knowing it. Releasing, dragging off, tabbing away
 * and losing the pointer all stop the microphone, and the button says out
 * loud which state it is in rather than relying on colour alone.
 */
export function TalkButton({
  ready,
  talking,
  level,
  handsFree,
  onStart,
  onStop,
  hint,
}: TalkButtonProps) {
  const holding = React.useRef(false);

  const begin = React.useCallback(() => {
    if (!ready || holding.current) return;
    holding.current = true;
    onStart();
  }, [ready, onStart]);

  const end = React.useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    onStop();
  }, [onStop]);

  const toggle = React.useCallback(() => {
    if (!ready) return;
    if (talking) onStop();
    else onStart();
  }, [ready, talking, onStart, onStop]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!ready) return;
    event.preventDefault();
    // Capture, so letting go anywhere on the screen still stops the mic.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (handsFree) toggle();
    else begin();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (event.repeat) return;
    if (handsFree) toggle();
    else begin();
  };

  const onKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!handsFree) end();
  };

  // A ring that grows with your voice, so you can see you are being heard.
  const ring = talking ? 1 + Math.min(level, 1) * 0.16 : 1;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={!ready}
        aria-pressed={talking}
        aria-label={talking ? "Transmitting. Release to stop." : "Hold to talk"}
        onPointerDown={onPointerDown}
        onPointerUp={() => !handsFree && end()}
        onPointerCancel={() => !handsFree && end()}
        onLostPointerCapture={() => !handsFree && end()}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => end()}
        className={cn(
          "relative grid h-44 w-44 select-none touch-none place-items-center rounded-full",
          "text-center text-lg font-extrabold uppercase tracking-wide transition-transform duration-100",
          "outline-none focus-visible:ring-4 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]",
          ready ? "cursor-pointer focus-visible:ring-[var(--ring)]" : "cursor-not-allowed opacity-50",
          talking ? "scale-[0.97] text-white" : "text-[var(--ink)]",
        )}
        style={{
          background: talking ? "var(--cherry)" : "var(--panel-2)",
          boxShadow: talking
            ? `0 0 0 ${Math.round((ring - 1) * 90)}px var(--cherry-soft), 0 6px 0 var(--cherry-dark)`
            : "0 6px 0 var(--border-strong)",
        }}
      >
        <span className="pointer-events-none flex flex-col items-center gap-1">
          <span aria-hidden className="text-4xl">
            {talking ? "🔴" : "🎙️"}
          </span>
          {talking ? "On air" : handsFree ? "Tap to talk" : "Hold to talk"}
        </span>
      </button>

      <p
        aria-live="polite"
        className={cn(
          "min-h-[1.25rem] text-center text-sm font-extrabold",
          talking ? "text-[var(--cherry)]" : "text-[var(--muted)]",
        )}
      >
        {talking
          ? "Live — everyone in the room can hear you"
          : (hint ?? "Your microphone is off")}
      </p>
    </div>
  );
}
