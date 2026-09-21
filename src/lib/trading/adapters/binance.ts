/**
 * Binance — free, keyless, CORS-open intraday OHLCV.
 *
 * The honesty problem is the instruments. Binance does not list spot FX or
 * spot gold: the closest things are EUR/USDT, and PAXG and XAUT, two tokens
 * each backed by a troy ounce of gold. They track the underlying closely and
 * they are real traded markets with real volume — but they are not the
 * interbank quotes a forex account deals at, they trade at weekends when the
 * forex market is shut, and they carry their own premium and discount.
 *
 * That is a fair trade for practising strategy mechanics on real intraday
 * bars, and a bad one for concluding anything about a broker's XAU/USD feed.
 * Both halves of that are said on the page rather than buried here.
 */

import type { Candle, Series, Timeframe } from "../types";
import { getJson, MarketDataError, type AdapterSymbol, type FetchOptions, type MarketAdapter } from "./types";

const BASE = "https://api.binance.com/api/v3/klines";

const INTERVALS: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

const SYMBOLS: AdapterSymbol[] = [
  {
    id: "PAXGUSDT",
    label: "PAXG/USDT — gold proxy",
    instrumentId: "XAUUSD",
    note: "PAX Gold: one token is backed by one troy ounce of London Good Delivery gold. It tracks spot gold closely, but it is not XAU/USD.",
  },
  {
    id: "XAUTUSDT",
    label: "XAUT/USDT — gold proxy",
    instrumentId: "XAUUSD",
    note: "Tether Gold, also backed one token to one troy ounce. A second gold proxy, useful for cross-checking PAXG.",
  },
  {
    id: "EURUSDT",
    label: "EUR/USDT — EUR/USD proxy",
    instrumentId: "EURUSD",
    note: "Euro against a dollar stablecoin. It shadows EUR/USD but trades on a crypto venue, at weekends, with its own liquidity.",
  },
];

export function binanceUrl(symbol: string, timeframe: Timeframe, limit: number): string {
  const interval = INTERVALS[timeframe] ?? "1h";
  return `${BASE}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${Math.min(1000, Math.max(50, limit))}`;
}

/** Binance returns arrays: [openTime, open, high, low, close, volume, ...]. */
export function parseBinance(data: unknown): Candle[] {
  if (!Array.isArray(data)) {
    throw new MarketDataError("The exchange returned something this tool could not read.");
  }
  const candles: Candle[] = [];
  for (const row of data as unknown[]) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const time = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    if (![time, open, high, low, close].every(Number.isFinite)) continue;
    candles.push({ time, open, high, low, close, volume: Number.isFinite(volume) ? volume : null });
  }
  return candles;
}

export const binanceAdapter: MarketAdapter = {
  id: "binance",
  name: "Binance (gold-token and EUR proxies)",
  blurb: "Real intraday OHLC with volume, from a public exchange endpoint that needs no key.",
  limits: "No key. Shared IP rate limits apply, and up to 1,000 bars per request. Instruments are proxies, not interbank FX or spot XAU/USD.",
  home: "https://www.binance.com/",
  needsKey: false,
  closeOnly: false,
  timeframes: ["5m", "15m", "30m", "1h", "4h", "1d", "1w"],
  symbols: SYMBOLS,
  async fetchSeries({ symbol, timeframe, limit = 1000, signal }: FetchOptions): Promise<Series> {
    const entry = SYMBOLS.find((s) => s.id === symbol) ?? SYMBOLS[0];
    const candles = parseBinance(await getJson(binanceUrl(symbol, timeframe, limit), signal));
    if (candles.length < 50) throw new MarketDataError("Too few bars came back to analyse.");
    return {
      symbol: entry.label.split(" — ")[0],
      instrumentId: entry.instrumentId,
      timeframe,
      candles,
      closeOnly: false,
      source: `Binance ${symbol}`,
      sourceNote: `${entry.note ?? ""} Volume is exchange volume for this instrument, and it trades 24/7, so weekend bars exist where a forex chart has a gap.`.trim(),
      fetchedAt: Date.now(),
    };
  },
};
