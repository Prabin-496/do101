/**
 * The adapter registry.
 *
 * Ordered the way the panel offers them: the MetaTrader bridge first, because
 * a visitor's own broker feed beats every public approximation; then the
 * keyless public sources, so the tool works on a first visit with nothing set
 * up at all; then the ones a visitor can plug their own free key into. CSV
 * import is not an adapter, because it needs no network.
 */

import { alphaVantageAdapter } from "./alphavantage";
import { binanceAdapter } from "./binance";
import { frankfurterAdapter } from "./frankfurter";
import { mt5Adapter } from "./mt5";
import { twelveDataAdapter } from "./twelvedata";
import type { MarketAdapter } from "./types";

export const ADAPTERS: MarketAdapter[] = [
  mt5Adapter,
  binanceAdapter,
  frankfurterAdapter,
  twelveDataAdapter,
  alphaVantageAdapter,
];

export function getAdapter(id: string): MarketAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

export { MarketDataError } from "./types";
export type { AdapterSymbol, FetchOptions, MarketAdapter } from "./types";
