import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';

// ── Layer / Source IDs ────────────────────────────────────────
const SRC           = 'territories-source';
const SRC_VERTS     = 'territories-verts-source';
const SRC_LABELS    = 'territories-labels-source';
const L_FILL        = 'territories-fill';        // solid colored base floor
const L_RADAR       = 'territories-radar';       // animated white breathing fill
const L_EXTRUSION   = 'territories-extrusion';  // 3D prism walls
const L_CAP         = 'territories-cap';         // bright white energy cap (top face)
const L_GLOW_FAT    = 'territories-glow-fat';   // wide dreamy outer halo
const L_GLOW_MID    = 'territories-glow-mid';   // tight neon ring
const L_BORDER      = 'territories-border';     // crisp white edge (contrast)
const L_SCANLINE    = 'territories-scanline';   // animated colored flash
const L_VERTS       = 'territories-verts';      // corner anchor pins
const L_LABEL       = 'territories-label';      // territory name

// ── Height: each 100 m run = +5 m, floor 20 m, ceiling 100 m ─
function zoneHeight(distanceM: number, selected: boolean): number {
  const h = Math.min(Math.max(distanceM * 0.05, 20), 100);
  return selected ? h * 1.4 : h;
}

// ── Centroid of a closed polygon ring ────────────────────────
function centroid(coords: [number, number][]): [number, number] {
  const pts = coords.slice(0, -1);
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
    const polyFeatures = territories.map((t) => {
      const h = zoneHeight(t.distance, t.id === selectedId);
      return {
        type: 'Feature' as const,
        id: t.id,
        geometry: { type: 'Polygon' as const, coordinates: [t.coordinates] },
        properties: {
          id: t.id,
          color: t.color,
          height: h,
          capBase: Math.max(0, h - 4),   // top 4 m = glowing cap
          sel: t.id === selectedId ? 1 : 0,
        },
      };
    });

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

      // ── 0. Solid colored base floor ───────────────────────
      map.addLayer({
        id: L_FILL,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'sel'], 1], 0.60, 0.40],
        },
      });

      // ── 1. Animated white radar breathing fill ────────────
      //    Gives the interior a living, scanning feel
      map.addLayer({
        id: L_RADAR,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 0.06,   // driven by RAF animation
        },
      });

      // ── 2. 3D prism walls ────────────────────────────────
      map.addLayer({
        id: L_EXTRUSION,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['case', ['==', ['get', 'sel'], 1], 0.90, 0.75],
        },
      });

      // ── 3. Bright white energy cap (top 4 m of prism) ────
      //    Makes the top face luminous — like the zone is powered
      map.addLayer({
        id: L_CAP,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color': '#ffffff',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'capBase'],
          'fill-extrusion-opacity': ['case', ['==', ['get', 'sel'], 1], 0.65, 0.42],
        },
      });

      // ── 4. Wide dreamy outer halo ─────────────────────────
      map.addLayer({
        id: L_GLOW_FAT,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 28,
          'line-opacity': 0.20,
          'line-blur': 16,
        },
      });

      // ── 5. Tight neon ring ────────────────────────────────
      map.addLayer({
        id: L_GLOW_MID,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'sel'], 1], 7, 5],
          'line-opacity': 0.60,
          'line-blur': 3,
        },
      });

      // ── 6. White crisp edge — contrast against colored glow ─
      map.addLayer({
        id: L_BORDER,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': '#ffffff',
          'line-width': ['case', ['==', ['get', 'sel'], 1], 2.5, 1.8],
          'line-opacity': ['case', ['==', ['get', 'sel'], 1], 1.0, 0.75],
        },
      });

      // ── 7. Colored scanline flash (animated) ──────────────
      map.addLayer({
        id: L_SCANLINE,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.0,
          'line-opacity': 0.0,   // driven by RAF animation
        },
      });

      // ── 8. Corner anchor pins ─────────────────────────────
      //    White core + colored ring — visible on any background
      map.addLayer({
        id: L_VERTS,
        type: 'circle',
        source: SRC_VERTS,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'sel'], 1], 7, 5],
          'circle-color': '#ffffff',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-opacity': 1.0,
        },
      });

      // ── 9. Territory name label ────────────────────────────
      map.addLayer({
        id: L_LABEL,
        type: 'symbol',
        source: SRC_LABELS,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-anchor': 'center',
          'text-letter-spacing': 0.10,
          'text-max-width': 9,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['get', 'color'],
          'text-halo-width': 3,
          'text-halo-blur': 1,
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

    // ── Dual animation loop (30 fps) ─────────────────────────
    //   wave1: slow radar breath  (period ~3.8 s)
    //   wave2: sharp scanline flash (period ~1.6 s, cubic-eased)
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let phase = Math.random() * Math.PI * 2;
    let lastFrame = 0;
    const FRAME_MS = 1000 / 30;

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      phase += 0.05;

      // Slow sinusoidal radar breath: 0.04 → 0.24
      const radarOpacity = 0.04 + 0.20 * (0.5 + 0.5 * Math.sin(phase * 0.55));

      // Sharp cubic flash: spends most time near 0, spikes to 1
      const raw = 0.5 + 0.5 * Math.sin(phase * 1.4);
      const scanOpacity = Math.pow(raw, 3);
      const scanWidth   = 1.5 + scanOpacity * 3.5;

      try {
        if (map.getLayer(L_RADAR))    map.setPaintProperty(L_RADAR,    'fill-opacity',  radarOpacity);
        if (map.getLayer(L_SCANLINE)) {
          map.setPaintProperty(L_SCANLINE, 'line-opacity', scanOpacity);
          map.setPaintProperty(L_SCANLINE, 'line-width',   scanWidth);
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

