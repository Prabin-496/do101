/**
 * The strategies TradeLens can run, and how to build one.
 *
 * Two of them, deliberately different in shape:
 *
 *  - The weighted engine, where every rule votes and the score is agreement.
 *    Forgiving, always has an opinion, and easy to over-read.
 *  - Deep Smart Money, where a stack of filters must all pass before any of
 *    four triggers counts. Unforgiving, silent most of the time, and it sets
 *    its own stop.
 *
 * Neither is the "better" one, and the pair is more useful than either alone:
 * running the same market through both shows how much of a result comes from
 * the market and how much from the shape of the rules.
 */

import { DEFAULT_SMART_MONEY, smartMoneyEngine, type SmartMoneyParams } from "./smart-money";
import { DEFAULT_PARAMS, weightedEngine, type SignalEngine, type StrategyParams } from "./strategy";
import type { Series } from "./types";

export type EngineId = "weighted" | "smart-money";

export interface EngineSettings {
  engine: EngineId;
  weighted: StrategyParams;
  smartMoney: SmartMoneyParams;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  engine: "weighted",
  weighted: DEFAULT_PARAMS,
  smartMoney: DEFAULT_SMART_MONEY,
};

export const ENGINE_META: Record<EngineId, { label: string; shape: string; blurb: string; caveat: string }> = {
  weighted: {
    label: "Weighted rules",
    shape: "Every rule votes; the score is how much they agree.",
    blurb:
      "Nine indicators each vote bullish, bearish or neither, weighted however you like. It always has a reading, which makes it good for understanding a chart and easy to over-trade.",
    caveat:
      "Because nothing is a veto, a strong majority can carry a signal straight through a market that is going nowhere. The ADX and volatility cautions exist for exactly that.",
  },
  "smart-money": {
    label: "Deep Smart Money",
    shape: "Every filter must pass, then one of four triggers must fire.",
    blurb:
      "A regime filter, a trend filter, volume, candle strength, RSI and a cooldown all have to hold. Then it takes an order-block reclaim, an EMA cross, a box breakout or a liquidity sweep. It sets its own stop at the signal bar's extreme.",
    caveat:
      "Six filters in series means it is silent for long stretches, and a backtest of it will have few trades — which is exactly when statistics are least trustworthy. Its stop can also be very tight, so watch what that does to position size.",
  },
};

export function makeEngine(series: Series, settings: EngineSettings): SignalEngine {
  return settings.engine === "smart-money"
    ? smartMoneyEngine(series, settings.smartMoney)
    : weightedEngine(series, settings.weighted);
}
