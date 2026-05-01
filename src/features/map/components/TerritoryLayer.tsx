import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';

// ── Layer / Source IDs ────────────────────────────────────────
const SRC          = 'territories-source';
const SRC_VERTS    = 'territories-verts-source';
const SRC_LABELS   = 'territories-labels-source';
const L_FILL       = 'territories-fill';         // solid floor/interior
const L_EXTRUSION  = 'territories-extrusion';   // 3D prism walls
const L_GLOW       = 'territories-glow';         // outer blurred aura
const L_BORDER     = 'territories-border';       // crisp solid edge
const L_PULSE      = 'territories-pulse';        // animated white scan
const L_VERTS      = 'territories-verts';        // corner pins
const L_LABEL      = 'territories-label';        // name text

// ── Height: how much territory "rises" off the ground ────────
//   each 100 m run = +5 m height, floor 15 m, ceiling 90 m
function zoneHeight(distanceM: number, selected: boolean): number {
  const h = Math.min(Math.max(distanceM * 0.05, 15), 90);
  return selected ? h * 1.35 : h;
}

// ── Centroid of a closed polygon ring ────────────────────────
function centroid(coords: [number, number][]): [number, number] {
  const pts = coords.slice(0, -1);  // drop closing vertex
  const n = pts.length;
  let x = 0, y = 0;
  for (const [lng, lat] of pts) { x += lng; y += lat; }
  return [x / n, y / n];
}

interface Props {
  map: Map;
  territories: Territory[];
  selectedId: string | null;
  onTerritoryClick: (id: string) => void;
}

export function TerritoryLayer({ map, territories, selectedId, onTerritoryClick }: Props) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;

    // ── GeoJSON: main polygon features ───────────────────────
    const polyFeatures = territories.map((t) => ({
      type: 'Feature' as const,
      id: t.id,
      geometry: { type: 'Polygon' as const, coordinates: [t.coordinates] },
      properties: {
        id: t.id,
        color: t.color,
        height: zoneHeight(t.distance, t.id === selectedId),
        sel: t.id === selectedId ? 1 : 0,  // integer — more reliable in MapLibre expressions
      },
    }));

    // ── GeoJSON: vertex corner points ─────────────────────────
    const vertFeatures = territories.flatMap((t) =>
      t.coordinates.slice(0, -1).map((coord) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: coord },
        properties: { color: t.color, sel: t.id === selectedId ? 1 : 0 },
      }))
    );

    // ── GeoJSON: label centroids ─────────────────────────────
    const labelFeatures = territories.map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: centroid(t.coordinates) },
      properties: { name: t.name, color: t.color },
    }));

    const polyGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: polyFeatures  };
    const vertGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: vertFeatures  };
    const labelGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: labelFeatures };

    // ── Update or initialise sources + layers ─────────────────
    const existingSrc = map.getSource(SRC) as GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(polyGeo);
      (map.getSource(SRC_VERTS)  as GeoJSONSource)?.setData(vertGeo);
      (map.getSource(SRC_LABELS) as GeoJSONSource)?.setData(labelGeo);
    } else {
      map.addSource(SRC,        { type: 'geojson', data: polyGeo  });
      map.addSource(SRC_VERTS,  { type: 'geojson', data: vertGeo  });
      map.addSource(SRC_LABELS, { type: 'geojson', data: labelGeo });

      // ── 0. Solid fill floor — the base the prism sits on ─
      map.addLayer({
        id: L_FILL,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'sel'], 1], 0.45, 0.28],
        },
      });

      // ── 1. Holographic 3D prism walls ────────────────────
      map.addLayer({
        id: L_EXTRUSION,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['case', ['==', ['get', 'sel'], 1], 0.82, 0.62],
        },
      });

      // ── 2. Soft outer aura / glow ─────────────────────────
      map.addLayer({
        id: L_GLOW,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 12,
          'line-opacity': 0.22,
          'line-blur': 8,
        },
      });

      // ── 3. Crisp solid border ─────────────────────────────
      map.addLayer({
        id: L_BORDER,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'sel'], 1], 2.8, 2.0],
          'line-opacity': 1.0,
        },
      });

      // ── 4. Animated white scan pulse ──────────────────────
      map.addLayer({
        id: L_PULSE,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.0,
          'line-opacity': 0.7,
        },
      });

      // ── 5. Corner vertex pins ─────────────────────────────
      map.addLayer({
        id: L_VERTS,
        type: 'circle',
        source: SRC_VERTS,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'sel'], 1], 5, 4],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 1.0,
        },
      });

      // ── 6. Territory name label ────────────────────────────
      map.addLayer({
        id: L_LABEL,
        type: 'symbol',
        source: SRC_LABELS,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-anchor': 'center',
          'text-letter-spacing': 0.04,
          'text-max-width': 9,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['get', 'color'],
          'text-halo-width': 2,
          'text-halo-blur': 0.5,
        },
      });

      // ── Interaction ───────────────────────────────────────
      map.on('click', L_FILL, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onTerritoryClick(id);
      });
      map.on('click', L_EXTRUSION, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onTerritoryClick(id);
      });
      map.on('mouseenter', L_FILL,      () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', L_FILL,      () => { map.getCanvas().style.cursor = '';        });
      map.on('mouseenter', L_EXTRUSION, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', L_EXTRUSION, () => { map.getCanvas().style.cursor = '';        });
    }

    // ── Pulse animation (throttled ~24 fps) ───────────────────
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let phase = Math.random() * Math.PI * 2; // random start so not all in sync
    let lastFrame = 0;
    const FRAME_MS = 1000 / 24;

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      phase += 0.04;
      const wave = 0.35 + 0.65 * Math.abs(Math.sin(phase));
      try {
        if (map.getLayer(L_PULSE)) {
          map.setPaintProperty(L_PULSE, 'line-opacity', wave);
          map.setPaintProperty(L_PULSE, 'line-width',   0.5 + wave * 1.8);
        }
      } catch { /* map may be mid-teardown */ }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [map, territories, selectedId, onTerritoryClick]);

  return null;
}

