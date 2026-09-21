/**
 * The MetaTrader 5 bridge.
 *
 * MetaTrader's own Python package is free and gives you your broker's actual
 * XAU/USD bars — the same candles your terminal draws, with that broker's
 * digits, contract size and live spread. It is also, by design, a local IPC
 * connection to a running MT5 terminal on a Windows desktop. No web page can
 * call it, and no server DO101 could afford to run could either.
 *
 * So the bridge runs on the visitor's own machine. It is a single-file Python
 * script they paste and run next to their terminal; it serves the bars on
 * 127.0.0.1 with CORS headers, and this page fetches them straight from
 * loopback. Nothing leaves their computer, there is no key, there is no
 * account, and DO101 never sees a byte of it.
 *
 * What the bridge deliberately does not expose: the account number, the
 * balance, the open positions or any trading function. It reads price history
 * and symbol specifications, and that is all it can do.
 */

import type { Candle, Instrument, Series, Timeframe } from "./types";

export const MT5_DEFAULT_PORT = 8765;
export const MT5_SCRIPT_NAME = "tradelens_mt5_bridge.py";

/** Server time is rarely UTC; the bridge reports the offset so bars can be fixed. */
export interface Mt5BarsResponse {
  symbol: string;
  timeframe: string;
  server_utc_offset: number;
  digits: number;
  point: number;
  contract_size: number;
  spread_points: number;
  currency_profit: string;
  description?: string;
  bars: { t: number; o: number; h: number; l: number; c: number; v: number | null; s?: number }[];
}

export interface Mt5Symbol {
  name: string;
  description: string;
  digits: number;
  point: number;
  contract_size: number;
  spread_points: number;
}

/**
 * A pip is ten points on a 3- or 5-digit quote and one point otherwise —
 * the convention every broker's own pip-value calculator uses.
 */
export function pipFromDigits(point: number, digits: number): number {
  return digits === 3 || digits === 5 ? point * 10 : point;
}

export function mt5Instrument(response: Mt5BarsResponse): Instrument {
  const pip = pipFromDigits(response.point, response.digits);
  const isGold = /XAU|GOLD/i.test(response.symbol);
  return {
    id: response.symbol,
    name: response.symbol,
    kind: isGold ? "metal" : "forex",
    base: isGold ? "XAU" : response.symbol.slice(0, 3),
    quote: response.currency_profit || response.symbol.slice(3, 6),
    digits: response.digits,
    pip,
    contractSize: response.contract_size,
    typicalSpreadPips: pip > 0 ? (response.spread_points * response.point) / pip : 0,
  };
}

export function parseMt5Bars(response: Mt5BarsResponse): Candle[] {
  const offsetMs = (response.server_utc_offset ?? 0) * 1000;
  const candles: Candle[] = [];
  for (const bar of response.bars ?? []) {
    const time = bar.t * 1000 - offsetMs;
    if (![time, bar.o, bar.h, bar.l, bar.c].every(Number.isFinite)) continue;
    candles.push({
      time,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      // MT5 reports tick volume for FX and metals — a count of price changes,
      // not traded size. Real volume only exists where an exchange publishes it.
      volume: typeof bar.v === "number" && bar.v > 0 ? bar.v : null,
    });
  }
  return candles.sort((a, b) => a.time - b.time);
}

export function mt5Series(response: Mt5BarsResponse, timeframe: Timeframe): Series {
  const instrument = mt5Instrument(response);
  return {
    symbol: response.symbol,
    instrumentId: response.symbol,
    instrument,
    timeframe,
    candles: parseMt5Bars(response),
    closeOnly: false,
    source: `MetaTrader 5 — ${response.symbol}`,
    sourceNote:
      "Your own broker's bars, read from your running MetaTrader 5 terminal by a script on your computer. Times are converted from the broker's server clock to UTC using the offset the bridge reports. Volume is MT5 tick volume — a count of price changes, not traded size.",
    fetchedAt: Date.now(),
    liveSpreadPips: instrument.typicalSpreadPips,
  };
}

/**
 * The bridge itself.
 *
 * Kept as one file with no dependencies beyond MetaTrader's own package, so it
 * can be read end to end before anyone runs it — which is the right thing to
 * do with any script that touches a trading terminal.
 */
export const MT5_BRIDGE_SCRIPT = `"""
TradeLens bridge for MetaTrader 5 — read-only price data on 127.0.0.1.

What it does
    Serves your MT5 terminal's own candles (XAUUSD by default) to the TradeLens
    page in your browser, over loopback only.

What it cannot do
    Place, modify or close an order. Read your balance, equity, account number
    or positions. Reach anything outside your own machine. It calls exactly
    three MetaTrader functions: copy_rates_from_pos, symbol_info and
    symbols_get. Read it yourself before you run it.

Setup (Windows, where MetaTrader 5 runs)
    1. Install and log into MetaTrader 5, and open an XAUUSD chart once.
    2. pip install MetaTrader5
    3. python ${MT5_SCRIPT_NAME}
    4. Leave it running, and press "Connect" in TradeLens.

CSV instead of a server
    python ${MT5_SCRIPT_NAME} --csv XAUUSD 15m 5000
    writes XAUUSD_15m.csv next to the script, ready to import.
"""

import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

try:
    import MetaTrader5 as mt5
except ImportError:
    sys.exit("MetaTrader's package is missing. Run:  pip install MetaTrader5")

PORT = ${MT5_DEFAULT_PORT}
MAX_BARS = 20000

TIMEFRAMES = {
    "1m": mt5.TIMEFRAME_M1,
    "5m": mt5.TIMEFRAME_M5,
    "15m": mt5.TIMEFRAME_M15,
    "30m": mt5.TIMEFRAME_M30,
    "1h": mt5.TIMEFRAME_H1,
    "4h": mt5.TIMEFRAME_H4,
    "1d": mt5.TIMEFRAME_D1,
    "1w": mt5.TIMEFRAME_W1,
}


def start():
    if not mt5.initialize():
        sys.exit("Could not reach MetaTrader 5: %s. Is the terminal open and logged in?" % (mt5.last_error(),))


def server_offset(symbol):
    """Seconds the broker's server clock runs ahead of UTC, to the nearest half hour."""
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return 0
    return int(round((tick.time - time.time()) / 1800.0) * 1800)


def gold_symbols():
    found = []
    for pattern in ("*XAU*", "*GOLD*"):
        for symbol in mt5.symbols_get(pattern) or ():
            if symbol.name not in [s["name"] for s in found]:
                found.append({
                    "name": symbol.name,
                    "description": symbol.description,
                    "digits": symbol.digits,
                    "point": symbol.point,
                    "contract_size": symbol.trade_contract_size,
                    "spread_points": symbol.spread,
                })
    return found


def bars(symbol, timeframe, count):
    if timeframe not in TIMEFRAMES:
        raise ValueError("Unknown timeframe: %s" % timeframe)
    if not mt5.symbol_select(symbol, True):
        raise ValueError("%s is not available in this terminal. Check the exact name in Market Watch." % symbol)

    info = mt5.symbol_info(symbol)
    if info is None:
        raise ValueError("No symbol information for %s." % symbol)

    rows = mt5.copy_rates_from_pos(symbol, TIMEFRAMES[timeframe], 0, min(count, MAX_BARS))
    if rows is None:
        raise ValueError("MetaTrader returned no history: %s" % (mt5.last_error(),))

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "server_utc_offset": server_offset(symbol),
        "digits": info.digits,
        "point": info.point,
        "contract_size": info.trade_contract_size,
        "spread_points": info.spread,
        "currency_profit": info.currency_profit,
        "description": info.description,
        "bars": [
            {
                "t": int(row["time"]),
                "o": float(row["open"]),
                "h": float(row["high"]),
                "l": float(row["low"]),
                "c": float(row["close"]),
                "v": int(row["tick_volume"]),
                "s": int(row["spread"]),
            }
            for row in rows
        ],
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # Read-only data, no cookies, no credentials: any origin may read it.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        try:
            if url.path == "/health":
                self._send(200, {"ok": True, "terminal": mt5.terminal_info()._asdict().get("name", "MetaTrader 5")})
            elif url.path == "/symbols":
                self._send(200, {"symbols": gold_symbols()})
            elif url.path == "/bars":
                symbol = query.get("symbol", ["XAUUSD"])[0]
                timeframe = query.get("tf", ["15m"])[0]
                count = int(query.get("count", ["3000"])[0])
                self._send(200, bars(symbol, timeframe, count))
            else:
                self._send(404, {"error": "Unknown path. Try /health, /symbols or /bars."})
        except Exception as error:  # noqa: BLE001 - the browser should see the reason
            self._send(400, {"error": str(error)})

    def log_message(self, fmt, *args):
        print("  %s" % (fmt % args))


def write_csv(symbol, timeframe, count):
    data = bars(symbol, timeframe, count)
    offset = data["server_utc_offset"]
    name = "%s_%s.csv" % (symbol, timeframe)
    with open(name, "w", encoding="utf-8") as handle:
        handle.write("Date,Open,High,Low,Close,Volume\\n")
        for bar in data["bars"]:
            stamp = time.strftime("%Y-%m-%d %H:%M", time.gmtime(bar["t"] - offset))
            handle.write("%s,%s,%s,%s,%s,%s\\n" % (stamp, bar["o"], bar["h"], bar["l"], bar["c"], bar["v"]))
    print("Wrote %s (%d bars, times in UTC)." % (name, len(data["bars"])))


if __name__ == "__main__":
    start()
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--csv":
            write_csv(
                sys.argv[2] if len(sys.argv) > 2 else "XAUUSD",
                sys.argv[3] if len(sys.argv) > 3 else "15m",
                int(sys.argv[4]) if len(sys.argv) > 4 else 5000,
            )
        else:
            names = ", ".join(s["name"] for s in gold_symbols()) or "none found"
            print("TradeLens bridge on http://127.0.0.1:%d — read-only, loopback only." % PORT)
            print("Gold symbols in this terminal: %s" % names)
            print("Press Ctrl+C to stop.")
            ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")
    finally:
        mt5.shutdown()
`;
