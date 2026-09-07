import type * as React from "react";

export type FieldValue = string | number | boolean;

export interface FormField {
  id: string;
  label: string;
  description?: string;
  type: "text" | "textarea" | "number" | "select" | "toggle" | "color" | "date" | "time";
  default: FieldValue;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Character budget shown as a live counter, e.g. SEO titles. */
  limit?: number;
  choices?: Array<{ value: string; label: string }>;
  showWhen?: { id: string; equals: FieldValue };
  /** Half-width on desktop by default; set true to span the row. */
  wide?: boolean;
}

export interface FormOutcome {
  /** The generated code or text. */
  output: string;
  error?: string;
  /** Language hint for the output box. */
  language?: string;
  /** Rendered under the output — a live preview, chart or swatch. */
  preview?: React.ReactNode;
  facts?: Array<{ label: string; value: string }>;
  extension?: string;
}

export interface FormToolConfig {
  id: string;
  fields: FormField[];
  outputLabel: string;
  note?: React.ReactNode;
  generate: (values: Record<string, FieldValue>) => FormOutcome;
}

export function defaultFieldValues(config: FormToolConfig): Record<string, FieldValue> {
  return Object.fromEntries(config.fields.map((f) => [f.id, f.default]));
}
