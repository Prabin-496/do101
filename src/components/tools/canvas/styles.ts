"use client";

import type { Dash, Routing } from "@/lib/canvas/model";

/**
 * Each tool remembers its own look.
 *
 * Picking red for the pen should not turn the sticky notes red, and a
 * highlighter is never the same width as a pen — so the settings are kept per
 * tool rather than in one shared blob. A new shape or connector is born with
 * the look last chosen for it, which is what lets a diagram keep one visual
 * language as it is built out.
 */
export interface Styles {
  pen: { color: string; width: number };
  highlighter: { color: string; width: number };
  line: { color: string; width: number; dash: Dash; arrowStart: boolean; arrowEnd: boolean };
  text: { color: string; size: number; bold: boolean };
  node: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    dash: Dash;
    fontSize: number;
    textColor: string;
    bold: boolean;
  };
  note: { fill: string; textColor: string; fontSize: number };
  edge: {
    stroke: string;
    strokeWidth: number;
    dash: Dash;
    routing: Routing;
    startArrow: boolean;
    endArrow: boolean;
  };
  eraserSize: number;
}

export const DEFAULT_STYLES: Styles = {
  pen: { color: "#22303c", width: 4 },
  highlighter: { color: "#ffc800", width: 22 },
  line: { color: "#22303c", width: 3, dash: "solid", arrowStart: false, arrowEnd: true },
  text: { color: "#22303c", size: 28, bold: false },
  node: {
    fill: "#e6f7fe",
    stroke: "#22b8f0",
    strokeWidth: 2,
    dash: "solid",
    fontSize: 14,
    textColor: "#22303c",
    bold: false,
  },
  note: { fill: "#fff8dd", textColor: "#22303c", fontSize: 16 },
  edge: {
    stroke: "#64757f",
    strokeWidth: 2,
    dash: "solid",
    routing: "orthogonal",
    startArrow: false,
    endArrow: true,
  },
  eraserSize: 18,
};

/** The ink colours, chosen to stay legible on white and on a dark backdrop. */
export const INK_COLORS = [
  "#22303c", "#64757f", "#ff4b4b", "#ff8a00", "#ffc800",
  "#4cc93f", "#22b8f0", "#b45cff", "#ffffff",
];

export const FILL_COLORS = [
  "transparent", "#ffffff", "#e6f7fe", "#eefbe9", "#f6ecff",
  "#fff8dd", "#fff3e3", "#ffecec", "#22303c",
];

export const STROKE_COLORS = [
  "#22303c", "#64757f", "#22b8f0", "#4cc93f", "#b45cff",
  "#ffc800", "#ff8a00", "#ff4b4b", "transparent",
];

export const NOTE_COLORS = ["#fff8dd", "#e6f7fe", "#eefbe9", "#f6ecff", "#ffecec", "#fff3e3"];

export const PAPER_COLORS = [
  "#ffffff", "#f7f9fa", "#fffdf5", "#eefbe9", "#e6f7fe", "#22303c", "#111b21",
];

export const PEN_WIDTHS = [2, 4, 8, 14];
export const HIGHLIGHTER_WIDTHS = [14, 22, 34, 48];
export const TEXT_SIZES = [18, 24, 32, 48, 64];
