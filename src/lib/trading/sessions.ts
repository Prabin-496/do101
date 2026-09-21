/**
 * When gold actually moves.
 *
 * Gold's day is not flat: the metal is quiet through the Asian session and
 * does most of its work once London is open, with the widest ranges in the
 * London–New York overlap. That is the single most useful piece of context for
 * an intraday gold strategy, and it is also the easiest thing in the world to
 * assert without evidence — so this module asserts nothing. Every number here
 * is measured from the bars the visitor has actually loaded, and the panel
 * says how many bars each average rests on.
 */

import { instrumentOf, type Candle, type Series } from "./types";

export interface SessionWindow {
  id: string;
  label: string;
  /** Inclusive start hour and exclusive end hour, UTC. */
  from: number;
  to: number;
  blurb: string;
}

/**
 * The blurbs say what each window *is*, never how it behaves. How it behaves
 * is the measured column next to them, which is free to disagree with any
 * received wisdom — and on a 24/7 proxy instrument it often does.
 */
export const SESSIONS: SessionWindow[] = [
  { id: "asia", label: "Asia", from: 0, to: 7, blurb: "Tokyo and Sydney trading hours." },
  { id: "london", label: "London", from: 7, to: 12, blurb: "European desks open." },
  { id: "overlap", label: "London + New York", from: 12, to: 16, blurb: "Both open at once, and most US data lands." },
  { id: "newyork", label: "New York", from: 16, to: 21, blurb: "London has closed; US desks carry the session." },
  { id: "late", label: "Late / rollover", from: 21, to: 24, blurb: "Thin books around the daily rollover." },
];

export interface SessionStat {
  session: SessionWindow;
  bars: number;
  /** Mean high−low of the bars in this window, in price. */
  averageRange: number;
  /** The same as a percentage of price, so timeframes can be compared. */
  averageRangePercent: number;
  /** Share of bars that closed higher than they opened, 0–1. */
  upShare: number;
  /** This window's average range over the all-day average. 1 is typical. */
  relative: number;
}

export interface SessionAnalysis {
  stats: SessionStat[];
  byHour: { hour: number; averageRange: number; bars: number }[];
  busiest: SessionStat | null;
  quietest: SessionStat | null;
  /** Mean daily high−low over the loaded history, in price. */
  averageDailyRange: number | null;
  daysCovered: number;
  /** True when the timeframe is too coarse for any of this to mean anything. */
  tooCoarse: boolean;
}

export function analyseSessions(series: Series): SessionAnalysis {
  const coarse = series.timeframe === "1d" || series.timeframe === "1w";
  const candles = series.candles;

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, averageRange: 0, bars: 0 }));
  if (!coarse) {
    const totals = new Array(24).fill(0);
    for (const candle of candles) {
      const hour = new Date(candle.time).getUTCHours();
      totals[hour] += candle.high - candle.low;
      byHour[hour].bars += 1;
    }
    for (let hour = 0; hour < 24; hour++) {
      byHour[hour].averageRange = byHour[hour].bars ? totals[hour] / byHour[hour].bars : 0;
    }
  }

  const allRanges = candles.map((c) => c.high - c.low);
  const meanRange = allRanges.length ? allRanges.reduce((a, b) => a + b, 0) / allRanges.length : 0;
  const meanPrice = candles.length ? candles.reduce((a, c) => a + c.close, 0) / candles.length : 0;

  const stats: SessionStat[] = coarse
    ? []
    : SESSIONS.map((session) => {
        const inWindow = candles.filter((c) => {
          const hour = new Date(c.time).getUTCHours();
          return hour >= session.from && hour < session.to;
        });
        const range = inWindow.length
          ? inWindow.reduce((a, c) => a + (c.high - c.low), 0) / inWindow.length
          : 0;
        const ups = inWindow.filter((c) => c.close > c.open).length;
        return {
          session,
          bars: inWindow.length,
          averageRange: range,
          averageRangePercent: meanPrice > 0 ? (range / meanPrice) * 100 : 0,
          upShare: inWindow.length ? ups / inWindow.length : 0,
          relative: meanRange > 0 ? range / meanRange : 0,
        };
      }).filter((s) => s.bars > 0);

  const ranked = [...stats].sort((a, b) => b.averageRange - a.averageRange);

  const daily = dailyRanges(candles);
  return {
    stats,
    byHour,
    busiest: ranked[0] ?? null,
    quietest: ranked.at(-1) ?? null,
    averageDailyRange: daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : null,
    daysCovered: daily.length,
    tooCoarse: coarse,
  };
}

/** High minus low for each UTC day present in the data. */
function dailyRanges(candles: Candle[]): number[] {
  const days = new Map<string, { high: number; low: number }>();
  for (const candle of candles) {
    const key = new Date(candle.time).toISOString().slice(0, 10);
    const day = days.get(key);
    if (!day) days.set(key, { high: candle.high, low: candle.low });
    else {
      day.high = Math.max(day.high, candle.high);
      day.low = Math.min(day.low, candle.low);
    }
  }
  return [...days.values()].map((d) => d.high - d.low);
}

/**
 * The average daily range expressed in pips, which is the form a stop-loss
 * setting is actually chosen in.
 */
export function dailyRangeInPips(series: Series, averageDailyRange: number | null): number | null {
  if (averageDailyRange === null) return null;
  const instrument = instrumentOf(series);
  return instrument.pip > 0 ? averageDailyRange / instrument.pip : null;
}
