/** Display helpers shared by every TradeLens panel. */

import type { Instrument } from "./types";

export function formatPrice(value: number | null | undefined, instrument: Instrument): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(instrument.digits);
}

export function formatMoney(value: number | null | undefined, currency = "$"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 0 : 2;
  return `${sign}${currency}${abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatSignedMoney(value: number, currency = "$"): string {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatPips(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  // Gold stops run to thousands of pips, so the separator earns its place.
  return `${value.toLocaleString(undefined, { minimumFractionDigits: value >= 100 ? 0 : 1, maximumFractionDigits: value >= 100 ? 0 : 1 })} pips`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function formatRatio(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

/** UTC throughout: a market history read in local time is a different history. */
export function formatBarTime(time: number, timeframe: string): string {
  const date = new Date(time);
  const day = date.toLocaleDateString(undefined, { day: "2-digit", month: "short", timeZone: "UTC" });
  if (timeframe === "1d" || timeframe === "1w") {
    return `${day} ${date.getUTCFullYear()}`;
  }
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

export function formatDateTime(time: number): string {
  const date = new Date(time);
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}
