/**
 * Alignment guides.
 *
 * While a shape is being dragged its edges and centre lines are compared with
 * every other shape's. When one is within a few pixels the move is nudged onto
 * it and a guide is drawn, which is what makes a hand-placed diagram come out
 * looking as if it had been laid out on a grid.
 */
import type { Rect } from "./model";

export interface Guide {
  /** "x" is a vertical guide at a fixed x, "y" is a horizontal one. */
  axis: "x" | "y";
  at: number;
  /** The span the guide is drawn across, covering both shapes involved. */
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

/** The three interesting positions on each axis: both edges and the centre. */
function xEdges(r: Rect): number[] {
  return [r.x, r.x + r.w / 2, r.x + r.w];
}

function yEdges(r: Rect): number[] {
  return [r.y, r.y + r.h / 2, r.y + r.h];
}

interface Candidate {
  delta: number;
  at: number;
  other: Rect;
}

function best(moving: number[], others: Rect[], edgesOf: (r: Rect) => number[], tolerance: number): Candidate | null {
  let found: Candidate | null = null;
  for (const other of others) {
    for (const target of edgesOf(other)) {
      for (const source of moving) {
        const delta = target - source;
        if (Math.abs(delta) > tolerance) continue;
        // Ties go to the first match, so a shape does not flicker between two
        // equally close neighbours as the pointer moves.
        if (!found || Math.abs(delta) < Math.abs(found.delta)) {
          found = { delta, at: target, other };
        }
      }
    }
  }
  return found;
}

/**
 * Works out how far a proposed rectangle should be nudged to line up with its
 * neighbours, and which guides to draw while it is there.
 */
export function snapToShapes(moving: Rect, others: Rect[], tolerance: number): SnapResult {
  if (tolerance <= 0 || others.length === 0) return { dx: 0, dy: 0, guides: [] };

  const guides: Guide[] = [];
  const x = best(xEdges(moving), others, xEdges, tolerance);
  const y = best(yEdges(moving), others, yEdges, tolerance);

  if (x) {
    const top = Math.min(moving.y, x.other.y);
    const bottom = Math.max(moving.y + moving.h, x.other.y + x.other.h);
    guides.push({ axis: "x", at: x.at, from: top, to: bottom });
  }
  if (y) {
    const left = Math.min(moving.x, y.other.x);
    const right = Math.max(moving.x + moving.w, y.other.x + y.other.w);
    guides.push({ axis: "y", at: y.at, from: left, to: right });
  }

  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides };
}

/** The bounding box of a group of rectangles, used when several shapes move together. */
export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}
