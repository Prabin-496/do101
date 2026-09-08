/**
 * Distance maths for the station alarm. Pure, so it can be unit tested — an
 * error here means somebody misses their stop.
 */

export interface Point {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. Accurate to well under a metre at city scale. */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing in degrees, 0 = north. Used for the direction arrow. */
export function bearingDegrees(from: Point, to: Point): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function compassPoint(bearing: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters / 1000)} km`;
}

export interface ApproachState {
  distance: number;
  /** Metres per second, from consecutive fixes. Null until two are known. */
  speed: number | null;
  /** Seconds until arrival at the current closing speed, or null. */
  eta: number | null;
  /** True once inside the alarm radius. */
  arrived: boolean;
}

/**
 * Works out how the journey is progressing.
 *
 * `speed` prefers the value the GPS reports, because it is derived from Doppler
 * shift and is far steadier than differencing two positions — which on a train
 * jumps wildly whenever a fix drifts.
 */
export function assessApproach(
  current: Point,
  target: Point,
  radiusMeters: number,
  reportedSpeed: number | null,
  previous?: { distance: number; at: number },
  now = Date.now(),
): ApproachState {
  const distance = distanceMeters(current, target);

  let speed = reportedSpeed !== null && reportedSpeed >= 0 ? reportedSpeed : null;
  if (speed === null && previous) {
    const seconds = (now - previous.at) / 1000;
    // Under two seconds the noise dominates; over five minutes it is stale.
    if (seconds >= 2 && seconds <= 300) {
      const closed = previous.distance - distance;
      if (closed > 0) speed = closed / seconds;
    }
  }

  const eta = speed !== null && speed > 0.5 ? distance / speed : null;

  return { distance, speed, eta, arrived: distance <= radiusMeters };
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function kmh(metersPerSecond: number | null): string {
  if (metersPerSecond === null) return "—";
  return `${Math.round(metersPerSecond * 3.6)} km/h`;
}
