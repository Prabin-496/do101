"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { searchPlaces, type Place } from "@/lib/weather/location";
import { cn } from "@/lib/utils/cn";

/**
 * Choosing where to forecast for.
 *
 * "Use my location" is the first thing offered because it is what most
 * people want, but it is never assumed — nothing asks the browser for a
 * position until the button is pressed, so opening the page does not throw a
 * permission prompt at anybody.
 */

export interface LocationPickerProps {
  onPick: (place: Place) => void;
  onUseMyLocation: () => void;
  locating: boolean;
  /** Places looked at before, kept on this device. */
  recent: Place[];
  current: Place | null;
  geolocationAvailable: boolean;
}

export function LocationPicker({
  onPick,
  onUseMyLocation,
  locating,
  recent,
  current,
  geolocationAvailable,
}: LocationPickerProps) {
  const [query, setQuery] = React.useState("");
  /**
   * Results are stamped with the query they answer, so a slow reply for
   * "lon" never shows up underneath "london" — and a short query needs no
   * clearing, because nothing stale can match it.
   */
  const [hits, setHits] = React.useState<{ query: string; places: Place[]; failed: boolean } | null>(
    null,
  );

  const trimmed = query.trim();
  const open = trimmed.length >= 2;

  React.useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const places = await searchPlaces(needle, controller.signal);
        setHits({ query: needle, places, failed: false });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setHits({ query: needle, places: [], failed: true });
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const fresh = hits && hits.query === trimmed ? hits : null;
  const results = fresh?.places ?? [];
  const searching = open && !fresh;
  const failed = fresh?.failed ?? false;

  function choose(place: Place) {
    onPick(place);
    setQuery("");
    setHits(null);
  }

  return (
    <div className="space-y-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="sky"
          size="sm"
          onClick={onUseMyLocation}
          disabled={locating || !geolocationAvailable}
          title={
            geolocationAvailable
              ? "Ask this browser where you are"
              : "This browser cannot report a location"
          }
        >
          {locating ? "Finding you…" : "📍 Use my location"}
        </Button>

        <div className="relative min-w-[12rem] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="or search for a town or city…"
            aria-label="Search for a place"
            className="w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--sky)]"
          />

          {open ? (
            <div
              className="do-scroll absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg)] p-1 shadow-[0_6px_0_var(--border-strong)]"
              role="listbox"
              aria-label="Search results"
            >
              {searching ? (
                <p className="px-3 py-2 text-sm font-semibold text-[var(--muted)]">Searching…</p>
              ) : null}

              {failed ? (
                <p className="px-3 py-2 text-sm font-semibold text-[var(--muted)]">
                  Place search is unavailable right now.
                </p>
              ) : null}

              {!searching && !failed && !results.length ? (
                <p className="px-3 py-2 text-sm font-semibold text-[var(--muted)]">
                  Nowhere matches “{trimmed}”.
                </p>
              ) : null}

              {results.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(place)}
                  className="flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--panel)]"
                >
                  <span className="text-sm font-extrabold">{place.name}</span>
                  <span className="text-xs font-semibold text-[var(--muted)]">{place.detail}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {recent.length > 1 ? (
        <div className="do-scroll flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 pl-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Recent
          </span>
          {recent.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => choose(place)}
              aria-current={current ? place.id === current.id : false}
              className={cn(
                "shrink-0 rounded-xl border-2 px-3 py-1 text-xs font-extrabold transition-colors",
                current && place.id === current.id
                  ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                  : "border-transparent text-[var(--muted)] hover:bg-[var(--bg)]",
              )}
            >
              {place.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
