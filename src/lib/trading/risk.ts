/**
 * Position sizing and risk arithmetic.
 *
 * The same code sizes a backtest trade, a paper trade and the standalone
 * calculator, so the number on the calculator is the number the simulation
 * actually used.
 *
 * Leverage is treated here as what it is: a *ceiling on size*, set by the
 * visitor, that can only ever make a position smaller than the risk limit
 * would allow. Nothing in this file suggests a leverage figure, because the
 * right one depends on facts about a person that a web page does not have.
 */

import type { Instrument } from "./types";

export interface SizingInput {
  balance: number;
  /** Percentage of the balance at stake if the stop is hit. */
  riskPercent: number;
  entry: number;
  stop: number;
  instrument: Instrument;
  /** Maximum leverage the account allows, e.g. 30 for 30:1. */
  leverage: number;
  /**
   * How many units of the account currency one unit of the quote currency is
   * worth. 1 when the pair is quoted in the account currency (most of the
   * time, for a USD account trading XAU/USD or EUR/USD).
   */
  quoteToAccountRate: number;
  /** Brokers deal in lot steps; turning this off gives the raw theoretical size. */
  roundLots: boolean;
  minLot: number;
  lotStep: number;
}

export interface SizingResult {
  /** What the stop costs if it is hit, before it is capped. */
  riskMoney: number;
  stopDistance: number;
  stopPips: number;
  units: number;
  lots: number;
  /** Face value of the position in the account currency. */
  notional: number;
  marginRequired: number;
  /** True when leverage, not the risk limit, decided the size. */
  cappedByLeverage: boolean;
  /** True when even the minimum lot risks more than the limit allows. */
  belowMinimumLot: boolean;
  /** The money actually at risk once the size has been rounded and capped. */
  actualRisk: number;
  actualRiskPercent: number;
  valuePerPipPerLot: number;
  note: string;
}

export const DEFAULT_SIZING = {
  leverage: 30,
  quoteToAccountRate: 1,
  roundLots: true,
  minLot: 0.01,
  lotStep: 0.01,
};

/** What one pip is worth, per standard lot, in the account currency. */
export function valuePerPipPerLot(instrument: Instrument, quoteToAccountRate = 1): number {
  return instrument.contractSize * instrument.pip * quoteToAccountRate;
}

export function priceToPips(distance: number, instrument: Instrument): number {
  return instrument.pip === 0 ? 0 : distance / instrument.pip;
}

export function pipsToPrice(pips: number, instrument: Instrument): number {
  return pips * instrument.pip;
}

export function sizePosition(input: SizingInput): SizingResult {
  const {
    balance, riskPercent, entry, stop, instrument, leverage,
    quoteToAccountRate, roundLots, minLot, lotStep,
  } = input;

  const stopDistance = Math.abs(entry - stop);
  const perPip = valuePerPipPerLot(instrument, quoteToAccountRate);
  const riskMoney = Math.max(0, balance) * (Math.max(0, riskPercent) / 100);

  const base: SizingResult = {
    riskMoney,
    stopDistance,
    stopPips: priceToPips(stopDistance, instrument),
    units: 0,
    lots: 0,
    notional: 0,
    marginRequired: 0,
    cappedByLeverage: false,
    belowMinimumLot: false,
    actualRisk: 0,
    actualRiskPercent: 0,
    valuePerPipPerLot: perPip,
    note: "",
  };

  if (!Number.isFinite(stopDistance) || stopDistance <= 0 || entry <= 0 || riskMoney <= 0) {
    return { ...base, note: "Enter an entry and a stop-loss at different prices to size a position." };
  }

  // Money risked per unit of the base asset = stop distance × the value of one
  // unit of the quote currency.
  const riskPerUnit = stopDistance * quoteToAccountRate;
  let units = riskMoney / riskPerUnit;
  let lots = units / instrument.contractSize;
  let cappedByLeverage = false;

  // Leverage ceiling: the margin a position needs cannot exceed the balance.
  if (leverage > 0) {
    const maxNotional = balance * leverage;
    const maxUnits = maxNotional / (entry * quoteToAccountRate);
    if (units > maxUnits) {
      units = maxUnits;
      lots = units / instrument.contractSize;
      cappedByLeverage = true;
    }
  }

  let belowMinimumLot = false;
  if (roundLots && lotStep > 0) {
    const stepped = Math.floor(lots / lotStep) * lotStep;
    // Rounding down is the conservative direction: it can only reduce risk.
    lots = Number(stepped.toFixed(4));
    if (lots < minLot) {
      belowMinimumLot = true;
      lots = 0;
    }
    units = lots * instrument.contractSize;
  }

  const notional = units * entry * quoteToAccountRate;
  const actualRisk = units * riskPerUnit;

  let note = "";
  if (belowMinimumLot) {
    note = `Sizing this trade at ${riskPercent}% of ${round2(balance)} would need less than the ${minLot} minimum lot. A real account could only take this trade by risking more than your limit.`;
  } else if (cappedByLeverage) {
    note = `Leverage, not your risk limit, decided this size: ${leverage}:1 on a ${round2(balance)} balance caps the position at ${round2(notional)} face value.`;
  }

  return {
    ...base,
    units,
    lots,
    notional,
    marginRequired: leverage > 0 ? notional / leverage : notional,
    cappedByLeverage,
    belowMinimumLot,
    actualRisk,
    actualRiskPercent: balance > 0 ? (actualRisk / balance) * 100 : 0,
    note,
  };
}

export interface RewardResult {
  reward: number;
  risk: number;
  ratio: number | null;
  potentialProfit: number;
  potentialLoss: number;
  /**
   * The share of trades that would have to be winners for this ratio to break
   * even. Arithmetic about the ratio — not a forecast of anything.
   */
  breakEvenWinRate: number | null;
}

export function rewardProfile(
  entry: number,
  stop: number,
  target: number,
  units: number,
  quoteToAccountRate = 1,
): RewardResult {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const ratio = risk === 0 ? null : reward / risk;
  return {
    risk,
    reward,
    ratio,
    potentialProfit: reward * units * quoteToAccountRate,
    potentialLoss: risk * units * quoteToAccountRate,
    breakEvenWinRate: ratio === null || ratio + 1 === 0 ? null : (1 / (1 + ratio)) * 100,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
