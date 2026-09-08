"use client";

import { geoOrthographic, geoPath, geoGraticule10, geoCentroid } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";

/**
 * An interactive globe drawn with d3-geo's orthographic projection on a 2D
 * canvas — a genuine sphere you can spin, not a flat map.
 *
 * Canvas rather than SVG because 170-odd country paths redraw every frame while
 * dragging, and SVG cannot keep up on a phone. Hit testing uses a hidden
 * "picking" canvas where each country is filled with a unique colour: reading
 * one pixel gives the country under the cursor in constant time, with no
 * point-in-polygon maths.
 */

export interface CountryFeature extends Feature<Geometry> {
  id?: string | number;
  properties: { name?: string } | null;
}

export interface GlobeTheme {
  ocean: string;
  oceanEdge: string;
  graticule: string;
  border: string;
  land: string;
  highlight: string;
  selected: string;
  shadow: string;
}

export interface GlobeState {
  /** [longitude, latitude, roll] passed straight to the projection. */
  rotation: [number, number, number];
  scale: number;
}

const WORLD_URL = "world-atlas/countries-110m.json";

let cachedFeatures: CountryFeature[] | null = null;

/** Loads and caches the country polygons; ~105 KB, fetched once per session. */
export async function loadWorld(): Promise<CountryFeature[]> {
  if (cachedFeatures) return cachedFeatures;

  const topology = (await import(/* webpackIgnore: false */ "world-atlas/countries-110m.json"))
    .default as unknown as Parameters<typeof feature>[0];

  const collection = feature(
    topology,
    (topology as unknown as { objects: { countries: never } }).objects.countries,
  ) as unknown as FeatureCollection<Geometry>;

  cachedFeatures = collection.features as CountryFeature[];
  return cachedFeatures;
}

export { WORLD_URL };

/** Converts a numeric index into a unique opaque colour for the picking buffer. */
export function indexToColor(index: number): string {
  const value = index + 1; // 0 is reserved for "nothing here"
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

export function colorToIndex(r: number, g: number, b: number): number {
  return ((r << 16) | (g << 8) | b) - 1;
}

export function createProjection(width: number, height: number, state: GlobeState): GeoProjection {
  return geoOrthographic()
    .rotate(state.rotation)
    .scale((Math.min(width, height) / 2) * state.scale)
    .translate([width / 2, height / 2])
    .clipAngle(90);
}

export interface DrawOptions {
  features: CountryFeature[];
  colorFor: (feature: CountryFeature, index: number) => string;
  hoveredIndex: number | null;
  selectedIndex: number | null;
  theme: GlobeTheme;
  showGraticule: boolean;
}

export function drawGlobe(
  canvas: HTMLCanvasElement,
  state: GlobeState,
  options: DrawOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const projection = createProjection(width, height, state);
  const path = geoPath(projection, ctx);
  const radius = (Math.min(width, height) / 2) * state.scale;
  const cx = width / 2;
  const cy = height / 2;

  // Ocean, with a soft radial shade so the sphere reads as three-dimensional.
  const gradient = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.35,
    radius * 0.1,
    cx,
    cy,
    radius,
  );
  gradient.addColorStop(0, options.theme.ocean);
  gradient.addColorStop(1, options.theme.oceanEdge);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  if (options.showGraticule) {
    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = options.theme.graticule;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  options.features.forEach((countryFeature, index) => {
    ctx.beginPath();
    path(countryFeature);
    ctx.fillStyle =
      index === options.selectedIndex
        ? options.theme.selected
        : index === options.hoveredIndex
          ? options.theme.highlight
          : options.colorFor(countryFeature, index);
    ctx.fill();
    ctx.strokeStyle = options.theme.border;
    ctx.lineWidth = index === options.selectedIndex ? 1.6 : 0.4;
    ctx.stroke();
  });

  // A terminator-style rim shadow, which sells the curvature more than anything else.
  const rim = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(1, options.theme.shadow);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();
}

/** Redraws the offscreen picking buffer used for hit testing. */
export function drawPicking(
  canvas: HTMLCanvasElement,
  state: GlobeState,
  features: CountryFeature[],
  width: number,
  height: number,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const projection = createProjection(width, height, state);
  const path = geoPath(projection, ctx);

  features.forEach((countryFeature, index) => {
    ctx.beginPath();
    path(countryFeature);
    ctx.fillStyle = indexToColor(index);
    ctx.fill();
    // Stroking with the same colour makes thin countries clickable.
    ctx.strokeStyle = indexToColor(index);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

export function pickAt(canvas: HTMLCanvasElement, x: number, y: number): number | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;

  const [r, g, b, a] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  if (a === 0) return null;
  const index = colorToIndex(r, g, b);
  return index >= 0 ? index : null;
}

/** Shortest rotation path, so spinning to a country never takes the long way round. */
export function shortestDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/** The rotation that brings a country's centroid to face the viewer. */
export function rotationForFeature(countryFeature: CountryFeature): [number, number, number] {
  const [lon, lat] = geoCentroid(countryFeature);
  return [-lon, -lat, 0];
}

export function rotationForLatLng(lat: number, lon: number): [number, number, number] {
  return [-lon, -lat, 0];
}

export const LIGHT_THEME: GlobeTheme = {
  ocean: "#bfe3f5",
  oceanEdge: "#7fc4e8",
  graticule: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.85)",
  land: "#8fd08a",
  highlight: "#ffd166",
  selected: "#ff8a00",
  shadow: "rgba(10,40,70,0.35)",
};

export const DARK_THEME: GlobeTheme = {
  ocean: "#123a52",
  oceanEdge: "#061c2b",
  graticule: "rgba(140,200,235,0.18)",
  border: "rgba(8,20,28,0.75)",
  land: "#2f6f52",
  highlight: "#ffd166",
  selected: "#ff8a00",
  shadow: "rgba(0,0,0,0.55)",
};
