export type PercentMode = "of" | "isWhatPercent" | "change";

export interface PercentResult {
  value: number;
  formula: string;
  explanation: string;
}

export function percentOf(percent: number, total: number): PercentResult {
  const value = (percent / 100) * total;
  return {
    value,
    formula: `${percent}% × ${total} = (${percent} ÷ 100) × ${total}`,
    explanation: `${percent}% of ${total} is ${round(value)}.`,
  };
}

export function isWhatPercent(part: number, total: number): PercentResult | null {
  if (total === 0) return null;
  const value = (part / total) * 100;
  return {
    value,
    formula: `(${part} ÷ ${total}) × 100`,
    explanation: `${part} is ${round(value)}% of ${total}.`,
  };
}

export function percentChange(from: number, to: number): PercentResult | null {
  if (from === 0) return null;
  const value = ((to - from) / Math.abs(from)) * 100;
  const direction = value >= 0 ? "increase" : "decrease";
  return {
    value,
    formula: `((${to} − ${from}) ÷ |${from}|) × 100`,
    explanation: `That is a ${round(Math.abs(value))}% ${direction}.`,
  };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
