import { useEffect, useRef } from 'react';
import type { Map } from 'maplibre-gl';
import type { Park } from '../types';

interface ParkBoundaryLayerProps {
  map: Map;
  park: Park | null;
}

const BOUNDARY_SOURCE = 'park-boundary-source';
const BOUNDARY_FILL   = 'park-boundary-fill';
const BOUNDARY_LINE   = 'park-boundary-line';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

type OsmNode = { lat: number; lon: number };

type OsmElement =
  | { type: 'way';      id: number; geometry?: OsmNode[] }
  | { type: 'relation'; id: number; members?: { role: string; geometry?: OsmNode[] }[] };

/** Convert OSM way/relation geometry to a GeoJSON Polygon */
function osmToPolygon(elements: OsmElement[]): GeoJSON.Geometry | null {
  if (!elements.length) return null;

  const el = elements[0];

  if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
    const coords = el.geometry.map((n) => [n.lon, n.lat] as [number, number]);
    // Close ring
    const first = coords[0], last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
    return { type: 'Polygon', coordinates: [coords] };
  }

  if (el.type === 'relation' && el.members) {
    const outerRings = el.members
      .filter((m) => m.role === 'outer' && m.geometry && m.geometry.length >= 3)
      .map((m) => {
        const coords = m.geometry!.map((n) => [n.lon, n.lat] as [number, number]);
        const first = coords[0], last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
        return coords;
      });
    if (!outerRings.length) return null;
    return { type: 'Polygon', coordinates: outerRings };
  }

  return null;
}

async function fetchBoundary(
  numericId: string,
  signal: AbortSignal
): Promise<GeoJSON.Geometry | null> {
  // Query both way and relation — OSM IDs are unique within a type, not globally,
  // but in practice the numeric ID from our data corresponds to one element type.
  const query = `[out:json][timeout:12];(way(id:${numericId});relation(id:${numericId}););out geom;`;

  for (const url of OVERPASS_ENDPOINTS) {
    if (signal.aborted) break;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!resp.ok) continue;
      const data = await resp.json() as { elements: OsmElement[] };
      const geom = osmToPolygon(data.elements);
      if (geom) return geom;
    } catch {
      continue;
    }
  }
  return null;
}

export function ParkBoundaryLayer({ map, park }: ParkBoundaryLayerProps) {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Helper to remove existing layers/source cleanly
    const removeLayers = () => {
      try {
        if (map.getLayer(BOUNDARY_LINE)) map.removeLayer(BOUNDARY_LINE);
        if (map.getLayer(BOUNDARY_FILL)) map.removeLayer(BOUNDARY_FILL);
        if (map.getSource(BOUNDARY_SOURCE)) map.removeSource(BOUNDARY_SOURCE);
      } catch { /* map may be mid-teardown */ }
    };

    // Abort previous fetch and clean up map layers
    abortRef.current?.abort();
    removeLayers();

    if (!park) return;

    const numericId = park.id.replace('osm-', '');
    const controller = new AbortController();
    abortRef.current = controller;

    fetchBoundary(numericId, controller.signal).then((geom) => {
      if (controller.signal.aborted || !geom) return;

      try {
        map.addSource(BOUNDARY_SOURCE, {
          type: 'geojson',
          data: { type: 'Feature', geometry: geom, properties: {} },
        });

        const isLake = park.placeType === 'lake';
        const color = isLake ? '#0369a1' : '#0284c7';

        // Soft fill inside the park boundary
        map.addLayer({
          id: BOUNDARY_FILL,
          type: 'fill',
          source: BOUNDARY_SOURCE,
          paint: {
            'fill-color': color,
            'fill-opacity': 0.14,
          },
        });

        // Dashed outline around the boundary
        map.addLayer({
          id: BOUNDARY_LINE,
          type: 'line',
          source: BOUNDARY_SOURCE,
          paint: {
            'line-color': color,
            'line-width': 2.5,
            'line-opacity': 0.85,
            'line-dasharray': [5, 3],
          },
        });
      } catch { /* source/layer may already exist in edge cases */ }
    });

    return () => {
      controller.abort();
      removeLayers();
    };
  }, [map, park]);

  return null;
}
