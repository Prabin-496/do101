"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { ErrorState, Stat } from "@/components/ui/Feedback";
import {
  loadWorld,
  drawGlobe,
  drawPicking,
  pickAt,
  rotationForFeature,
  shortestDelta,
  LIGHT_THEME,
  DARK_THEME,
  type CountryFeature,
  type GlobeState,
} from "@/lib/geo/globe";
import {
  loadCountries,
  searchCountries,
  formatArea,
  haversineKm,
  REGION_COLORS,
  type CountryFact,
} from "@/lib/geo/countries";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { cn } from "@/lib/utils/cn";

interface Ready {
  features: CountryFeature[];
  countries: CountryFact[];
  /** Feature index → country facts, matched on the numeric ISO code. */
  factByIndex: Map<number, CountryFact>;
  indexByCode: Map<string, number>;
}

const PICK_SIZE = 420;

export function EarthGlobe() {
  const { resolvedTheme } = useTheme();
  const [data, setData] = React.useState<Ready | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [state, setState] = React.useState<GlobeState>({ rotation: [-10, -20, 0], scale: 0.92 });
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [spinning, setSpinning] = React.useState(true);
  const [graticule, setGraticule] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [quiz, setQuiz] = React.useState<{ target: CountryFact; answered: boolean } | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const pickRef = React.useRef<HTMLCanvasElement | null>(null);
  const stateRef = React.useRef(state);
  const dragging = React.useRef<{ x: number; y: number } | null>(null);
  const flyTo = React.useRef<{ target: [number, number, number]; from: [number, number, number]; start: number } | null>(null);
  const pickDirty = React.useRef(true);
  const [isDragging, setIsDragging] = React.useState(false);

  // Mirrored into a ref so the animation loop always reads the latest value
  // without re-subscribing every frame.
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const theme = resolvedTheme === "dark" ? DARK_THEME : LIGHT_THEME;

  /* ------------------------------ data loading ------------------------------ */

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [features, countries] = await Promise.all([loadWorld(), loadCountries()]);
        if (cancelled) return;

        const byNumeric = new Map(countries.filter((c) => c.numeric).map((c) => [c.numeric, c]));
        const factByIndex = new Map<number, CountryFact>();
        const indexByCode = new Map<string, number>();

        features.forEach((f, i) => {
          // world-atlas identifies each shape by its numeric ISO code.
          const id = String(f.id ?? "").padStart(3, "0");
          const fact = byNumeric.get(id);
          if (fact) {
            factByIndex.set(i, fact);
            indexByCode.set(fact.code, i);
          }
        });

        setData({ features, countries, factByIndex, indexByCode });
      } catch {
        if (!cancelled) {
          setError("The map data could not be loaded. Check your connection and reload the page.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* -------------------------------- rendering ------------------------------- */

  React.useEffect(() => {
    if (!data) return;
    let frame = 0;
    let last = performance.now();

    if (!pickRef.current) pickRef.current = document.createElement("canvas");

    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const elapsed = now - last;
      last = now;

      let next = stateRef.current;

      // Easing toward a searched country takes precedence over idle spin.
      if (flyTo.current) {
        const { from, target, start } = flyTo.current;
        const progress = Math.min(1, (now - start) / 900);
        const eased = 1 - Math.pow(1 - progress, 3);
        next = {
          ...next,
          rotation: [
            from[0] + shortestDelta(from[0], target[0]) * eased,
            from[1] + (target[1] - from[1]) * eased,
            0,
          ],
        };
        if (progress >= 1) flyTo.current = null;
        stateRef.current = next;
        setState(next);
      } else if (spinning && !dragging.current) {
        next = {
          ...next,
          rotation: [next.rotation[0] + elapsed * 0.006, next.rotation[1], next.rotation[2]],
        };
        stateRef.current = next;
        setState(next);
      }

      drawGlobe(canvas, next, {
        features: data.features,
        colorFor: (_f, index) => {
          const fact = data.factByIndex.get(index);
          return REGION_COLORS[fact?.region ?? ""] ?? REGION_COLORS[""];
        },
        hoveredIndex: hovered,
        selectedIndex: selected,
        theme,
        showGraticule: graticule,
      });

      if (pickDirty.current && pickRef.current) {
        drawPicking(pickRef.current, next, data.features, PICK_SIZE, PICK_SIZE);
        pickDirty.current = false;
      }

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [data, spinning, hovered, selected, theme, graticule]);

  // Any rotation or zoom invalidates the picking buffer.
  React.useEffect(() => {
    pickDirty.current = true;
  }, [state.rotation, state.scale]);

  /* ------------------------------- interaction ------------------------------ */

  const pickFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): number | null => {
    const canvas = canvasRef.current;
    const pick = pickRef.current;
    if (!canvas || !pick) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * PICK_SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * PICK_SIZE;
    return pickAt(pick, x, y);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    flyTo.current = null;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragging.current) {
      const dx = event.clientX - dragging.current.x;
      const dy = event.clientY - dragging.current.y;
      dragging.current = { x: event.clientX, y: event.clientY };
      // Sensitivity falls with zoom so a magnified globe still feels controllable.
      const k = 0.25 / stateRef.current.scale;
      setState((prev) => ({
        ...prev,
        rotation: [
          prev.rotation[0] + dx * k,
          Math.max(-90, Math.min(90, prev.rotation[1] - dy * k)),
          0,
        ],
      }));
      return;
    }
    setHovered(pickFromEvent(event));
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const wasDragging = dragging.current;
    dragging.current = null;
    setIsDragging(false);
    if (!wasDragging) return;
    // A press without movement is a click, not a drag.
    const index = pickFromEvent(event);
    if (index !== null) selectIndex(index);
  };

  const selectIndex = React.useCallback(
    (index: number) => {
      setSelected(index);
      setSpinning(false);
      const fact = data?.factByIndex.get(index);
      if (fact) {
        track("tool_complete", { tool: "earth-globe", country: fact.code });
        if (quiz && !quiz.answered) {
          setQuiz({ ...quiz, answered: true });
          if (fact.code === quiz.target.code) recordCompletion(10);
        }
      }
    },
    [data, quiz],
  );

  const flyToCountry = React.useCallback(
    (fact: CountryFact) => {
      if (!data) return;
      const index = data.indexByCode.get(fact.code);
      const target =
        index !== undefined
          ? rotationForFeature(data.features[index])
          : ([-fact.latlng[1], -fact.latlng[0], 0] as [number, number, number]);

      flyTo.current = { from: stateRef.current.rotation, target, start: performance.now() };
      setSpinning(false);
      if (index !== undefined) setSelected(index);
    },
    [data],
  );

  const results = React.useMemo(
    () => (data ? searchCountries(data.countries, query) : []),
    [data, query],
  );

  const selectedFact = selected !== null ? (data?.factByIndex.get(selected) ?? null) : null;
  const hoveredFact = hovered !== null ? (data?.factByIndex.get(hovered) ?? null) : null;

  const neighbours = React.useMemo(() => {
    if (!selectedFact || !data) return [];
    return selectedFact.borders
      .map((code) => data.countries.find((c) => c.code === code))
      .filter((c): c is CountryFact => Boolean(c));
  }, [selectedFact, data]);

  const startQuiz = () => {
    if (!data) return;
    // Only quiz on countries big enough to find on a 110m-resolution globe.
    const pool = data.countries.filter(
      (c) => c.area > 20000 && data.indexByCode.has(c.code) && c.unMember,
    );
    const target = pool[Math.floor(Math.random() * pool.length)];
    setQuiz({ target, answered: false });
    setSelected(null);
    setSpinning(true);
    setQuery("");
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      {/* ------------------------------- controls ------------------------------- */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <div className="flex items-center gap-3 rounded-2xl border-[3px] border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 focus-within:border-[var(--grass)]">
              <span aria-hidden className="text-lg">
                🔎
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) {
                    flyToCountry(results[0]);
                    setQuery("");
                  }
                }}
                placeholder="Find a country or capital — try Japan, Nepal or Lima"
                aria-label="Search for a country"
                className="w-full bg-transparent text-base font-bold outline-none placeholder:font-semibold placeholder:text-[var(--muted)]"
              />
            </div>
            {results.length > 0 ? (
              <ul className="do-pop absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-2 shadow-xl">
                {results.map((country) => (
                  <li key={country.code}>
                    <button
                      type="button"
                      onClick={() => {
                        flyToCountry(country);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel)]"
                    >
                      <span aria-hidden className="text-xl">
                        {country.flag}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold">{country.name}</span>
                        <span className="block truncate text-xs font-semibold text-[var(--muted)]">
                          {country.capital[0] ?? "—"} · {country.region}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" tone={spinning ? "grass" : "panel"} onClick={() => setSpinning((s) => !s)}>
              {spinning ? "⏸ Pause spin" : "▶ Spin"}
            </Button>
            <Button size="sm" tone="sky" onClick={startQuiz}>
              🎯 Quiz me
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => {
                if (!data) return;
                const pool = [...data.indexByCode.values()];
                selectIndex(pool[Math.floor(Math.random() * pool.length)]);
                const fact = data.factByIndex.get(
                  [...data.indexByCode.values()][0],
                );
                if (fact) flyToCountry(fact);
              }}
            >
              🎲 Surprise me
            </Button>
          </div>
        </div>
      </Card>

      {quiz ? (
        <Card
          className="p-4"
          style={{
            background: quiz.answered
              ? selectedFact?.code === quiz.target.code
                ? "var(--grass-soft)"
                : "var(--cherry-soft)"
              : "var(--sky-soft)",
          }}
        >
          {!quiz.answered ? (
            <p className="text-base font-extrabold">
              🎯 Find <span className="text-xl">{quiz.target.name}</span> — spin the globe and click
              it.
            </p>
          ) : selectedFact?.code === quiz.target.code ? (
            <p className="text-base font-extrabold">
              ✅ Correct — that is {quiz.target.flag} {quiz.target.name}.{" "}
              <button type="button" onClick={startQuiz} className="underline">
                Another one?
              </button>
            </p>
          ) : (
            <p className="text-base font-extrabold">
              ❌ That is {selectedFact?.name ?? "somewhere else"}. You were looking for{" "}
              {quiz.target.flag} {quiz.target.name}
              {quiz.target.capital[0] ? `, capital ${quiz.target.capital[0]}` : ""}.{" "}
              <button
                type="button"
                onClick={() => flyToCountry(quiz.target)}
                className="underline"
              >
                Show me
              </button>
              {" · "}
              <button type="button" onClick={startQuiz} className="underline">
                Try another
              </button>
            </p>
          )}
        </Card>
      ) : null}

      {/* --------------------------------- globe -------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="relative overflow-hidden p-0">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={() => {
              dragging.current = null;
              setIsDragging(false);
              setHovered(null);
            }}
            onWheel={(e) => {
              setState((prev) => ({
                ...prev,
                scale: Math.max(0.6, Math.min(4, prev.scale * (e.deltaY > 0 ? 0.92 : 1.08))),
              }));
            }}
            className="block aspect-square w-full cursor-grab touch-none active:cursor-grabbing"
            role="img"
            aria-label={
              selectedFact
                ? `Interactive globe, ${selectedFact.name} selected`
                : "Interactive globe of the world. Use the country list below to explore with a keyboard."
            }
          />

          {!data ? (
            <div className="absolute inset-0 grid place-items-center">
              <p className="text-sm font-extrabold text-[var(--muted)]">Loading the world…</p>
            </div>
          ) : null}

          {hoveredFact && !isDragging ? (
            <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-[var(--bg)]/95 px-3 py-2 shadow-lg">
              <p className="text-sm font-extrabold">
                {hoveredFact.flag} {hoveredFact.name}
              </p>
            </div>
          ) : null}

          <div className="absolute bottom-3 right-3 flex gap-1">
            <Button
              size="sm"
              tone="panel"
              aria-label="Zoom in"
              onClick={() => setState((p) => ({ ...p, scale: Math.min(4, p.scale * 1.2) }))}
            >
              ＋
            </Button>
            <Button
              size="sm"
              tone="panel"
              aria-label="Zoom out"
              onClick={() => setState((p) => ({ ...p, scale: Math.max(0.6, p.scale / 1.2) }))}
            >
              −
            </Button>
          </div>
        </Card>

        {/* ------------------------------ detail panel ----------------------------- */}
        <Card className="p-5">
          {selectedFact ? (
            <div className="space-y-4">
              <div>
                <p className="text-5xl leading-none" aria-hidden>
                  {selectedFact.flag}
                </p>
                <h2 className="mt-2 text-2xl leading-tight">{selectedFact.name}</h2>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {selectedFact.official}
                </p>
              </div>

              <dl className="space-y-2 text-sm">
                {[
                  ["Capital", selectedFact.capital.join(", ") || "—"],
                  ["Region", `${selectedFact.subregion || selectedFact.region || "—"}`],
                  ["Area", formatArea(selectedFact.area)],
                  ["Languages", selectedFact.languages.join(", ") || "—"],
                  ["Currency", selectedFact.currencies.join(", ") || "—"],
                  ["ISO code", `${selectedFact.code2} · ${selectedFact.code}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-2 border-b border-[var(--border)] pb-2">
                    <dt className="w-24 shrink-0 font-extrabold text-[var(--muted)]">{label}</dt>
                    <dd className="font-bold">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                {selectedFact.landlocked ? (
                  <span className="rounded-lg bg-[var(--fire-soft)] px-2 py-1">Landlocked</span>
                ) : (
                  <span className="rounded-lg bg-[var(--sky-soft)] px-2 py-1">Has a coastline</span>
                )}
                {selectedFact.unMember ? (
                  <span className="rounded-lg bg-[var(--grass-soft)] px-2 py-1">UN member</span>
                ) : null}
              </div>

              {neighbours.length ? (
                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    Borders {neighbours.length} countr{neighbours.length === 1 ? "y" : "ies"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {neighbours.map((n) => (
                      <button
                        key={n.code}
                        type="button"
                        onClick={() => flyToCountry(n)}
                        className="rounded-lg bg-[var(--panel)] px-2 py-1 text-xs font-extrabold hover:bg-[var(--panel2)]"
                      >
                        {n.flag} {n.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-[var(--muted)]">
                  No land borders — it is an island or shares none.
                </p>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <span aria-hidden className="do-bob block text-5xl">
                🌍
              </span>
              <p className="mt-3 text-base font-extrabold">Spin it, then click a country</p>
              <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                Drag to rotate, scroll to zoom. Everything you click appears here.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Countries on the globe" value={data?.indexByCode.size ?? "…"} tone="sky" />
        <Stat label="In the dataset" value={data?.countries.length ?? "…"} tone="grass" />
        <Stat
          label="Distance from selection"
          value={
            selectedFact && quiz
              ? `${Math.round(haversineKm(selectedFact.latlng, quiz.target.latlng)).toLocaleString()} km`
              : "—"
          }
          hint={quiz ? `to ${quiz.target.name}` : "start a quiz"}
        />
      </div>

      <Card className="p-4">
        <Toggle checked={graticule} onChange={setGraticule} label="Show the grid lines" />
      </Card>

      {/* Keyboard and screen-reader route to every country, and crawlable text. */}
      {data ? (
        <details className="do-card p-5">
          <summary className="cursor-pointer text-sm font-extrabold">
            Browse all {data.countries.length} countries as a list
          </summary>
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
            Selecting a country here spins the globe to it — the same as clicking it, but reachable
            with a keyboard.
          </p>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.countries.map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  onClick={() => flyToCountry(country)}
                  className={cn(
                    "w-full truncate rounded-lg px-2 py-1.5 text-left text-sm font-bold hover:bg-[var(--panel)]",
                    selectedFact?.code === country.code && "bg-[var(--panel)]",
                  )}
                >
                  {country.flag} {country.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-xs font-semibold text-[var(--muted)]">
        Country outlines from{" "}
        <a href="https://github.com/topojson/world-atlas" target="_blank" rel="noopener noreferrer nofollow" className="underline">
          world-atlas
        </a>{" "}
        (Natural Earth, public domain). Country facts from{" "}
        <a href="https://github.com/mledoze/countries" target="_blank" rel="noopener noreferrer nofollow" className="underline">
          mledoze/countries
        </a>
        , licensed under the{" "}
        <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer nofollow" className="underline">
          ODbL
        </a>
        . Borders and names follow those datasets and are not a political statement by DO101.
      </p>
    </div>
  );
}
