/**
 * Turning a signal into levels you could measure a trade against.
 *
 * This is arithmetic on the signal, not advice: an entry *zone* rather than a
 * price, because a rule engine reading a closed bar cannot know what the next
 * tick will be; a stop from the same ATR or swing the backtest would have
 * used, so the numbers on screen are the numbers that were tested; and
 * targets at whole multiples of the risk, plus the nearest level price
 * actually turned at, which is usually the more honest of the two.
 */

import { stopDistanceFor, targetDistanceFor, type ExecutionConfig } from "./backtest";
import { bracketing } from "./levels";
import { sizePosition, rewardProfile, type SizingResult } from "./risk";
import type { Signal } from "./strategy";
import { instrumentOf, type Series } from "./types";

export interface TradePlan {
  direction: "long" | "short";
  /** The zone the signal was generated in, not an order price. */
  entryLow: number;
  entryHigh: number;
  reference: number;
  stop: number;
  stopDistance: number;
  stopPips: number;
  target: number;
  targetPips: number;
  /** One, two and three times the risk taken. */
  rLevels: { r: number; price: number }[];
  /** The nearest confirmed level in the trade's favour, if there is one. */
  structureTarget: number | null;
  riskReward: number | null;
  breakEvenWinRate: number | null;
  sizing: SizingResult;
  potentialProfit: number;
  potentialLoss: number;
}

export function buildPlan(
  signal: Signal,
  series: Series,
  execution: ExecutionConfig,
  balance: number,
): TradePlan | null {
  if (signal.verdict === "neutral") return null;
  const instrument = instrumentOf(series);
  const direction = signal.verdict === "buy" ? "long" : "short";
  const isLong = direction === "long";
  const reference = signal.close;

  // A strategy that sets its own stop is shown with that stop. Substituting the
  // execution settings' ATR stop here would describe a different trade from
  // the one the rules produced.
  const rules = signal.stopHint !== null && signal.stopHint !== undefined ? { ...execution, stopMode: "signal" as const } : execution;
  const stopDistance = stopDistanceFor(signal, reference, instrument, rules);
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) return null;

  const stop = isLong ? reference - stopDistance : reference + stopDistance;
  const targetDistance = targetDistanceFor(signal, stopDistance, instrument, rules);
  const target = isLong ? reference + targetDistance : reference - targetDistance;

  // The zone is a quarter of the stop distance either side of the close: wide
  // enough to be reachable, small enough that the risk arithmetic still holds.
  const halfZone = stopDistance * 0.25;

  const sizing = sizePosition({
    balance,
    riskPercent: execution.riskPercent,
    entry: reference,
    stop,
    instrument,
    leverage: execution.leverage,
    quoteToAccountRate: execution.quoteToAccountRate,
    roundLots: execution.roundLots,
    minLot: 0.01,
    lotStep: 0.01,
  });

  const reward = rewardProfile(reference, stop, target, sizing.units, execution.quoteToAccountRate);
  const { above, below } = bracketing(signal.levels, reference);
  const structure = isLong ? above?.price ?? null : below?.price ?? null;

  return {
    direction,
    entryLow: isLong ? reference - halfZone : reference,
    entryHigh: isLong ? reference : reference + halfZone,
    reference,
    stop,
    stopDistance,
    stopPips: stopDistance / instrument.pip,
    target,
    targetPips: targetDistance / instrument.pip,
    rLevels: [1, 2, 3].map((r) => ({
      r,
      price: isLong ? reference + stopDistance * r : reference - stopDistance * r,
    })),
    structureTarget: structure,
    riskReward: reward.ratio,
    breakEvenWinRate: reward.breakEvenWinRate,
    sizing,
    potentialProfit: reward.potentialProfit,
    potentialLoss: reward.potentialLoss,
  };
}
