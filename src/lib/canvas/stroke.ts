/**
 * Turning pointer samples into ink.
 *
 * Raw pointer events are noisy and arrive in bursts, so drawing them as a
 * polyline looks jagged and wobbly. Samples are thinned as they arrive,
 * simplified when the stroke ends, and drawn as a curve that passes through
 * the midpoints — which is what makes a line drawn quickly still look smooth.
 */
import { distanceToSegment, round, type Point } from "./model";

/** Ignore samples closer together than this; they only add noise and bytes. */
export const MIN_SAMPLE_DISTANCE = 1.6;

export function shouldSample(last: Point | undefined, next: Point, minDistance = MIN_SAMPLE_DISTANCE): boolean {
  if (!last) return true;
  return Math.hypot(next.x - last.x, next.y - last.y) >= minDistance;
}

/**
 * Ramer–Douglas–Peucker: drops the samples that sit close enough to the line
 * between their neighbours to make no visible difference.
 */
export function simplifyPoints(points: Point[], tolerance = 0.6): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points;

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  // An explicit stack rather than recursion, so a very long stroke cannot
  // overflow on a slow device.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let furthest = -1;
    let furthestDistance = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const distance = distanceToSegment(points[i], points[first], points[last]);
      if (distance > furthestDistance) {
        furthest = i;
        furthestDistance = distance;
      }
    }
    if (furthest !== -1) {
      keep[furthest] = true;
      stack.push([first, furthest], [furthest, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/**
 * The stroke as an SVG path.
 *
 * Quadratic curves whose control points are the samples and whose ends are the
 * midpoints between them: the curve is continuous everywhere, needs no
 * tangent bookkeeping, and cannot overshoot the way a cubic fit can.
 */
export function strokePath(points: Point[]): string {
  if (points.length === 0) return "";
  const p = points;

  if (p.length === 1) {
    // A tap still has to leave a dot, which a round cap on a zero-length
    // segment gives us.
    return `M ${round(p[0].x)} ${round(p[0].y)} L ${round(p[0].x + 0.01)} ${round(p[0].y)}`;
  }
  if (p.length === 2) {
    return `M ${round(p[0].x)} ${round(p[0].y)} L ${round(p[1].x)} ${round(p[1].y)}`;
  }

  const parts: string[] = [`M ${round(p[0].x)} ${round(p[0].y)}`];
  for (let i = 1; i < p.length - 1; i += 1) {
    const midX = (p[i].x + p[i + 1].x) / 2;
    const midY = (p[i].y + p[i + 1].y) / 2;
    parts.push(`Q ${round(p[i].x)} ${round(p[i].y)}, ${round(midX)} ${round(midY)}`);
  }
  const last = p[p.length - 1];
  parts.push(`L ${round(last.x)} ${round(last.y)}`);
  return parts.join(" ");
}

/** Where an arrow head should point, given the last bit of a line. */
export function arrowAngle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}
