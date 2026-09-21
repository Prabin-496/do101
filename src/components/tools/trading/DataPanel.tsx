"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { FileDrop } from "@/components/ui/FileDrop";
import { Input, Label, Select } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/Feedback";
import { ADAPTERS, getAdapter, MarketDataError } from "@/lib/trading/adapters";
import { bridgeHealth, bridgeSymbols } from "@/lib/trading/adapters/mt5";
import { parseCsv, CsvError } from "@/lib/trading/csv";
import type { Mt5Symbol } from "@/lib/trading/mt5";
import { TIMEFRAMES, type Series, type Timeframe } from "@/lib/trading/types";
import { writeLocal } from "@/lib/utils/storage";
import { useLocalValue } from "@/lib/utils/use-local";
import { Chip, ChipRow, Panel } from "./shared";

const KEY_STORAGE = "tradelens:keys";

/** Stable identity, so the store snapshot stays referentially stable. */
const NO_KEYS: Record<string, string> = {};

export interface DataPanelProps {
  series: Series | null;
  onSeries: (series: Series) => void;
  /** Remembered so a reload can come straight back to the same chart. */
  onChoice: (choice: { sourceId: string; symbol: string; timeframe: Timeframe }) => void;
  initial: { sourceId: string; symbol: string; timeframe: Timeframe };
}

export function DataPanel({ series, onSeries, onChoice, initial }: DataPanelProps) {
  const [sourceId, setSourceId] = React.useState(initial.sourceId);
  const [symbol, setSymbol] = React.useState(initial.symbol);
  const [timeframe, setTimeframe] = React.useState<Timeframe>(initial.timeframe);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);
  const [bridge, setBridge] = React.useState<{ terminal: string; symbols: Mt5Symbol[] } | null>(null);

  // Keys live in this browser and nowhere else. Read through the store hook so
  // the server render and the first client render agree, and the stored value
  // arrives immediately afterwards.
  const keys = useLocalValue<Record<string, string>>(KEY_STORAGE, NO_KEYS);

  const adapter = sourceId === "csv" ? null : getAdapter(sourceId);
  const timeframes = adapter ? TIMEFRAMES.filter((t) => adapter.timeframes.includes(t.id)) : TIMEFRAMES;

  const setKey = (id: string, value: string) => {
    writeLocal(KEY_STORAGE, { ...keys, [id]: value });
  };

  const load = async (overrides?: { symbol?: string; timeframe?: Timeframe }) => {
    if (!adapter) return;
    const wantedSymbol = overrides?.symbol ?? symbol;
    const wantedTimeframe = overrides?.timeframe ?? timeframe;
    setBusy(true);
    setError(null);
    setNotes([]);
    try {
      const loaded = await adapter.fetchSeries({
        symbol: wantedSymbol,
        timeframe: adapter.timeframes.includes(wantedTimeframe) ? wantedTimeframe : adapter.timeframes[0],
        apiKey: keys[adapter.id],
      });
      onSeries(loaded);
      onChoice({ sourceId: adapter.id, symbol: wantedSymbol, timeframe: loaded.timeframe });
    } catch (thrown) {
      setError(
        thrown instanceof MarketDataError
          ? thrown.message
          : "That request did not complete. The tool still works from a CSV file.",
      );
    } finally {
      setBusy(false);
    }
  };

  const connectBridge = async () => {
    setBusy(true);
    setError(null);
    try {
      const terminal = await bridgeHealth();
      const found = await bridgeSymbols();
      setBridge({ terminal, symbols: found });
      if (found.length > 0) setSymbol(found[0].name);
    } catch (thrown) {
      setError(thrown instanceof MarketDataError ? thrown.message : "The bridge did not answer.");
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotes([]);
    try {
      const parsed = parseCsv(await file.text(), file.name);
      onSeries(parsed.series);
      setNotes(parsed.notes);
      setTimeframe(parsed.series.timeframe);
      onChoice({ sourceId: "csv", symbol: parsed.series.symbol, timeframe: parsed.series.timeframe });
    } catch (thrown) {
      setError(thrown instanceof CsvError ? thrown.message : "That file could not be read as price data.");
    } finally {
      setBusy(false);
    }
  };

  const symbolOptions = adapter?.id === "mt5" && bridge ? bridge.symbols.map((s) => ({ id: s.name, label: `${s.name} — ${s.description || "gold"}` })) : adapter?.symbols.map((s) => ({ id: s.id, label: s.label }));

  return (
    <Panel
      title="Market data"
      icon="📡"
      subtitle="Every source here is free. Nothing is fetched through a DO101 server."
      right={
        series ? (
          <span className="rounded-xl bg-[var(--panel)] px-3 py-1 text-xs font-extrabold tabular-nums text-[var(--muted)]">
            {series.candles.length.toLocaleString()} bars loaded
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Source</Label>
          <ChipRow ariaLabel="Data source">
            {ADAPTERS.map((entry) => (
              <Chip key={entry.id} active={sourceId === entry.id} onClick={() => setSourceId(entry.id)} title={entry.blurb}>
                {entry.id === "mt5" ? "⭐ " : ""}
                {entry.name}
              </Chip>
            ))}
            <Chip active={sourceId === "csv"} onClick={() => setSourceId("csv")} title="Import a file you exported yourself">
              CSV file
            </Chip>
          </ChipRow>
        </div>

        {adapter ? (
          <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
            <strong className="text-[var(--ink)]">{adapter.blurb}</strong>{" "}
            {adapter.limits}{" "}
            <a href={adapter.home} target="_blank" rel="noopener noreferrer" className="underline">
              About this source ↗
            </a>
          </p>
        ) : (
          <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
            <strong className="text-[var(--ink)]">Your own file.</strong> Date, open, high, low, close and
            optionally volume — MetaTrader, TradingView, Dukascopy and plain spreadsheet exports all work. The
            file is read in this browser and never uploaded.
          </p>
        )}

        {adapter?.needsKey ? (
          <div>
            <Label hint="Stored in this browser only">Your free {adapter.name.split(" (")[0]} key</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste your own API key"
                value={keys[adapter.id] ?? ""}
                onChange={(event) => setKey(adapter.id, event.target.value)}
                className="min-w-0 flex-1"
              />
              {adapter.keyUrl ? (
                <a
                  href={adapter.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-center text-xs font-extrabold underline"
                >
                  Get a free key ↗
                </a>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs font-semibold text-[var(--muted)]">
              The key goes from this browser straight to the provider. It is never sent to DO101, and no key is
              built into this page.
            </p>
          </div>
        ) : null}

        {adapter?.id === "mt5" ? (
          <div className="rounded-2xl border-2 border-[var(--sun)] bg-[var(--sun-soft)] px-4 py-3">
            <p className="text-xs font-semibold">
              {bridge ? (
                <>
                  Connected to <strong>{bridge.terminal}</strong>.{" "}
                  {bridge.symbols.length > 0
                    ? `Gold symbols found: ${bridge.symbols.map((s) => s.name).join(", ")}.`
                    : "No gold symbol was found in Market Watch — open an XAUUSD chart in MetaTrader once, then reconnect."}
                </>
              ) : (
                <>
                  Needs the bridge script running on the computer with MetaTrader 5 open. The setup, the script
                  and what it can and cannot do are in the <strong>Gold desk</strong> tab.
                </>
              )}
            </p>
            <Button tone="panel" size="sm" className="mt-2" onClick={() => void connectBridge()} disabled={busy}>
              {bridge ? "Reconnect" : "Connect to MetaTrader 5"}
            </Button>
          </div>
        ) : null}

        {adapter ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3">
              <div>
                <Label htmlFor="tradelens-symbol">Symbol</Label>
                {adapter.freeform ? (
                  <div className="flex gap-2">
                    <Input
                      id="tradelens-symbol"
                      value={symbol}
                      spellCheck={false}
                      onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                      className="min-w-0 flex-1"
                    />
                    {symbolOptions && symbolOptions.length > 0 ? (
                      <Select
                        aria-label="Pick a known symbol"
                        value=""
                        onChange={(event) => {
                          if (event.target.value) setSymbol(event.target.value);
                        }}
                        className="max-w-[10rem]"
                      >
                        <option value="">Pick…</option>
                        {symbolOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                  </div>
                ) : (
                  <Select
                    id="tradelens-symbol"
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value)}
                  >
                    {symbolOptions?.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div>
                <Label>Timeframe</Label>
                <ChipRow ariaLabel="Timeframe">
                  {timeframes.map((entry) => (
                    <Chip key={entry.id} active={timeframe === entry.id} onClick={() => setTimeframe(entry.id)}>
                      {entry.label}
                    </Chip>
                  ))}
                </ChipRow>
              </div>
            </div>

            <div className="flex items-end">
              <Button onClick={() => void load()} disabled={busy} className="w-full sm:w-auto">
                {busy ? "Loading…" : series ? "Reload chart" : "Load chart"}
              </Button>
            </div>
          </div>
        ) : (
          <FileDrop
            onFiles={(files) => void importCsv(files)}
            accept=".csv,.txt,text/csv,text/plain"
            multiple={false}
            title="Drop a price history CSV here"
            icon="📈"
            hint="Date, open, high, low, close, volume. Read in your browser — nothing is uploaded."
            disabled={busy}
          />
        )}

        {error ? <ErrorState message={error} /> : null}

        {notes.length > 0 ? (
          <ul className="space-y-1 rounded-2xl border-2 border-[var(--sky)] bg-[var(--sky-soft)] px-4 py-3">
            {notes.map((note) => (
              <li key={note} className="text-xs font-semibold">
                • {note}
              </li>
            ))}
          </ul>
        ) : null}

        {series ? (
          <p className="text-xs font-semibold text-[var(--muted)]">
            <strong className="text-[var(--ink)]">{series.source}.</strong> {series.sourceNote}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
