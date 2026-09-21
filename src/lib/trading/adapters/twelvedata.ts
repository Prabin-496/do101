/**
 * Twelve Data — optional, and only with the visitor's own free key.
 *
 * This is the one source here that returns genuine XAU/USD and interbank-style
 * forex bars intraday. It needs a key, so it is optional by construction: the
 * key is typed by the visitor, kept in their browser's local storage, and sent
 * from their browser straight to Twelve Data. It never reaches DO101, and no
 * key ships inside this application.
 */

import { guessInstrument, type Candle, type Series, type Timeframe } from "../types";
import { getJson, MarketDataError, type AdapterSymbol, type FetchOptions, type MarketAdapter } from "./types";

const BASE = "https://api.twelvedata.com/time_series";

const INTERVALS: Record<Timeframe, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
};

const SYMBOLS: AdapterSymbol[] = [
  { id: "XAU/USD", label: "XAU/USD — gold", instrumentId: "XAUUSD" },
  { id: "XAG/USD", label: "XAG/USD — silver", instrumentId: "XAGUSD" },
  { id: "EUR/USD", label: "EUR/USD", instrumentId: "EURUSD" },
  { id: "GBP/USD", label: "GBP/USD", instrumentId: "GBPUSD" },
  { id: "USD/JPY", label: "USD/JPY", instrumentId: "USDJPY" },
  { id: "USD/CHF", label: "USD/CHF", instrumentId: "USDCHF" },
  { id: "AUD/USD", label: "AUD/USD", instrumentId: "AUDUSD" },
  { id: "NZD/USD", label: "NZD/USD", instrumentId: "NZDUSD" },
  { id: "USD/CAD", label: "USD/CAD", instrumentId: "USDCAD" },
  { id: "EUR/GBP", label: "EUR/GBP", instrumentId: "EURGBP" },
  { id: "EUR/JPY", label: "EUR/JPY", instrumentId: "EURJPY" },
  { id: "GBP/JPY", label: "GBP/JPY", instrumentId: "GBPJPY" },
];

export function twelveDataUrl(symbol: string, timeframe: Timeframe, size: number, apiKey: string): string {
  const interval = INTERVALS[timeframe] ?? "1h";
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(Math.min(5000, Math.max(50, size))),
    format: "JSON",
    apikey: apiKey,
  });
  return `${BASE}?${params.toString()}`;
}

interface TwelveValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

export function parseTwelveData(data: unknown): Candle[] {
  const payload = data as { status?: string; message?: string; values?: TwelveValue[] };
  if (payload?.status === "error") {
    throw new MarketDataError(payload.message ?? "Twelve Data rejected that request.");
  }
  if (!payload?.values || !Array.isArray(payload.values)) {
    throw new MarketDataError("Twelve Data returned no price rows for that symbol and interval.");
  }
  const candles: Candle[] = [];
  for (const value of payload.values) {
    // Datetimes come back either as a date or as a date and time, in UTC.
    const time = Date.parse(value.datetime.includes(" ") ? `${value.datetime.replace(" ", "T")}Z` : `${value.datetime}T00:00:00Z`);
    const open = Number(value.open);
    const high = Number(value.high);
    const low = Number(value.low);
    const close = Number(value.close);
    if (!Number.isFinite(time) || ![open, high, low, close].every(Number.isFinite)) continue;
    const volume = value.volume === undefined ? null : Number(value.volume);
    candles.push({ time, open, high, low, close, volume: volume !== null && Number.isFinite(volume) && volume > 0 ? volume : null });
  }
  // Newest first on the wire; charts and indicators want oldest first.
  return candles.sort((a, b) => a.time - b.time);
}

export const twelveDataAdapter: MarketAdapter = {
  id: "twelvedata",
  name: "Twelve Data (your own free key)",
  blurb: "Genuine XAU/USD and forex OHLC bars, intraday and daily. The only source here that covers spot gold properly.",
  limits: "Free tier: 800 requests a day and 8 a minute, at the time of writing. One chart load is one request. Check the current limits before relying on it.",
  home: "https://twelvedata.com/pricing",
  keyUrl: "https://twelvedata.com/register",
  needsKey: true,
  closeOnly: false,
  timeframes: ["5m", "15m", "30m", "1h", "4h", "1d", "1w"],
  symbols: SYMBOLS,
  freeform: true,
  async fetchSeries({ symbol, timeframe, limit = 2000, apiKey, signal }: FetchOptions): Promise<Series> {
    if (!apiKey) throw new MarketDataError("Add your own free Twelve Data key to use this source.");
    const candles = parseTwelveData(await getJson(twelveDataUrl(symbol, timeframe, limit, apiKey), signal));
    if (candles.length < 50) throw new MarketDataError("Too few bars came back to analyse. Try a longer timeframe.");
    const known = SYMBOLS.find((s) => s.id === symbol);
    return {
      symbol,
      instrumentId: known?.instrumentId ?? guessInstrument(symbol).id,
      timeframe,
      candles,
      closeOnly: false,
      source: `Twelve Data ${symbol}`,
      sourceNote:
        "Fetched with your own key, from your browser straight to Twelve Data — the key never passes through DO101. Spot FX and metals have no central exchange, so these bars are one aggregator's view and will differ slightly from your broker's.",
      fetchedAt: Date.now(),
    };
  },
};
