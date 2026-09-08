"use client";

import * as React from "react";
import type { Map as LeafletMap, Marker, Circle } from "leaflet";

/**
 * A small Leaflet map for confirming the destination and watching yourself
 * approach it. Loaded lazily — the alarm works perfectly without ever showing
 * a tile, which matters when the network is poor.
 */
export function StationMap({
  target,
  current,
  radius,
  onPick,
}: {
  target: { lat: number; lon: number; name: string } | null;
  current: { lat: number; lon: number; accuracy: number } | null;
  radius: number;
  onPick?: (lat: number, lon: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const targetMarker = React.useRef<Marker | null>(null);
  const targetCircle = React.useRef<Circle | null>(null);
  const meMarker = React.useRef<Circle | null>(null);
  const accuracyCircle = React.useRef<Circle | null>(null);
  const [ready, setReady] = React.useState(false);
  const onPickRef = React.useRef(onPick);
  // Kept in a ref so the map's click handler, bound once, always calls the
  // current callback without the map being torn down and rebuilt.
  React.useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [35.681, 139.767],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        onPickRef.current?.(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Destination marker and the alarm radius around it.
  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    void (async () => {
      const L = await import("leaflet");
      const map = mapRef.current!;

      targetMarker.current?.remove();
      targetCircle.current?.remove();
      if (!target) return;

      targetCircle.current = L.circle([target.lat, target.lon], {
        radius,
        color: "#ff4b4b",
        fillColor: "#ff4b4b",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);

      targetMarker.current = L.marker([target.lat, target.lon])
        .addTo(map)
        .bindPopup(target.name);

      map.setView([target.lat, target.lon], Math.max(map.getZoom(), 13));
    })();
  }, [ready, target, radius]);

  // Your own position, with its reported accuracy drawn honestly.
  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    void (async () => {
      const L = await import("leaflet");
      const map = mapRef.current!;

      meMarker.current?.remove();
      accuracyCircle.current?.remove();
      if (!current) return;

      accuracyCircle.current = L.circle([current.lat, current.lon], {
        radius: Math.max(current.accuracy, 5),
        color: "#22b8f0",
        fillColor: "#22b8f0",
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map);

      meMarker.current = L.circle([current.lat, current.lon], {
        radius: 6,
        color: "#ffffff",
        fillColor: "#22b8f0",
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
    })();
  }, [ready, current]);

  return (
    <div
      ref={containerRef}
      className="h-[320px] w-full overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)]"
      aria-label="Map showing your destination and current position"
    />
  );
}
