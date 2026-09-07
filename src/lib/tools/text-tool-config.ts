import type * as React from "react";

/** Option types the generic text tool knows how to render. */
export type OptionValue = string | number | boolean;

export interface TextToolOption {
  id: string;
  label: string;
  description?: string;
  type: "toggle" | "select" | "text" | "number";
  default: OptionValue;
  placeholder?: string;
  min?: number;
  max?: number;
  choices?: Array<{ value: string; label: string }>;
  /** Only show this option when another one has a given value. */
  showWhen?: { id: string; equals: OptionValue };
}

export interface TextToolOutcome {
  output: string;
  error?: string;
  /** Small facts shown under the result, e.g. "12 duplicates removed". */
  stats?: Array<{ label: string; value: string }>;
  /** Overrides the download filename extension. */
  extension?: string;
}

export interface TextToolConfig {
  /** Matches the tool registry id, used for analytics. */
  id: string;
  inputLabel: string;
  outputLabel: string;
  placeholder: string;
  sample?: string;
  /** Rendered above the input — a one-line hint, not marketing copy. */
  note?: React.ReactNode;
  options?: TextToolOption[];
  monoInput?: boolean;
  monoOutput?: boolean;
  minHeight?: number;
  /** Result is a list rather than a blob of text. */
  listOutput?: boolean;
  transform: (input: string, options: Record<string, OptionValue>) => TextToolOutcome;
}

export function defaultOptions(config: TextToolConfig): Record<string, OptionValue> {
  return Object.fromEntries((config.options ?? []).map((o) => [o.id, o.default]));
}
