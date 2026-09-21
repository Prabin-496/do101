"use client";

import { roundCoord } from "./api";

/**
 * Working out where to forecast for.
 *
 * Three routes in: the device's own position, a search for a place by name,
 * and somewhere looked at recently. All three end up as a `Place`, which is
 * only ever a name and a pair of coordinates.
 *
 * Nothing about the visitor's location is sent to DO101 — the coordinates go
 * straight from the browser to the forecast and geocoding services, and the
 * recent list is kept on the device.
 */

export interface Place {
  id: string;
  /** The town or city. */
  name: string;
  /** Region and country, for telling two Springfields apart. */
  detail: string;
  lat: number;
  lon: number;
  countryCode?: string;
}

export const RECENT_KEY = "weather-recent";
export const LAST_PLACE_KEY = "weather-place";
export const UNITS_KEY = "weather-units";
export const MAX_RECENT = 6;

/* ------------------------------ where am I? ------------------------------- */

export class LocationError extends Error {
  /** True when the visitor said no, which needs different wording to a failure. */
  readonly denied: boolean;
  constructor(message: string, denied = false) {
    super(message);
    this.denied = denied;
  }
}

export interface Fix {
  lat: number;
  lon: number;
  /** Radius of uncertainty in metres, as the browser reports it. */
  accuracy: number;
}

/**
 * Asks the browser where it is.
 *
 * High accuracy is deliberately off: a weather forecast is the same across a
 * whole town, so there is no reason to wake the GPS, drain the battery and
 * make the visitor wait for a fix that precise.
 */
export function currentPosition(timeoutMs = 15_000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new LocationError("This browser cannot report a location. Search for your town instead."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new LocationError(
              "Location permission was refused, so the weather here cannot be looked up. Search for your town instead, or allow location for this site and try again.",
              true,
            ),
          );
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new LocationError("Your device could not work out where it is. Searching for your town will work."));
          return;
        }
        reject(new LocationError("Finding your location took too long. Try again, or search for your town."));
      },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: timeoutMs },
    );
  });
}

/* -------------------------------- searching ------------------------------- */

const GEOCODE_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

interface GeocodeResult {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
}

function detailOf(result: GeocodeResult): string {
  // Region then country, skipping whichever is missing or repeats the name.
  return [result.admin1, result.country]
    .filter((part): part is string => Boolean(part) && part !== result.name)
    .join(", ");
}

/** Looks a place up by name, through Open-Meteo's own geocoder. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);

  const body = (await response.json()) as { results?: GeocodeResult[] };
  return (body.results ?? [])
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.name)
    .map((r) => ({
      id: String(r.id ?? `${r.latitude},${r.longitude}`),
      name: r.name!,
      detail: detailOf(r),
      lat: r.latitude!,
      lon: r.longitude!,
      countryCode: r.country_code,
    }));
}

/* ------------------------------ what is here? ----------------------------- */

const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

interface NominatimReverse {
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
}

/**
 * Puts a name to a pair of coordinates, so the page can say "Osaka" rather
 * than "34.69, 135.50".
 *
 * Best-effort on purpose: the forecast is fetched from the coordinates in
 * parallel and never waits for this, so a slow or blocked geocoder costs a
 * nice label and nothing else. Zoom 10 asks for the town rather than the
 * street, which is the right scale for weather and also the least precise
 * thing we can ask about someone's position.
 */
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<Place | null> {
  const url = new URL(REVERSE_ENDPOINT);
  // Rounded to a town, like the forecast request — see `roundCoord`.
  url.searchParams.set("lat", roundCoord(lat));
  url.searchParams.set("lon", roundCoord(lon));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const body = (await response.json()) as NominatimReverse;
    const address = body.address ?? {};

    const name =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.county ??
      body.name ??
      body.display_name?.split(",")[0]?.trim();
    if (!name) return null;

    const detail = [address.state, address.country]
      .filter((part): part is string => Boolean(part) && part !== name)
      .join(", ");

    return {
      id: `here-${lat.toFixed(3)},${lon.toFixed(3)}`,
      name,
      detail,
      lat,
      lon,
      countryCode: address.country_code?.toUpperCase(),
    };
  } catch {
    // Including an abort: the caller treats a missing name as "no label yet".
    return null;
  }
}

/** The fallback label when nothing could name the spot. */
export function coordsLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

/** Two places are the same spot if they round to the same ~100 m. */
export function samePlace(a: Place, b: Place): boolean {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
}

export function addRecent(list: Place[], place: Place): Place[] {
  return [place, ...list.filter((p) => !samePlace(p, place))].slice(0, MAX_RECENT);
}
