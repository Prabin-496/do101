import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  bearingDegrees,
  compassPoint,
  formatDistance,
  formatEta,
  kmh,
  assessApproach,
} from "@/lib/travel/geo";
import { VIBRATION_PATTERN } from "@/lib/travel/alarm";

/** Real coordinates, so the expected distances are checkable against a map. */
const TOKYO = { lat: 35.6812, lon: 139.7671 }; // Tokyo Station
const SHINJUKU = { lat: 35.6896, lon: 139.7006 }; // Shinjuku Station
const KYOTO = { lat: 34.9858, lon: 135.7588 }; // Kyoto Station

describe("distance", () => {
  it("matches the known Tokyo to Shinjuku distance", () => {
    // Roughly 6.1 km as the crow flies.
    expect(distanceMeters(TOKYO, SHINJUKU)).toBeGreaterThan(5900);
    expect(distanceMeters(TOKYO, SHINJUKU)).toBeLessThan(6400);
  });

  it("matches the known Tokyo to Kyoto distance", () => {
    // Roughly 367 km.
    const km = distanceMeters(TOKYO, KYOTO) / 1000;
    expect(km).toBeGreaterThan(360);
    expect(km).toBeLessThan(375);
  });

  it("is zero for the same point and symmetric between two", () => {
    expect(distanceMeters(TOKYO, TOKYO)).toBeCloseTo(0, 6);
    expect(distanceMeters(TOKYO, KYOTO)).toBeCloseTo(distanceMeters(KYOTO, TOKYO), 6);
  });

  it("handles a small separation precisely", () => {
    // 0.001 degrees of latitude is about 111 m anywhere on Earth.
    const near = { lat: TOKYO.lat + 0.001, lon: TOKYO.lon };
    expect(distanceMeters(TOKYO, near)).toBeGreaterThan(105);
    expect(distanceMeters(TOKYO, near)).toBeLessThan(118);
  });

  it("copes with crossing the antimeridian", () => {
    const west = { lat: 0, lon: 179.9 };
    const east = { lat: 0, lon: -179.9 };
    // Should be the short way round: about 22 km, not most of the planet.
    expect(distanceMeters(west, east)).toBeLessThan(30_000);
  });
});

describe("bearing", () => {
  it("points north, east, south and west correctly", () => {
    expect(compassPoint(bearingDegrees({ lat: 0, lon: 0 }, { lat: 10, lon: 0 }))).toBe("N");
    expect(compassPoint(bearingDegrees({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }))).toBe("E");
    expect(compassPoint(bearingDegrees({ lat: 10, lon: 0 }, { lat: 0, lon: 0 }))).toBe("S");
    expect(compassPoint(bearingDegrees({ lat: 0, lon: 10 }, { lat: 0, lon: 0 }))).toBe("W");
  });

  it("normalises negative bearings", () => {
    expect(compassPoint(-90)).toBe("W");
    expect(compassPoint(450)).toBe("E");
  });
});

describe("approach assessment", () => {
  const target = SHINJUKU;

  it("does not fire outside the radius and does inside it", () => {
    expect(assessApproach(TOKYO, target, 800, null).arrived).toBe(false);
    const almostThere = { lat: target.lat + 0.001, lon: target.lon };
    expect(assessApproach(almostThere, target, 800, null).arrived).toBe(true);
  });

  it("fires exactly at the radius boundary", () => {
    const state = assessApproach(TOKYO, target, distanceMeters(TOKYO, target), null);
    expect(state.arrived).toBe(true);
  });

  it("prefers the speed the GPS reports", () => {
    const state = assessApproach(TOKYO, target, 500, 25);
    expect(state.speed).toBe(25);
    // 6.1 km at 25 m/s is a little over four minutes.
    expect(state.eta).toBeGreaterThan(200);
    expect(state.eta).toBeLessThan(280);
  });

  it("derives speed from two fixes when the GPS does not report it", () => {
    const now = Date.now();
    const state = assessApproach(TOKYO, target, 500, null, { distance: 6400, at: now - 10_000 }, now);
    expect(state.speed).not.toBeNull();
    expect(state.speed!).toBeGreaterThan(0);
  });

  it("ignores a previous fix that is too close together or too stale", () => {
    const now = Date.now();
    const tooSoon = assessApproach(TOKYO, target, 500, null, { distance: 6400, at: now - 500 }, now);
    expect(tooSoon.speed).toBeNull();
    const tooOld = assessApproach(TOKYO, target, 500, null, { distance: 9000, at: now - 900_000 }, now);
    expect(tooOld.speed).toBeNull();
  });

  it("reports no speed when moving away rather than a negative one", () => {
    const now = Date.now();
    const state = assessApproach(TOKYO, target, 500, null, { distance: 100, at: now - 10_000 }, now);
    expect(state.speed).toBeNull();
    expect(state.eta).toBeNull();
  });

  it("gives no arrival estimate when barely moving", () => {
    expect(assessApproach(TOKYO, target, 500, 0.2).eta).toBeNull();
  });
});

describe("formatting", () => {
  it("switches units at sensible thresholds", () => {
    expect(formatDistance(320)).toBe("320 m");
    expect(formatDistance(1500)).toBe("1.50 km");
    expect(formatDistance(42_000)).toBe("42 km");
    expect(formatDistance(Number.NaN)).toBe("—");
  });

  it("describes arrival times readably", () => {
    expect(formatEta(45)).toBe("45 sec");
    expect(formatEta(600)).toBe("10 min");
    expect(formatEta(7200)).toBe("2 h 0 min");
    expect(formatEta(null)).toBe("—");
  });

  it("converts speed to km/h", () => {
    expect(kmh(10)).toBe("36 km/h");
    expect(kmh(null)).toBe("—");
  });
});

describe("alarm pattern", () => {
  it("is long enough to wake someone rather than feel like a notification", () => {
    const total = VIBRATION_PATTERN.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(2000);
    expect(VIBRATION_PATTERN.length % 2).toBe(0);
  });
});
