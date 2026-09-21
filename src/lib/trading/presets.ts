/**
 * Starting points.
 *
 * A preset is an opinion about which rules matter for a particular market and
 * speed — not a recommendation, and certainly not a setting anyone should
 * trade because a web page shipped with it. Each one says what it is trying to
 * catch and what it is bad at, because every set of rules is bad at something,
 * and a preset that admits it is more useful than one that does not.
 */

import type { ExecutionConfig } from "./backtest";
import { DEFAULT_PARAMS, type StrategyParams } from "./strategy";
import type { Timeframe } from "./types";

export interface Preset {
  id: string;
  label: string;
  /** What this set of rules is trying to catch. */
  intent: string;
  /** Where it will do badly. Always filled in. */
  weakness: string;
  /** The timeframe it was written for. It will still run on any other. */
  designedFor: Timeframe;
  gold: boolean;
  params: StrategyParams;
  execution: Partial<ExecutionConfig>;
}

export const PRESETS: Preset[] = [
  {
    id: "gold-swing",
    label: "Gold swing — trend with the higher timeframe",
    intent:
      "Holds with the 4-hour trend and enters on hourly confirmation. Built for gold's habit of trending hard for days once a move starts.",
    weakness:
      "It gives back a chunk of every move waiting for confirmation, and it is repeatedly stopped out in the weeks gold spends chopping in a range.",
    designedFor: "1h",
    gold: true,
    params: {
      ...DEFAULT_PARAMS,
      fastMa: 21,
      slowMa: 50,
      trendMa: 50,
      htfSteps: 2,
      requireHtfAgreement: true,
      adxMinimum: 20,
      minScore: 60,
      weights: { htfTrend: 3, structure: 3, maCross: 2, rsi: 1, macd: 2, bollinger: 0, breakout: 1, levels: 1, momentum: 1 },
    },
    execution: { stopMode: "atr", atrMultiple: 2, targetMode: "rr", riskReward: 2.5, spreadPips: 30, riskPercent: 1 },
  },
  {
    id: "gold-breakout",
    label: "Gold intraday breakout — London and New York",
    intent:
      "Waits for a 15-minute close outside the recent range with volatility behind it. Aimed at the London open and the New York overlap, when gold does most of its daily range.",
    weakness:
      "Breakouts fail often, and this one will take every false break in a quiet Asian session. The ADX filter is doing a lot of work; without it the results fall apart.",
    designedFor: "15m",
    gold: true,
    params: {
      ...DEFAULT_PARAMS,
      fastMa: 9,
      slowMa: 21,
      trendMa: 50,
      donchianPeriod: 24,
      adxMinimum: 22,
      htfSteps: 2,
      requireHtfAgreement: false,
      minScore: 58,
      weights: { htfTrend: 2, structure: 1, maCross: 1, rsi: 0, macd: 1, bollinger: 2, breakout: 3, levels: 1, momentum: 2 },
    },
    execution: { stopMode: "atr", atrMultiple: 1.5, targetMode: "rr", riskReward: 2, spreadPips: 30, riskPercent: 0.5, maxBarsInTrade: 40 },
  },
  {
    id: "gold-pullback",
    label: "Gold pullback — buy the dip inside an uptrend",
    intent:
      "Only trades with the higher-timeframe trend, and only after RSI has dipped and turned back. Tries to enter where the stop can sit behind a swing rather than miles away.",
    weakness:
      "It misses the start of every new trend by design, and in a real reversal it keeps buying dips that keep getting deeper.",
    designedFor: "1h",
    gold: true,
    params: {
      ...DEFAULT_PARAMS,
      fastMa: 21,
      slowMa: 50,
      rsiOversold: 40,
      rsiOverbought: 60,
      htfSteps: 2,
      requireHtfAgreement: true,
      adxMinimum: 18,
      minScore: 62,
      weights: { htfTrend: 3, structure: 2, maCross: 1, rsi: 3, macd: 1, bollinger: 0, breakout: 0, levels: 2, momentum: 0 },
    },
    execution: { stopMode: "swing", atrMultiple: 2, targetMode: "rr", riskReward: 2, spreadPips: 30, riskPercent: 1 },
  },
  {
    id: "forex-trend",
    label: "Forex trend following",
    intent: "The balanced default, written for major pairs on the hourly and 4-hour charts.",
    weakness: "Nothing about it is tuned to any particular pair, and it trades too often in a range.",
    designedFor: "1h",
    gold: false,
    params: DEFAULT_PARAMS,
    execution: { stopMode: "atr", atrMultiple: 2, targetMode: "rr", riskReward: 2, spreadPips: 1, riskPercent: 1 },
  },
  {
    id: "confluence",
    label: "Strict confluence — rare signals only",
    intent:
      "Every rule on, a high agreement threshold and higher-timeframe agreement required. Produces very few signals, which is the point.",
    weakness:
      "Few trades means the statistics stay unreliable for a long time, and by the time everything agrees the move is often half over.",
    designedFor: "4h",
    gold: false,
    params: {
      ...DEFAULT_PARAMS,
      requireHtfAgreement: true,
      adxMinimum: 22,
      minScore: 75,
      weights: { htfTrend: 3, structure: 2, maCross: 2, rsi: 2, macd: 2, bollinger: 1, breakout: 2, levels: 2, momentum: 1 },
    },
    execution: { stopMode: "atr", atrMultiple: 2.5, targetMode: "rr", riskReward: 3, riskPercent: 1 },
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
