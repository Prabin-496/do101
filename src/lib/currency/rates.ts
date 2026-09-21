/**
 * Currency rates from the European Central Bank, via Frankfurter.
 *
 * Free, no key, and browser requests are allowed, so the converter needs no
 * server. These are the ECB's *reference* rates: one mid-market figure per
 * currency, published around 16:00 CET on working days. They are the honest
 * benchmark — and they are not what a bank, card or exchange counter will give
 * you, since every one of those adds a margin. The converter says so.
 *
 * The Nepalese rupee is not an ECB currency, but it is officially pegged to
 * the Indian rupee, so it is derived from the INR rate and labelled as such.
 */

export const API = "https://api.frankfurter.dev/v1";

export const ECB_CURRENCIES = [
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD",
  "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK",
  "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
] as const;

/** Currencies derived from an ECB currency by an official fixed rate. */
export const PEGGED: Record<string, { to: string; rate: number; note: string }> = {
  NPR: {
    to: "INR",
    rate: 1.6,
    note: "The Nepalese rupee is pegged to the Indian rupee at 1 INR = 1.60 NPR by Nepal Rastra Bank. The ECB does not publish it, so it is worked out from the ECB's INR rate.",
  },
};

export const CURRENCIES: string[] = [...ECB_CURRENCIES, ...Object.keys(PEGGED)].sort();

export const CURRENCY_NAMES: Record<string, string> = {
  AUD: "Australian dollar", BRL: "Brazilian real", CAD: "Canadian dollar", CHF: "Swiss franc",
  CNY: "Chinese yuan", CZK: "Czech koruna", DKK: "Danish krone", EUR: "Euro", GBP: "British pound",
  HKD: "Hong Kong dollar", HUF: "Hungarian forint", IDR: "Indonesian rupiah", ILS: "Israeli shekel",
  INR: "Indian rupee", ISK: "Icelandic króna", JPY: "Japanese yen", KRW: "South Korean won",
  MXN: "Mexican peso", MYR: "Malaysian ringgit", NOK: "Norwegian krone", NPR: "Nepalese rupee",
  NZD: "New Zealand dollar", PHP: "Philippine peso", PLN: "Polish złoty", RON: "Romanian leu",
  SEK: "Swedish krona", SGD: "Singapore dollar", THB: "Thai baht", TRY: "Turkish lira",
  USD: "US dollar", ZAR: "South African rand",
};

export class RateError extends Error {}

/** Every rate against EUR, the ECB's own base. */
export interface RateTable {
  date: string;
  /** Units of each currency per 1 EUR. */
  perEuro: Record<string, number>;
}

function withPegs(perEuro: Record<string, number>): Record<string, number> {
  const out = { ...perEuro };
  for (const [code, peg] of Object.entries(PEGGED)) {
    const anchor = out[peg.to];
    if (anchor) out[code] = anchor * peg.rate;
  }
  return out;
}

export function parseLatest(data: unknown): RateTable {
  const payload = data as { base?: string; date?: string; rates?: Record<string, number> };
  if (!payload?.rates || payload.base !== "EUR" || !payload.date) {
    throw new RateError("The rate service returned something this tool could not read.");
  }
  return { date: payload.date, perEuro: withPegs({ EUR: 1, ...payload.rates }) };
}

/** Converts through EUR, the way cross rates are built from reference rates. */
export function convert(amount: number, from: string, to: string, table: RateTable): number | null {
  const a = table.perEuro[from];
  const b = table.perEuro[to];
  if (!a || !b || !Number.isFinite(amount)) return null;
  return (amount / a) * b;
}

export function rate(from: string, to: string, table: RateTable): number | null {
  return convert(1, from, to, table);
}

/** What a typical retail margin would leave you with, so the gap is visible. */
export function withMargin(amount: number, marginPercent: number): number {
  return amount * (1 - marginPercent / 100);
}

export async function fetchLatest(signal?: AbortSignal): Promise<RateTable> {
  let response: Response;
  try {
    response = await fetch(`${API}/latest?base=EUR`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new RateError("Could not reach the rate service. Check your connection and try again.");
  }
  if (!response.ok) throw new RateError(`The rate service answered with ${response.status}.`);
  return parseLatest(await response.json());
}

export interface HistoryPoint {
  date: string;
  rate: number;
}

/** The pair's reference rate for each working day in the range. */
export function parseHistory(data: unknown, from: string, to: string): HistoryPoint[] {
  const payload = data as { rates?: Record<string, Record<string, number>> };
  if (!payload?.rates) return [];
  const points: HistoryPoint[] = [];
  for (const [date, rates] of Object.entries(payload.rates)) {
    const perEuro = withPegs({ EUR: 1, ...rates });
    const a = perEuro[from];
    const b = perEuro[to];
    if (a && b) points.push({ date, rate: b / a });
  }
  return points.sort((x, y) => x.date.localeCompare(y.date));
}

export function historyUrl(from: string, to: string, days: number, today = new Date()): string {
  const start = new Date(today.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  // Pegged currencies are asked for by their anchor, then derived.
  const wanted = new Set([from, to].map((c) => PEGGED[c]?.to ?? c).filter((c) => c !== "EUR"));
  const symbols = wanted.size ? `&symbols=${[...wanted].sort().join(",")}` : "";
  return `${API}/${iso(start)}..${iso(today)}?base=EUR${symbols}`;
}

export async function fetchHistory(from: string, to: string, days: number, signal?: AbortSignal): Promise<HistoryPoint[]> {
  const response = await fetch(historyUrl(from, to, days), { signal });
  if (!response.ok) throw new RateError(`The rate service answered with ${response.status}.`);
  return parseHistory(await response.json(), from, to);
}
