/**
 * Alpha Vantage — a second optional source, on the visitor's own free key.
 *
 * Kept because it is the best-known free forex endpoint and many people
 * already have a key. The free tier is small enough that it suits loading a
 * daily series once rather than flipping between charts, and its FX functions
 * cover currencies only — gold is not available through them.
 */

import { guessInstrument, type Candle, type Series, type Timeframe } from "../types";
import { getJson, MarketDataError, type AdapterSymbol, type FetchOptions, type MarketAdapter } from "./types";

const BASE = "https://www.alphavantage.co/query";

const SYMBOLS: AdapterSymbol[] = [
  { id: "EUR/USD", label: "EUR/USD", instrumentId: "EURUSD" },
  { id: "GBP/USD", label: "GBP/USD", instrumentId: "GBPUSD" },
  { id: "USD/JPY", label: "USD/JPY", instrumentId: "USDJPY" },
  { id: "USD/CHF", label: "USD/CHF", instrumentId: "USDCHF" },
  { id: "AUD/USD", label: "AUD/USD", instrumentId: "AUDUSD" },
  { id: "USD/CAD", label: "USD/CAD", instrumentId: "USDCAD" },
  { id: "EUR/GBP", label: "EUR/GBP", instrumentId: "EURGBP" },
  { id: "EUR/JPY", label: "EUR/JPY", instrumentId: "EURJPY" },
];

const INTRADAY: Partial<Record<Timeframe, string>> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "60min",
};

export function alphaVantageUrl(symbol: string, timeframe: Timeframe, apiKey: string): string {
  const [from, to] = symbol.split("/");
  const params = new URLSearchParams({ from_symbol: from, to_symbol: to, apikey: apiKey, outputsize: "full" });
  const intraday = INTRADAY[timeframe];
  if (intraday) {
    params.set("function", "FX_INTRADAY");
    params.set("interval", intraday);
  } else {
    params.set("function", timeframe === "1w" ? "FX_WEEKLY" : "FX_DAILY");
  }
  return `${BASE}?${params.toString()}`;
}

export function parseAlphaVantage(data: unknown): Candle[] {
  const payload = data as Record<string, unknown>;
  if (typeof payload?.["Error Message"] === "string") {
    throw new MarketDataError(String(payload["Error Message"]));
  }
  // The free tier answers an exceeded quota with a "Note", not an error code.
  if (typeof payload?.Note === "string" || typeof payload?.Information === "string") {
    throw new MarketDataError(
      "Alpha Vantage says the free daily quota for this key is used up. It resets at midnight US Eastern time — until then, use another source or a CSV file.",
    );
  }
  const seriesKey = Object.keys(payload ?? {}).find((k) => k.toLowerCase().includes("time series"));
  if (!seriesKey) throw new MarketDataError("Alpha Vantage returned no price series for that pair.");

  const rows = payload[seriesKey] as Record<string, Record<string, string>>;
  const candles: Candle[] = [];
  for (const [stamp, row] of Object.entries(rows ?? {})) {
    const time = Date.parse(stamp.includes(" ") ? `${stamp.replace(" ", "T")}Z` : `${stamp}T00:00:00Z`);
    const open = Number(row["1. open"]);
    const high = Number(row["2. high"]);
    const low = Number(row["3. low"]);
    const close = Number(row["4. close"]);
    if (!Number.isFinite(time) || ![open, high, low, close].every(Number.isFinite)) continue;
    candles.push({ time, open, high, low, close, volume: null });
  }
  return candles.sort((a, b) => a.time - b.time);
}

export const alphaVantageAdapter: MarketAdapter = {
  id: "alphavantage",
  name: "Alpha Vantage (your own free key)",
  blurb: "Forex OHLC bars, daily and intraday. Currencies only — its FX endpoints do not cover gold.",
  limits: "Free tier: 25 requests a day at the time of writing, resetting at midnight US Eastern. Enough to load a chart a few times, not to flip between symbols.",
  home: "https://www.alphavantage.co/support/#api-key",
  keyUrl: "https://www.alphavantage.co/support/#api-key",
  needsKey: true,
  closeOnly: false,
  timeframes: ["5m", "15m", "30m", "1h", "1d", "1w"],
  symbols: SYMBOLS,
  async fetchSeries({ symbol, timeframe, apiKey, signal }: FetchOptions): Promise<Series> {
    if (!apiKey) throw new MarketDataError("Add your own free Alpha Vantage key to use this source.");
    const candles = parseAlphaVantage(await getJson(alphaVantageUrl(symbol, timeframe, apiKey), signal));
    if (candles.length < 50) throw new MarketDataError("Too few bars came back to analyse.");
    const known = SYMBOLS.find((s) => s.id === symbol);
    return {
      symbol,
      instrumentId: known?.instrumentId ?? guessInstrument(symbol).id,
      timeframe,
      candles,
      closeOnly: false,
      source: `Alpha Vantage ${symbol}`,
      sourceNote:
        "Fetched with your own key, from your browser straight to Alpha Vantage — the key never passes through DO101. No volume is published for spot FX, so the volume pane stays empty.",
      fetchedAt: Date.now(),
    };
  },
};
