"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { ErrorState, InfoNote, Progress, Stat } from "@/components/ui/Feedback";
import {
  assessApproach,
  bearingDegrees,
  compassPoint,
  formatDistance,
  formatEta,
  kmh,
} from "@/lib/travel/geo";
import { AlarmSound, Vibrator, detectCapabilities, requestWakeLock } from "@/lib/travel/alarm";
import { searchPlaces, SAVED_PLACES_KEY, type Place, type SavedPlace } from "@/lib/travel/places";
import { readLocal, writeLocal } from "@/lib/utils/storage";
import { useLocalValue, useIsHydrated } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { cn } from "@/lib/utils/cn";

const StationMap = dynamic(() => import("./StationMap").then((m) => m.StationMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[320px] place-items-center rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] text-sm font-extrabold text-[var(--muted)]">
      Loading the map…
    </div>
  ),
});

const RADIUS_OPTIONS = [300, 500, 800, 1200, 2000, 3000];

type Phase = "setup" | "armed" | "ringing";

interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  speed: number | null;
  at: number;
}

export function StationAlarm() {
  const [phase, setPhase] = React.useState<Phase>("setup");
  const [target, setTarget] = React.useState<Place | null>(null);
  const [radius, setRadius] = React.useState(800);
  const [fix, setFix] = React.useState<Fix | null>(null);
  const [approach, setApproach] = React.useState<ReturnType<typeof assessApproach> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Place[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [keepAwake, setKeepAwake] = React.useState(true);
  const [useVibration, setUseVibration] = React.useState(true);
  const [useSound, setUseSound] = React.useState(true);

  const saved = useLocalValue<SavedPlace[]>(SAVED_PLACES_KEY, []);
  // Capabilities can only be known in the browser. Until hydration they read as
  // unavailable, so the check below waits — otherwise the server would render
  // an "unsupported" error for everyone, including search engines.
  const hydrated = useIsHydrated();
  const caps = React.useMemo(() => detectCapabilities(), []);

  const searchable = query.trim().length >= 2;
  // Results clear as soon as the box is emptied, with no extra state write.
  const visibleResults = searchable ? results : [];

  const watchId = React.useRef<number | null>(null);
  const soundRef = React.useRef<AlarmSound | null>(null);
  const vibratorRef = React.useRef<Vibrator | null>(null);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const previousRef = React.useRef<{ distance: number; at: number } | undefined>(undefined);
  const phaseRef = React.useRef(phase);
  const [wakeLockActive, setWakeLockActive] = React.useState(false);

  // Read by the geolocation callback, which outlives any single render.
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* -------------------------------- search -------------------------------- */

  React.useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    // Debounced to respect Nominatim's one-request-per-second policy.
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query, controller.signal));
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Station search is unavailable right now. You can still tap the map or use your current position.");
        }
      } finally {
        setSearching(false);
      }
    }, 1100);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, searchable]);

  /* ------------------------------- alarm state ------------------------------ */

  const stopEverything = React.useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    soundRef.current?.stop();
    vibratorRef.current?.stop();
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setWakeLockActive(false);
    previousRef.current = undefined;
  }, []);

  React.useEffect(() => () => stopEverything(), [stopEverything]);

  const trigger = React.useCallback(() => {
    if (phaseRef.current === "ringing") return;
    setPhase("ringing");
    if (useSound) soundRef.current?.start();
    if (useVibration) vibratorRef.current?.start();
    track("tool_complete", { tool: "station-alarm", event: "triggered" });
    recordCompletion(10);
  }, [useSound, useVibration]);

  const start = async () => {
    if (!target) return;
    setError(null);
    setGpsError(null);

    // Priming inside the click is what allows the alarm to make sound later.
    soundRef.current ??= new AlarmSound();
    vibratorRef.current ??= new Vibrator();
    const primed = useSound ? await soundRef.current.prime() : true;
    if (useSound && !primed) {
      setError("Audio could not be started, so the alarm will rely on vibration and the screen.");
    }

    if (keepAwake) {
      wakeLockRef.current = await requestWakeLock();
      setWakeLockActive(Boolean(wakeLockRef.current));
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsError(null);
        const next: Fix = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          at: position.timestamp,
        };
        setFix(next);

        const state = assessApproach(
          { lat: next.lat, lon: next.lon },
          { lat: target.lat, lon: target.lon },
          radius,
          next.speed,
          previousRef.current,
          next.at,
        );
        previousRef.current = { distance: state.distance, at: next.at };
        setApproach(state);
        if (state.arrived) trigger();
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was refused. The alarm cannot work without it — allow location for this site and start again."
            : err.code === err.POSITION_UNAVAILABLE
              ? "No position fix yet. GPS can take a minute indoors or in a tunnel; keep the app open and it will pick up."
              : "Getting a position took too long. Still trying…",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 },
    );

    setPhase("armed");
    track("game_start", { tool: "station-alarm", radius });
  };

  const stop = () => {
    stopEverything();
    setPhase("setup");
    setFix(null);
    setApproach(null);
  };

  const dismiss = () => {
    soundRef.current?.stop();
    vibratorRef.current?.stop();
    setPhase("armed");
  };

  const savePlace = (place: Place) => {
    const next = [
      { ...place, savedAt: Date.now() },
      ...readLocal<SavedPlace[]>(SAVED_PLACES_KEY, []).filter((p) => p.id !== place.id),
    ].slice(0, 12);
    writeLocal(SAVED_PLACES_KEY, next);
  };

  const useCurrentAsTarget = () => {
    if (hydrated && !caps.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place: Place = {
          id: `here-${Date.now()}`,
          name: "This spot",
          detail: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          isStation: false,
        };
        setTarget(place);
      },
      () => setGpsError("Could not read your current position."),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  /* -------------------------------- derived -------------------------------- */

  const bearing =
    fix && target
      ? bearingDegrees({ lat: fix.lat, lon: fix.lon }, { lat: target.lat, lon: target.lon })
      : null;

  // Progress is shown across the last 10 km, which is a sensible train scale.
  const progress = approach
    ? Math.max(0, Math.min(100, (1 - Math.min(approach.distance, 10_000) / 10_000) * 100))
    : 0;

  if (hydrated && !caps.geolocation) {
    return (
      <ErrorState
        title="This browser has no location access"
        message="The alarm needs the Geolocation API, which this browser does not expose or which is blocked because the page is not on a secure connection."
      />
    );
  }

  /* ------------------------------- ringing UI ------------------------------- */

  if (phase === "ringing") {
    return (
      <div className="space-y-4">
        <Card className="do-shake bg-[var(--cherry)] p-8 text-center text-white">
          <p className="do-bob text-7xl" aria-hidden>
            🔔
          </p>
          <p className="mt-4 text-4xl font-extrabold" role="alert">
            Wake up!
          </p>
          <p className="mt-2 text-xl font-extrabold">
            {target?.name} is {formatDistance(approach?.distance ?? 0)} away
          </p>
          <Button tone="panel" size="lg" className="mt-6" onClick={dismiss}>
            Stop the alarm
          </Button>
        </Card>
        <Button tone="ghost" onClick={stop}>
          End the journey
        </Button>
      </div>
    );
  }

  /* -------------------------------- armed UI -------------------------------- */

  if (phase === "armed" && target) {
    const accuracyPoor = fix ? fix.accuracy > 100 : false;

    return (
      <div className="space-y-4">
        <Card className="bg-[var(--grass-soft)] p-5 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Watching for
          </p>
          <p className="mt-1 text-2xl font-extrabold">{target.name}</p>
          <p className="mt-4 text-6xl font-extrabold tabular-nums">
            {formatDistance(approach?.distance ?? Number.NaN)}
          </p>
          <p className="text-sm font-extrabold text-[var(--muted)]">
            alarm rings within {formatDistance(radius)}
          </p>
          <Progress className="mt-4" value={progress} tone="grass" />
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Speed" value={kmh(approach?.speed ?? null)} tone="sky" />
          <Stat label="Arriving in" value={formatEta(approach?.eta ?? null)} tone="fire" />
          <Stat
            label="Direction"
            value={bearing !== null ? compassPoint(bearing) : "—"}
            hint={bearing !== null ? `${Math.round((bearing + 360) % 360)}°` : undefined}
          />
          <Stat
            label="GPS accuracy"
            value={fix ? `±${Math.round(fix.accuracy)} m` : "…"}
            tone={accuracyPoor ? "cherry" : "grass"}
          />
        </div>

        {gpsError ? <ErrorState message={gpsError} /> : null}
        {accuracyPoor ? (
          <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
            ⚠️ The position is only accurate to about {Math.round(fix!.accuracy)} m — typical in a
            tunnel or between tall buildings. Consider a larger alarm radius so a drifting fix
            cannot make you miss the stop.
          </p>
        ) : null}

        <InfoNote icon="📱">
          <strong>Keep this tab open and in front.</strong> Browsers pause background tabs, which
          would stop the alarm. The screen is being held awake
          {wakeLockActive ? "" : " — or would be, if this browser allowed it"}. Do not lock the
          phone.
        </InfoNote>

        <StationMap
          target={target}
          current={fix ? { lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy } : null}
          radius={radius}
        />

        <div className="flex flex-wrap gap-2">
          <Button tone="cherry" onClick={stop}>
            Cancel the alarm
          </Button>
          <Button tone="panel" onClick={trigger}>
            Test the alarm now
          </Button>
        </div>
      </div>
    );
  }

  /* -------------------------------- setup UI -------------------------------- */

  return (
    <div className="space-y-4">
      <InfoNote icon="⚠️">
        <strong>Read this before relying on it.</strong> A browser tab is paused when it goes to the
        background, so the alarm only works while this page stays open and in front, with the screen
        on. Do not lock your phone.
        {hydrated && !caps.vibration ? (
          <>
            {" "}
            This browser also has <strong>no vibration support</strong> — iPhones do not allow it —
            so the alarm will use sound. Turn your volume up.
          </>
        ) : null}
      </InfoNote>

      <Card className="p-5">
        <Label htmlFor="station-search">Where should it wake you?</Label>
        <div className="flex items-center gap-3 rounded-2xl border-[3px] border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 focus-within:border-[var(--grass)]">
          <span aria-hidden className="text-lg">
            🚉
          </span>
          <input
            id="station-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a station — Shinjuku, Kyoto, Shibuya…"
            className="w-full bg-transparent text-base font-bold outline-none placeholder:font-semibold placeholder:text-[var(--muted)]"
          />
          {searching ? <span className="text-xs font-extrabold text-[var(--muted)]">…</span> : null}
        </div>

        {visibleResults.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {visibleResults.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTarget(place);
                    savePlace(place);
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel)]"
                >
                  <span aria-hidden>{place.isStation ? "🚉" : "📍"}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold">{place.name}</span>
                    <span className="block truncate text-xs font-semibold text-[var(--muted)]">
                      {place.detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" tone="panel" onClick={useCurrentAsTarget}>
            📍 Use where I am now
          </Button>
        </div>

        {saved.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Saved on this device
            </p>
            <div className="flex flex-wrap gap-2">
              {saved.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setTarget(place)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2 text-sm font-extrabold transition-colors",
                    target?.id === place.id
                      ? "border-[var(--grass)] bg-[var(--grass-soft)]"
                      : "border-[var(--border)] hover:bg-[var(--panel)]",
                  )}
                >
                  🚉 {place.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {gpsError ? <ErrorState message={gpsError} /> : null}

      <StationMap
        target={target}
        current={null}
        radius={radius}
        onPick={(lat, lon) =>
          setTarget({
            id: `pin-${Date.now()}`,
            name: "Dropped pin",
            detail: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
            lat,
            lon,
            isStation: false,
          })
        }
      />
      <p className="text-xs font-semibold text-[var(--muted)]">
        Tap anywhere on the map to drop a pin instead of searching. Map data ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline"
        >
          OpenStreetMap
        </a>{" "}
        contributors; search by Nominatim.
      </p>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="alarm-radius">Wake me within</Label>
            <Select
              id="alarm-radius"
              value={String(radius)}
              onChange={(e) => setRadius(Number(e.target.value))}
            >
              {RADIUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatDistance(option)}
                  {option === 800 ? " — good default" : ""}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
              On a fast train, 2 km gives you roughly a minute to gather your things.
            </p>
          </div>
          <div className="space-y-2">
            <Toggle
              checked={useSound}
              onChange={setUseSound}
              label="Sound the alarm"
              description={!hydrated || caps.audio ? "A repeating chime." : "Not supported in this browser."}
            />
            <Toggle
              checked={useVibration}
              onChange={setUseVibration}
              label="Vibrate"
              description={
                !hydrated || caps.vibration
                  ? "A long repeating pattern."
                  : "Not supported — iPhones block this."
              }
            />
            <Toggle
              checked={keepAwake}
              onChange={setKeepAwake}
              label="Keep the screen awake"
              description={
                !hydrated || caps.wakeLock
                  ? "Stops the tab being paused."
                  : "Not supported in this browser."
              }
            />
          </div>
        </div>

        <div className="mt-5">
          <Button tone="cherry" size="lg" onClick={start} disabled={!target}>
            {target ? `Wake me near ${target.name}` : "Choose a destination first"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
