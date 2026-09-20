/**
 * How a dartboard is drawn.
 *
 * Kept apart from the React component so the picture and the scoring can be
 * checked against each other: a board whose paint does not line up with
 * scoreAt would be a game that lies to the player about where the dart went.
 *
 * Coordinates match the scoring engine exactly — radius 1 is the outer edge
 * of the double ring — so a landing point needs no conversion to be drawn.
 */

import { RADIUS, SECTORS } from "./darts";

/**
 * A dartboard is a physical object, so its colours are fixed rather than
 * themed: a board that turned pale in dark mode would stop reading as a
 * dartboard at all. The card around it carries the theme instead.
 */
export const PAINT = {
  dark: "#1d2830",
  cream: "#efe3ca",
  red: "#d8413a",
  green: "#2f9e57",
  wire: "#b9c0c4",
  rim: "#141c22",
  rimEdge: "#0c1216",
} as const;

/** Half the viewBox: the board, plus room for the ring of numbers. */
export const VIEW = 1.26;
/** Where the numbers sit, just outside the wire. */
export const NUMBER_RADIUS = 1.16;

export function point(r: number, degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

/** The path for one bed: a band of one sector, between two radii. */
export function wedge(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = point(r1, a0);
  const [x1, y1] = point(r1, a1);
  const [x2, y2] = point(r0, a1);
  const [x3, y3] = point(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

export interface Bed {
  d: string;
  fill: string;
  /** Radii of the band, so a test can aim at the middle of it. */
  band: [number, number];
  sector: number;
}

/** Every bed on the board. The same every render, so it is built once. */
export const BEDS: Bed[] = SECTORS.flatMap((sector, i) => {
  const a0 = i * 18 - 9;
  const a1 = i * 18 + 9;
  // Sectors alternate dark and cream; their rings alternate red and green.
  const single = i % 2 === 0 ? PAINT.dark : PAINT.cream;
  const ring = i % 2 === 0 ? PAINT.red : PAINT.green;
  const bands: Array<[number, number, string]> = [
    [RADIUS.outerBull, RADIUS.tripleInner, single],
    [RADIUS.tripleInner, RADIUS.tripleOuter, ring],
    [RADIUS.tripleOuter, RADIUS.doubleInner, single],
    [RADIUS.doubleInner, RADIUS.doubleOuter, ring],
  ];
  return bands.map(([r0, r1, fill]) => ({
    d: wedge(r0, r1, a0, a1),
    fill,
    band: [r0, r1] as [number, number],
    sector,
  }));
});

export const NUMBERS = SECTORS.map((sector, i) => {
  const [x, y] = point(NUMBER_RADIUS, i * 18);
  return { sector, x, y };
});

/** Keeps an aim point on the board, so nobody can aim into the next room. */
export function clampAim(x: number, y: number): { x: number; y: number } {
  const r = Math.hypot(x, y);
  if (r <= 1.02) return { x, y };
  const scale = 1.02 / r;
  return { x: x * scale, y: y * scale };
}
