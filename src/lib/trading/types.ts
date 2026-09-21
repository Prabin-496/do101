/**
 * Shared shapes for TradeLens.
 *
 * Everything downstream — indicators, the strategy engine, the backtester and
 * the paper account — works on a `Series`, so a CSV file a visitor exported
 * from their own platform and a response from a free public API are the same
 * thing by the time any analysis touches them.
 */

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export interface TimeframeMeta {
  id: Timeframe;
  label: string;
  /** Length of one bar in milliseconds. Used for gap detection and aggregation. */
  ms: number;
}

export const TIMEFRAMES: TimeframeMeta[] = [
  { id: "1m", label: "1 min", ms: 60_000 },
  { id: "5m", label: "5 min", ms: 5 * 60_000 },
  { id: "15m", label: "15 min", ms: 15 * 60_000 },
  { id: "30m", label: "30 min", ms: 30 * 60_000 },
  { id: "1h", label: "1 hour", ms: 60 * 60_000 },
  { id: "4h", label: "4 hours", ms: 4 * 60 * 60_000 },
  { id: "1d", label: "1 day", ms: 24 * 60 * 60_000 },
  { id: "1w", label: "1 week", ms: 7 * 24 * 60 * 60_000 },
];

export const TIMEFRAME_MS: Record<Timeframe, number> = Object.fromEntries(
  TIMEFRAMES.map((t) => [t.id, t.ms]),
) as Record<Timeframe, number>;

export function timeframeLabel(tf: Timeframe): string {
  return TIMEFRAMES.find((t) => t.id === tf)?.label ?? tf;
}

/** One bar. `volume` is null when the source does not publish it — never zero-filled. */
export interface Candle {
  /** Bar open time, epoch milliseconds, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/**
 * A loaded price history plus the honesty attached to it: where it came from,
 * and whether the bars are real OHLC or a close-only series.
 */
export interface Series {
  /** Display symbol, e.g. "XAU/USD". */
  symbol: string;
  /** Key into INSTRUMENTS, so pip size and contract size are known. */
  instrumentId: string;
  timeframe: Timeframe;
  candles: Candle[];
  /**
   * True when the source publishes one price per period rather than a real
   * open/high/low/close. Stops and targets cannot be tested honestly on such
   * a series, so the backtester refuses intrabar fills and says why.
   */
  closeOnly: boolean;
  /** Human label for the source, shown on the chart and in every result. */
  source: string;
  /** The caveat that belongs with this data, shown next to results. */
  sourceNote: string;
  fetchedAt: number;
  /**
   * Contract details sent by the source itself, which beat anything this file
   * can guess. The MetaTrader bridge fills this from the visitor's own broker,
   * so pip size, digits and contract size are that broker's real figures.
   */
  instrument?: Instrument;
  /** Live spread reported by the source, in pips, when it knows one. */
  liveSpreadPips?: number;
}

export type InstrumentKind = "forex" | "metal" | "proxy";

/**
 * Contract specifications.
 *
 * These are the conventional retail-broker values. A broker's own contract
 * size, pip definition and spread differ, which is why every one of them is
 * editable in the risk and backtest panels rather than hard-wired.
 */
export interface Instrument {
  id: string;
  /** Display name, e.g. "EUR/USD". */
  name: string;
  kind: InstrumentKind;
  base: string;
  quote: string;
  /** Decimal places a price is quoted to. */
  digits: number;
  /** Size of one pip in price terms. */
  pip: number;
  /** Units of the base asset in one standard lot. */
  contractSize: number;
  /** A typical retail spread in pips — an assumption, not a quote. */
  typicalSpreadPips: number;
}

export const INSTRUMENTS: Instrument[] = [
  { id: "XAUUSD", name: "XAU/USD", kind: "metal", base: "XAU", quote: "USD", digits: 2, pip: 0.01, contractSize: 100, typicalSpreadPips: 30 },
  { id: "XAGUSD", name: "XAG/USD", kind: "metal", base: "XAG", quote: "USD", digits: 3, pip: 0.001, contractSize: 5000, typicalSpreadPips: 25 },
  { id: "EURUSD", name: "EUR/USD", kind: "forex", base: "EUR", quote: "USD", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1 },
  { id: "GBPUSD", name: "GBP/USD", kind: "forex", base: "GBP", quote: "USD", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1.4 },
  { id: "USDJPY", name: "USD/JPY", kind: "forex", base: "USD", quote: "JPY", digits: 3, pip: 0.01, contractSize: 100_000, typicalSpreadPips: 1 },
  { id: "USDCHF", name: "USD/CHF", kind: "forex", base: "USD", quote: "CHF", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1.5 },
  { id: "AUDUSD", name: "AUD/USD", kind: "forex", base: "AUD", quote: "USD", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1.2 },
  { id: "NZDUSD", name: "NZD/USD", kind: "forex", base: "NZD", quote: "USD", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1.8 },
  { id: "USDCAD", name: "USD/CAD", kind: "forex", base: "USD", quote: "CAD", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1.6 },
  { id: "EURGBP", name: "EUR/GBP", kind: "forex", base: "EUR", quote: "GBP", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1.5 },
  { id: "EURJPY", name: "EUR/JPY", kind: "forex", base: "EUR", quote: "JPY", digits: 3, pip: 0.01, contractSize: 100_000, typicalSpreadPips: 1.6 },
  { id: "GBPJPY", name: "GBP/JPY", kind: "forex", base: "GBP", quote: "JPY", digits: 3, pip: 0.01, contractSize: 100_000, typicalSpreadPips: 2.5 },
  { id: "EURCHF", name: "EUR/CHF", kind: "forex", base: "EUR", quote: "CHF", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1.8 },
  { id: "AUDJPY", name: "AUD/JPY", kind: "forex", base: "AUD", quote: "JPY", digits: 3, pip: 0.01, contractSize: 100_000, typicalSpreadPips: 2 },
  { id: "GENERIC", name: "Imported series", kind: "forex", base: "?", quote: "USD", digits: 5, pip: 0.0001, contractSize: 100_000, typicalSpreadPips: 1 },
];

export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i]),
);

export function getInstrument(id: string): Instrument {
  return INSTRUMENT_MAP[id] ?? INSTRUMENT_MAP.GENERIC;
}

/**
 * Guesses the contract spec from a symbol string, so a CSV named
 * "GBPJPY_H1.csv" lands on the right pip size instead of the generic default.
 */
export function guessInstrument(symbol: string): Instrument {
  const cleaned = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const direct = INSTRUMENTS.find((i) => i.id !== "GENERIC" && cleaned.includes(i.id));
  if (direct) return direct;
  if (/GOLD|XAU/.test(cleaned)) return INSTRUMENT_MAP.XAUUSD;
  if (/SILVER|XAG/.test(cleaned)) return INSTRUMENT_MAP.XAGUSD;
  return INSTRUMENT_MAP.GENERIC;
}

/** The contract spec to use for a series: the source's own, or the table's. */
export function instrumentOf(series: { instrumentId: string; instrument?: Instrument }): Instrument {
  return series.instrument ?? getInstrument(series.instrumentId);
}

export type Direction = "long" | "short";
export type SignalVerdict = "buy" | "sell" | "neutral";
