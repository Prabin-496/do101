"use client";

/**
 * Station and place lookup via Nominatim, OpenStreetMap's free geocoder.
 *
 * Their usage policy allows light use with attribution and asks for no more
 * than one request per second, so searches are debounced by the caller and
 * every result carries the OSM credit shown on the page.
 *
 * The alarm itself never touches this: once a destination is saved, only the
 * device GPS is used, which is why it keeps working with no signal.
 */

export interface Place {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
  /** True when OSM classifies it as a station, halt or stop. */
  isStation: boolean;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  addresstype?: string;
}

const STATION_TYPES = new Set([
  "station",
  "halt",
  "stop",
  "stop_position",
  "bus_station",
  "tram_stop",
  "subway_entrance",
  "railway",
]);

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);

  const results = (await response.json()) as NominatimResult[];

  return results
    .map((result) => {
      const parts = result.display_name.split(",").map((p) => p.trim());
      return {
        id: String(result.place_id),
        name: result.name?.trim() || parts[0],
        detail: parts.slice(1, 4).join(", "),
        lat: Number(result.lat),
        lon: Number(result.lon),
        isStation:
          result.class === "railway" ||
          STATION_TYPES.has(result.type ?? "") ||
          STATION_TYPES.has(result.addresstype ?? ""),
      };
    })
    .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon))
    // Stations first: that is almost always what someone is looking for here.
    .sort((a, b) => Number(b.isStation) - Number(a.isStation));
}

export interface SavedPlace extends Place {
  savedAt: number;
}

export const SAVED_PLACES_KEY = "saved-stations";
