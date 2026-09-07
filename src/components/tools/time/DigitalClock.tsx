"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { track } from "@/lib/analytics";
import { useLocalValue } from "@/lib/utils/use-local";
import { writeLocal } from "@/lib/utils/storage";
import { cn } from "@/lib/utils/cn";
import { FlipDigits } from "./FlipDigits";

type ThemeId = "midnight" | "paper" | "amber" | "matrix" | "ocean" | "rose";

interface Theme {
  label: string;
  bg: string;
  fg: string;
  dim: string;
  glow: string;
  /** Flip-card surfaces, slightly lifted from the background. */
  card: string;
  cardTop: string;
  cardBottom: string;
}

const THEMES: Record<ThemeId, Theme> = {
  midnight: { label: "Midnight", bg: "#05070a", fg: "#f4f8fb", dim: "#7d8b96", glow: "rgba(160,200,255,.20)", card: "#171b21", cardTop: "#1f242b", cardBottom: "#101318" },
  paper: { label: "Paper", bg: "#f6f4ee", fg: "#1d2228", dim: "#6c7680", glow: "rgba(0,0,0,.06)", card: "#ffffff", cardTop: "#ffffff", cardBottom: "#eceae4" },
  amber: { label: "Amber", bg: "#0d0700", fg: "#ffb545", dim: "#8a6026", glow: "rgba(255,150,40,.28)", card: "#1a1005", cardTop: "#241708", cardBottom: "#120b03" },
  matrix: { label: "Terminal", bg: "#00120a", fg: "#4cff9a", dim: "#1f7a4c", glow: "rgba(60,255,150,.25)", card: "#042315", cardTop: "#06301c", cardBottom: "#021a10" },
  ocean: { label: "Ocean", bg: "#04121c", fg: "#7fe3ff", dim: "#2f6f88", glow: "rgba(120,220,255,.25)", card: "#08222f", cardTop: "#0b2c3d", cardBottom: "#051a25" },
  rose: { label: "Rose", bg: "#170510", fg: "#ff9ec4", dim: "#8a4665", glow: "rgba(255,150,190,.25)", card: "#2a0e1f", cardTop: "#361327", cardBottom: "#200a18" },
};

const ZONES = [
  "local",
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Moscow",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

type DisplayId = "flip" | "digits";

interface Settings {
  display: DisplayId;
  theme: ThemeId;
  twentyFour: boolean;
  seconds: boolean;
  showDate: boolean;
  blink: boolean;
  zone: string;
}

const DEFAULTS: Settings = {
  display: "flip",
  theme: "midnight",
  twentyFour: true,
  seconds: true,
  showDate: true,
  blink: false,
  zone: "local",
};

/**
 * A full-screen digital clock built to be pleasant to leave running.
 *
 * Settings persist on the device, the browser's Screen Wake Lock keeps the
 * display awake in full screen, and the controls fade out after a few seconds
 * of stillness so the clock behaves like a screensaver rather than a web page.
 */
export function DigitalClock() {
  const saved = useLocalValue<Settings>("clock-settings", DEFAULTS);
  const [settings, setSettings] = React.useState<Settings>(saved);
  const [now, setNow] = React.useState<Date | null>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [idle, setIdle] = React.useState(false);
  const [wakeLockActive, setWakeLockActive] = React.useState(false);

  const stageRef = React.useRef<HTMLDivElement>(null);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const idleTimer = React.useRef<number | undefined>(undefined);

  const theme = THEMES[settings.theme];

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeLocal("clock-settings", next);
  };

  // The clock ticks client-side only, so the server render stays deterministic.
  React.useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, settings.seconds ? 250 : 2000);
    return () => window.clearInterval(id);
  }, [settings.seconds]);

  // Full-screen state can also change via Escape or the browser's own UI.
  React.useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keep the screen awake while the clock is on show, where supported.
  React.useEffect(() => {
    let cancelled = false;

    const request = async () => {
      if (!fullscreen || !("wakeLock" in navigator)) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener("release", () => setWakeLockActive(false));
      } catch {
        // Denied or unsupported: the clock still works, the screen may sleep.
      }
    };

    void request();
    return () => {
      cancelled = true;
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setWakeLockActive(false);
    };
  }, [fullscreen]);

  // Fade the controls out when nothing has moved for a few seconds.
  React.useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 3500);
    };
    wake();
    const events = ["mousemove", "keydown", "touchstart", "wheel"] as const;
    events.forEach((event) => window.addEventListener(event, wake));
    return () => {
      events.forEach((event) => window.removeEventListener(event, wake));
      window.clearTimeout(idleTimer.current);
    };
  }, []);

  const enterFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
      track("tool_complete", { tool: "digital-clock", action: "fullscreen" });
    } catch {
      // Some browsers refuse without a trusted gesture; the clock still works.
    }
  };

  const zone = settings.zone === "local" ? undefined : settings.zone;
  const timeParts = now
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        ...(settings.seconds ? { second: "2-digit" as const } : {}),
        hour12: !settings.twentyFour,
        timeZone: zone,
      }).formatToParts(now)
    : [];

  const value = (type: string) => timeParts.find((p) => p.type === type)?.value ?? "";
  const dayPeriod = value("dayPeriod");

  const dateLabel =
    now && settings.showDate
      ? new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: zone,
        }).format(now)
      : "";

  const separatorHidden = settings.blink && now ? now.getSeconds() % 2 === 1 : false;

  return (
    <div className="space-y-4">
      <div
        ref={stageRef}
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-2xl border-2 border-[var(--border)] transition-colors",
          fullscreen ? "h-screen w-screen rounded-none border-0" : "h-[46vh] min-h-[280px]",
        )}
        style={
          {
            background: theme.bg,
            color: theme.fg,
            "--flip-bg": theme.card,
            "--flip-bg-top": theme.cardTop,
            "--flip-bg-bottom": theme.cardBottom,
          } as React.CSSProperties
        }
      >
        <div className="px-4 text-center">
          {settings.display === "flip" && now ? (
            <FlipDigits
              fontSize={fullscreen ? "min(15vw, 26vh)" : "min(12vw, 15vh)"}
              groups={[
                { value: value("hour"), label: settings.twentyFour ? "hours" : dayPeriod || "hours" },
                { value: value("minute"), label: "minutes" },
                ...(settings.seconds ? [{ value: value("second"), label: "seconds" }] : []),
              ]}
            />
          ) : (
            <p
              className="font-mono tabular-nums leading-none"
              style={{
                fontSize: fullscreen ? "min(22vw, 34vh)" : "min(17vw, 22vh)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                textShadow: `0 0 ${fullscreen ? "80px" : "50px"} ${theme.glow}`,
              }}
              aria-live="off"
            >
              {now ? (
                <>
                  {value("hour")}
                  <span style={{ opacity: separatorHidden ? 0.15 : 1, transition: "opacity 120ms" }}>
                    :
                  </span>
                  {value("minute")}
                  {settings.seconds ? (
                    <>
                      <span
                        style={{ opacity: separatorHidden ? 0.15 : 1, transition: "opacity 120ms" }}
                      >
                        :
                      </span>
                      {value("second")}
                    </>
                  ) : null}
                  {dayPeriod ? (
                    <span style={{ fontSize: "0.3em", marginLeft: "0.15em", color: theme.dim }}>
                      {dayPeriod}
                    </span>
                  ) : null}
                </>
              ) : (
                <span style={{ color: theme.dim }}>--:--</span>
              )}
            </p>
          )}

          {dateLabel ? (
            <p
              className="mt-6 font-semibold"
              style={{ color: theme.dim, fontSize: fullscreen ? "min(3vw, 3.4vh)" : "clamp(12px, 2.4vw, 18px)" }}
            >
              {dateLabel}
              {zone ? ` · ${zone.replace(/_/g, " ")}` : ""}
            </p>
          ) : null}
        </div>

        {/* Screen-reader announcement, updated once a minute rather than every tick. */}
        <p className="sr-only" aria-live="polite">
          {now
            ? new Intl.DateTimeFormat(undefined, {
                hour: "numeric",
                minute: "2-digit",
                hour12: !settings.twentyFour,
                timeZone: zone,
              }).format(now)
            : ""}
        </p>

        <div
          className={cn(
            "absolute bottom-4 right-4 flex gap-2 transition-opacity duration-500",
            idle && fullscreen ? "opacity-0" : "opacity-100",
          )}
        >
          {fullscreen && wakeLockActive ? (
            <span
              className="self-center rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider"
              style={{ color: theme.dim }}
            >
              screen kept awake
            </span>
          ) : null}
          <Button size="sm" tone="panel" onClick={enterFullscreen}>
            {fullscreen ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Clock settings
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="clock-display">Display style</Label>
            <Select
              id="clock-display"
              value={settings.display}
              onChange={(e) => update({ display: e.target.value as DisplayId })}
            >
              <option value="flip">Flip cards — split-flap</option>
              <option value="digits">Plain digits — glowing</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="clock-theme">Theme</Label>
            <Select
              id="clock-theme"
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value as ThemeId })}
            >
              {Object.entries(THEMES).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="clock-zone">Time zone</Label>
            <Select
              id="clock-zone"
              value={settings.zone}
              onChange={(e) => update({ zone: e.target.value })}
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z === "local" ? "This device" : z.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <Toggle
            checked={settings.twentyFour}
            onChange={(v) => update({ twentyFour: v })}
            label="24-hour clock"
            description="Off shows AM and PM."
          />
          <Toggle
            checked={settings.seconds}
            onChange={(v) => update({ seconds: v })}
            label="Show seconds"
          />
          <Toggle
            checked={settings.showDate}
            onChange={(v) => update({ showDate: v })}
            label="Show the date"
          />
          {settings.display === "digits" ? (
            <Toggle
              checked={settings.blink}
              onChange={(v) => update({ blink: v })}
              label="Blink the separator"
              description="A one-second pulse, like an old alarm clock."
            />
          ) : null}
        </div>

        <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
          Your settings are saved in this browser only. In full screen the controls fade away and,
          where the browser allows it, the screen is kept awake.
        </p>
      </Card>
    </div>
  );
}
