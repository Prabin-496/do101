/**
 * Frankfurter — the European Central Bank's published reference rates.
 *
 * Free, no key, no rate limit worth worrying about, and browser requests are
 * allowed, which is why it is the default. What it is *not* is a tick feed:
 * the ECB publishes one reference rate per working day, around 16:00 CET. So
 * every bar here is a single closing price, the series is flagged close-only,
 * and the backtester refuses to pretend it can test an intrabar stop on it.
 */

import { getInstrument, type Candle, type Series } from "../types";
import { getJson, MarketDataError, type AdapterSymbol, type FetchOptions, type MarketAdapter } from "./types";

const BASE = "https://api.frankfurter.dev/v1";

const SYMBOLS: AdapterSymbol[] = [
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
  { id: "EUR/CHF", label: "EUR/CHF", instrumentId: "EURCHF" },
  { id: "AUD/JPY", label: "AUD/JPY", instrumentId: "AUDJPY" },
];

export function frankfurterUrl(symbol: string, years: number, today = new Date()): string {
  const [base, quote] = symbol.split("/");
  const start = new Date(today);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return `${BASE}/${iso(start)}..${iso(today)}?base=${base}&symbols=${quote}`;
}

export interface FrankfurterResponse {
  base: string;
  rates: Record<string, Record<string, number>>;
}

export function parseFrankfurter(data: unknown, symbol: string): Candle[] {
  const payload = data as Partial<FrankfurterResponse>;
  if (!payload || typeof payload !== "object" || !payload.rates) {
    throw new MarketDataError("The reference-rate service returned something this tool could not read.");
  }
  const quote = symbol.split("/")[1];
  const rows = Object.entries(payload.rates)
    .map(([date, rates]) => ({ date, rate: rates?.[quote] }))
    .filter((r): r is { date: string; rate: number } => typeof r.rate === "number")
    .sort((a, b) => a.date.localeCompare(b.date));

  // One published rate per day: it is the close, and the open, high and low
  // are set to it rather than invented.
  return rows.map((row) => ({
    time: Date.parse(`${row.date}T00:00:00Z`),
    open: row.rate,
    high: row.rate,
    low: row.rate,
    close: row.rate,
    volume: null,
  }));
}

export const frankfurterAdapter: MarketAdapter = {
  id: "frankfurter",
  name: "ECB reference rates",
  blurb: "The daily reference rates published by the European Central Bank, served by the free Frankfurter API.",
  limits: "No key and no published rate limit. One price per working day — no intraday bars, and no gold.",
  home: "https://frankfurter.dev/",
  needsKey: false,
  closeOnly: true,
  timeframes: ["1d"],
  symbols: SYMBOLS,
  async fetchSeries({ symbol, signal }: FetchOptions): Promise<Series> {
    const candles = parseFrankfurter(await getJson(frankfurterUrl(symbol, 6), signal), symbol);
    if (candles.length < 30) {
      throw new MarketDataError("Too few published rates came back to analyse. Try another pair.");
    }
    const instrument = SYMBOLS.find((s) => s.id === symbol);
    return {
      symbol,
      instrumentId: getInstrument(instrument?.instrumentId ?? "GENERIC").id,
      timeframe: "1d",
      candles,
      closeOnly: true,
      source: "ECB reference rates via Frankfurter",
      sourceNote:
        "One official reference rate per working day, published by the ECB around 16:00 CET. It is a real, citable price — but it is not a tradeable quote, there are no intraday bars, and there is no high or low, so stops cannot be tested against it.",
      fetchedAt: Date.now(),
    };
  },
};

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
