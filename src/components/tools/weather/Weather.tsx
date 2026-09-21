"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/Feedback";
import {
  ATTRIBUTION_URL,
  WeatherError,
  comingDays,
  currentHourIndex,
  dayFor,
  fetchForecast,
  nextHours,
  todayIso,
  type WeatherReport,
} from "@/lib/weather/api";
import { pressureThreeHoursAgo, sameHourYesterday } from "@/lib/weather/describe";
import {
  LAST_PLACE_KEY,
  LocationError,
  RECENT_KEY,
  UNITS_KEY,
  addRecent,
  coordsLabel,
  currentPosition,
  reverseGeocode,
  type Place,
} from "@/lib/weather/location";
import { DEFAULT_UNITS, guessUnits, type Units } from "@/lib/weather/units";
import { readLocal, writeLocal } from "@/lib/utils/storage";
import { useIsHydrated, useLocalValue } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { HourlyChart } from "./HourlyChart";
import { LocationPicker } from "./LocationPicker";
import { WeatherDetails } from "./WeatherDetails";
import { WeatherNow } from "./WeatherNow";
import { cn } from "@/lib/utils/cn";

/** Re-fetch if the page has been sitting open longer than this. */
const STALE_MS = 10 * 60 * 1000;

export function Weather() {
  const hydrated = useIsHydrated();

  /**
   * The chosen place, the recent list and the unit preference all live in
   * localStorage and are read back through the store hook rather than copied
   * into state. The server and the first client render both see the
   * fallback, so hydration always matches, and a write is the only way any
   * of them changes.
   */
  const place = useLocalValue<Place | null>(LAST_PLACE_KEY, null);
  const recent = useLocalValue<Place[]>(RECENT_KEY, []);
  const storedUnits = useLocalValue<Units | null>(UNITS_KEY, null);

  // Guessing from the locale needs the browser, so it waits for hydration.
  const units =
    storedUnits ??
    (hydrated ? guessUnits(typeof navigator !== "undefined" ? navigator.language : undefined) : DEFAULT_UNITS);

  const [report, setReport] = React.useState<WeatherReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const completed = React.useRef(false);
  const requestId = React.useRef(0);

  const geolocationAvailable =
    !hydrated || (typeof navigator !== "undefined" && "geolocation" in navigator);

  /* -------------------------------- fetching -------------------------------- */

  const load = React.useCallback(async (target: Place) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchForecast(target.lat, target.lon);
      // A slower earlier request must not overwrite a newer answer.
      if (id !== requestId.current) return;
      setReport(next);
      if (!completed.current) {
        completed.current = true;
        track("tool_complete", { tool: "weather" });
        recordCompletion();
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setError(
        err instanceof WeatherError
          ? err.message
          : "The forecast could not be loaded. Check your connection and try again.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  /** Records a place as the current one, and remembers it for next time. */
  const choose = React.useCallback((next: Place) => {
    writeLocal(LAST_PLACE_KEY, next);
    writeLocal(RECENT_KEY, addRecent(readLocal<Place[]>(RECENT_KEY, []), next));
  }, []);

  // Whatever place is current gets a forecast — including the one remembered
  // from last time, which is why opening the page shows something at once.
  const loadedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return;
    const key = `${place.lat},${place.lon}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    void load(place);
  }, [place, load]);

  // A tab left open overnight should not still be showing yesterday evening.
  React.useEffect(() => {
    if (!report || !place) return;
    const fetchedAt = report.fetchedAt;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAt < STALE_MS) return;
      if (place) void load(place);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [report, place, load]);

  /* ------------------------------ where am I? ------------------------------- */

  const detectLocation = React.useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const fix = await currentPosition();
      // The forecast starts from the coordinates immediately; the place name
      // catches up when it can, so a slow geocoder never holds up the answer.
      const provisional: Place = {
        id: `here-${fix.lat.toFixed(3)},${fix.lon.toFixed(3)}`,
        name: coordsLabel(fix.lat, fix.lon),
        detail: "Your location",
        lat: fix.lat,
        lon: fix.lon,
      };
      choose(provisional);

      const named = await reverseGeocode(fix.lat, fix.lon);
      if (!named) return;
      // Only upgrade the label if nothing else has been chosen meanwhile.
      const now = readLocal<Place | null>(LAST_PLACE_KEY, null);
      if (!now || now.id !== provisional.id) return;

      const resolved: Place = { ...named, detail: named.detail || "Your location" };
      writeLocal(LAST_PLACE_KEY, resolved);
      writeLocal(
        RECENT_KEY,
        addRecent(
          readLocal<Place[]>(RECENT_KEY, []).filter((p) => p.id !== provisional.id),
          resolved,
        ),
      );
    } catch (err) {
      setError(
        err instanceof LocationError
          ? err.message
          : "Your location could not be worked out. Search for your town instead.",
      );
    } finally {
      setLocating(false);
    }
  }, [choose]);

  /* --------------------------------- derived -------------------------------- */

  const view = React.useMemo(() => {
    if (!report) return null;
    const index = currentHourIndex(report);
    return {
      today: dayFor(report, todayIso(report)),
      days: comingDays(report),
      hoursAhead: nextHours(report, 24),
      sameHour: sameHourYesterday(report, index),
      pressureBefore: pressureThreeHoursAgo(report, index),
    };
  }, [report]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[16rem] flex-1">
          <LocationPicker
            onPick={choose}
            onUseMyLocation={() => void detectLocation()}
            locating={locating}
            recent={recent}
            current={place}
            geolocationAvailable={geolocationAvailable}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-1">
          {(["metric", "imperial"] as const).map((system) => (
            <button
              key={system}
              type="button"
              aria-pressed={units.system === system}
              onClick={() => writeLocal(UNITS_KEY, { ...units, system })}
              className={cn(
                "rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition-colors",
                units.system === system
                  ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                  : "border-transparent text-[var(--muted)] hover:bg-[var(--bg)]",
              )}
            >
              {system === "metric" ? "°C" : "°F"}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={!units.clock24}
            onClick={() => writeLocal(UNITS_KEY, { ...units, clock24: !units.clock24 })}
            title="Switch between the 24-hour and 12-hour clock"
            className="rounded-xl border-2 border-transparent px-3 py-1.5 text-xs font-extrabold text-[var(--muted)] transition-colors hover:bg-[var(--bg)]"
          >
            {units.clock24 ? "24h" : "12h"}
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {place ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="text-xl font-extrabold sm:text-2xl">
            {place.name}
            {place.detail ? (
              <span className="ml-2 text-sm font-bold text-[var(--muted)]">{place.detail}</span>
            ) : null}
          </h2>
          <div className="flex items-center gap-2">
            {report ? (
              <span className="text-xs font-semibold text-[var(--muted)]">
                Updated{" "}
                {new Date(report.fetchedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
            <Button tone="panel" size="sm" disabled={loading} onClick={() => void load(place)}>
              {loading ? "Checking…" : "Refresh"}
            </Button>
          </div>
        </div>
      ) : null}

      {!place && !loading ? (
        <section className="rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--panel)] px-4 py-10 text-center">
          <p className="text-4xl" aria-hidden>
            🌤
          </p>
          <h2 className="mt-2 text-xl font-extrabold">What is it like outside?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-[var(--muted)]">
            Press <strong>Use my location</strong> and this will tell you what the weather is doing
            where you are, in plain English — not just the numbers, but what they mean and whether
            you need a coat. Or search for anywhere in the world.
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs font-semibold text-[var(--muted)]">
            Your location goes straight from your browser to the forecast service. DO101 never sees
            it, and there is no account and nothing to install.
          </p>
        </section>
      ) : null}

      {loading && !report ? (
        <div
          className="grid place-items-center rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] px-4 py-16"
          role="status"
        >
          <p className="text-sm font-extrabold text-[var(--muted)]">Reading the sky…</p>
        </div>
      ) : null}

      {report && view ? (
        <div className={cn("space-y-4", loading && "opacity-70 transition-opacity")}>
          <WeatherNow
            report={report}
            today={view.today}
            hoursAhead={view.hoursAhead}
            sameHourYesterday={view.sameHour}
            placeName={place?.name ?? ""}
            units={units}
          />

          <HourlyChart hours={view.hoursAhead} units={units} />

          <WeatherDetails
            report={report}
            today={view.today}
            days={view.days}
            pressureThreeHoursAgo={view.pressureBefore}
            units={units}
          />

          <p className="px-1 text-xs font-semibold text-[var(--muted)]">
            Forecast by{" "}
            <a className="underline" href={ATTRIBUTION_URL} target="_blank" rel="noreferrer noopener">
              Open-Meteo
            </a>
            , place names from{" "}
            <a
              className="underline"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
            >
              OpenStreetMap
            </a>
            . Times are local to {place?.name || "the place shown"}
            {report.timezoneAbbreviation ? ` (${report.timezoneAbbreviation})` : ""}. A forecast is
            a best guess: trust the next few hours far more than the last day of the week.
          </p>
        </div>
      ) : null}
    </div>
  );
}
