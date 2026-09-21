/**
 * The market-data adapter interface.
 *
 * Everything TradeLens can load sits behind this one shape, which is what lets
 * the tool stay free: if a public source disappears or starts charging, it is
 * one file, and CSV import still works. Adapters run in the visitor's browser
 * and talk to the provider directly — no DO101 server sits in the middle, so
 * there is no bill for DO101 to pay and no request log for it to keep.
 *
 * An adapter that needs a key asks the visitor for *their own* key, keeps it
 * in their browser's storage and sends it only to that provider. No key is
 * ever bundled into this application.
 */

import type { Series, Timeframe } from "../types";

export class MarketDataError extends Error {}

export interface AdapterSymbol {
  /** Provider-specific symbol, e.g. "PAXGUSDT" or "XAU/USD". */
  id: string;
  label: string;
  /** Contract specification key from INSTRUMENTS. */
  instrumentId: string;
  /** The caveat that belongs with this particular instrument. */
  note?: string;
}

export interface FetchOptions {
  symbol: string;
  timeframe: Timeframe;
  /** Maximum bars to ask for. Adapters clamp to what the provider allows. */
  limit?: number;
  apiKey?: string;
  signal?: AbortSignal;
}

export interface MarketAdapter {
  id: string;
  name: string;
  /** What this source actually is, in one sentence. */
  blurb: string;
  /** The free-tier limits, stated plainly. */
  limits: string;
  home: string;
  needsKey: boolean;
  keyUrl?: string;
  /** Some sources publish one price per period rather than real OHLC. */
  closeOnly: boolean;
  timeframes: Timeframe[];
  symbols: AdapterSymbol[];
  /** True when a visitor may type any symbol the provider supports. */
  freeform?: boolean;
  fetchSeries(options: FetchOptions): Promise<Series>;
}

export async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new MarketDataError(
      "Could not reach the data provider. That is usually a dropped connection, a blocked request or the provider being down — the tool still works from a CSV file.",
    );
  }
  if (response.status === 429) {
    throw new MarketDataError("The provider's free rate limit has been hit. Wait a minute, or import a CSV instead.");
  }
  if (!response.ok) {
    throw new MarketDataError(`The provider answered with ${response.status}. Try a different symbol or timeframe.`);
  }
  return response.json();
}
