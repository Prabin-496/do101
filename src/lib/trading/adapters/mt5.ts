/**
 * MetaTrader 5, through the local bridge.
 *
 * The request goes from the visitor's browser to 127.0.0.1 — their own
 * machine — and no further. Loopback is treated as a trustworthy origin, so a
 * page served over HTTPS is allowed to read it; the bridge answers the private
 * network preflight that Chrome sends first.
 *
 * Chrome's Local Network Access rules add a permission on top: a public site
 * may only reach loopback once the visitor allows it. On localhost during
 * development the page and the bridge share an address space, so the check
 * never fires — which is why this only fails on the live site, and why the
 * error has to name the permission rather than blame the bridge.
 *
 * This is the only source here that returns the visitor's *own broker's* gold
 * feed, with that broker's contract size, digits and live spread. Better data
 * does not make a strategy work — but it does mean a disappointing backtest is
 * telling the truth about the strategy rather than about the data.
 */

import { mt5Series, type Mt5BarsResponse, type Mt5Symbol, MT5_DEFAULT_PORT } from "../mt5";
import type { Series } from "../types";
import { MarketDataError, type AdapterSymbol, type FetchOptions, type MarketAdapter } from "./types";

export function bridgeBase(port = MT5_DEFAULT_PORT): string {
  return `http://127.0.0.1:${port}`;
}

/** Names Chrome has used for the loopback permission, newest first. */
const LOOPBACK_PERMISSIONS = ["loopback-network", "local-network-access", "local-network"];

async function loopbackPermission(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions) return null;
  for (const name of LOOPBACK_PERMISSIONS) {
    try {
      return (await navigator.permissions.query({ name } as unknown as PermissionDescriptor)).state;
    } catch {
      // Not a permission this browser knows by that name.
    }
  }
  return null;
}

async function bridgeJson(path: string, port: number, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    // targetAddressSpace tells Chrome up front that this is a loopback
    // request, so it asks the visitor instead of failing it outright.
    response = await fetch(`${bridgeBase(port)}${path}`, { signal, targetAddressSpace: "loopback" } as RequestInit);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if ((await loopbackPermission()) === "denied") {
      throw new MarketDataError(
        "Your browser blocked this site from reaching the bridge on your own computer. Click the icon to the left of the address bar, open Site settings, set Local network access to Allow, then reload and connect again.",
      );
    }
    throw new MarketDataError(
      `Nothing answered on ${bridgeBase(port)}. Start the bridge script on the computer running MetaTrader 5 and keep that window open. If your browser asks whether this site may access devices on your local network, choose Allow — that is how it reaches the bridge. Safari and some privacy browsers refuse this outright; use Chrome or Edge, or export a CSV with the bridge's --csv mode.`,
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new MarketDataError(message ?? `The bridge answered with ${response.status}.`);
  }
  return data;
}

export async function bridgeHealth(port = MT5_DEFAULT_PORT, signal?: AbortSignal): Promise<string> {
  const data = (await bridgeJson("/health", port, signal)) as { terminal?: string };
  return data?.terminal ?? "MetaTrader 5";
}

/** The gold symbols this particular broker lists, by their exact names. */
export async function bridgeSymbols(port = MT5_DEFAULT_PORT, signal?: AbortSignal): Promise<Mt5Symbol[]> {
  const data = (await bridgeJson("/symbols", port, signal)) as { symbols?: Mt5Symbol[] };
  return data?.symbols ?? [];
}

const FALLBACK_SYMBOLS: AdapterSymbol[] = [
  { id: "XAUUSD", label: "XAUUSD — gold", instrumentId: "XAUUSD", note: "The usual name. Some brokers use XAUUSD.m, GOLD or XAUUSDx — connect and the bridge lists the exact names yours uses." },
];

export const mt5Adapter: MarketAdapter = {
  id: "mt5",
  name: "MetaTrader 5 (your own terminal)",
  blurb: "Your broker's own XAUUSD candles, read from a running MT5 terminal by a script on your computer.",
  limits: "Free and unlimited — it is your own terminal. Needs Windows with MetaTrader 5 installed, MetaTrader's free Python package, and the bridge script left running.",
  home: "https://pypi.org/project/MetaTrader5/",
  needsKey: false,
  closeOnly: false,
  timeframes: ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"],
  symbols: FALLBACK_SYMBOLS,
  freeform: true,
  async fetchSeries({ symbol, timeframe, limit = 5000, signal }: FetchOptions): Promise<Series> {
    const params = new URLSearchParams({ symbol, tf: timeframe, count: String(limit) });
    const data = (await bridgeJson(`/bars?${params.toString()}`, MT5_DEFAULT_PORT, signal)) as Mt5BarsResponse;
    if (!data?.bars?.length) throw new MarketDataError("The bridge returned no bars for that symbol and timeframe.");
    const series = mt5Series(data, timeframe);
    if (series.candles.length < 50) {
      throw new MarketDataError("Too few bars came back. Scroll that chart back in MetaTrader once so the terminal downloads the history, then try again.");
    }
    return series;
  },
};
