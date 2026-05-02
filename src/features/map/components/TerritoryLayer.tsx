import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
//  TERRITORY VISUAL — Solid Game Zone Walls
//
//  KEY MapLibre constraint (the bug that caused invisible walls before):
//    fill-extrusion-opacity is PER-LAYER only — it does NOT support
//    data-driven expressions like ['get', 'sel']. Passing a data expression
//    causes the layer to fail silently and become completely invisible.
//    → Always use a numeric constant for fill-extrusion-opacity.
//
//  What renders:
//    Floor      — solid colored fill at 40-55% opacity ("this ground is mine")
//    Walls      — solid colored fill-extrusion at 0.78 opacity (the main block)
//    Crown      — white fill-extrusion top 10m at 0.88 opacity (powered cap)
//    Halo       — wide blurred line outside (electric field)
//    Border     — crisp colored line (exact ownership edge)
//    Flash      — white animated pulse running the border
//    Pillars    — corner circle anchors (white + color ring)
//    Label      — territory name
//
//  Height progression:
//    runs=1 → 60m   freshly claimed
//    runs=2 → 85m   reinforcing
//    runs=3 → 110m  fortress
//    runs=4+ → 130m max tier
//    selected → ×1.5 (activated)
// ─────────────────────────────────────────────────────────────────────────────

const SRC        = 'territories-source';
const SRC_VERTS  = 'territories-verts-source';
const SRC_LABELS = 'territories-labels-source';
const L_FILL     = 'territories-fill';
const L_SHIMMER  = 'territories-shimmer';
const L_WALLS    = 'territories-walls';
const L_CROWN    = 'territories-crown';
const L_HALO     = 'territories-halo';
const L_BORDER   = 'territories-border';
const L_FLASH    = 'territories-flash';
const L_PILLARS  = 'territories-pillars';
const L_LABEL    = 'territories-label';

function wallHeight(runs: number, selected: boolean): number {
  const h = Math.min(60 + (runs - 1) * 25, 130);
  return selected ? Math.round(h * 1.5) : h;
}

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

    const polyFeatures = territories.map((t) => {
      const h = wallHeight(t.runs ?? 1, t.id === selectedId);
      return {
        type: 'Feature' as const,
        id: t.id,
        geometry: { type: 'Polygon' as const, coordinates: [t.coordinates] },
        properties: {
          id: t.id,
          color: t.color,
          height: h,
          crownBase: Math.max(0, h - 10),
          sel: t.id === selectedId ? 1 : 0,
        },
      };
    });

    const vertFeatures = territories.flatMap((t) =>
      t.coordinates.slice(0, -1).map((coord) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: coord },
        properties: { color: t.color, sel: t.id === selectedId ? 1 : 0 },
      }))
    );

    const labelFeatures = territories.map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: centroid(t.coordinates) },
      properties: { name: t.name, color: t.color },
    }));

    const polyGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: polyFeatures  };
    const vertGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: vertFeatures  };
    const labelGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: labelFeatures };

    const existingSrc = map.getSource(SRC) as GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(polyGeo);
      (map.getSource(SRC_VERTS)  as GeoJSONSource)?.setData(vertGeo);
      (map.getSource(SRC_LABELS) as GeoJSONSource)?.setData(labelGeo);
    } else {
      map.addSource(SRC,        { type: 'geojson', data: polyGeo  });
      map.addSource(SRC_VERTS,  { type: 'geojson', data: vertGeo  });
      map.addSource(SRC_LABELS, { type: 'geojson', data: labelGeo });

      // 0 ── Solid colored floor ("this ground is mine")
      map.addLayer({
        id: L_FILL,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color':   ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'sel'], 1], 0.55, 0.40],
        },
      });

      // 1 ── White shimmer fog inside (animated via RAF)
      map.addLayer({
        id: L_SHIMMER,
        type: 'fill',
        source: SRC,
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.04 },
      });

      // 2 ── SOLID COLORED WALLS — the main 3D block
      //      fill-extrusion-opacity MUST be a constant (not a data expression).
      //      height IS data-driven (that's fine). color IS data-driven (fine).
      map.addLayer({
        id: L_WALLS,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color':   ['get', 'color'],
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': 0.78,   // ← CONSTANT required by MapLibre
        },
      });

      // 3 ── White crown cap (top 10m of each wall)
      //      Gives the "powered fortress dome" look at 50° pitch
      map.addLayer({
        id: L_CROWN,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color':   '#ffffff',
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    ['get', 'crownBase'],
          'fill-extrusion-opacity': 0.88,   // ← CONSTANT required by MapLibre
        },
      });

      // 4 ── Wide blurred outer electric halo
      map.addLayer({
        id: L_HALO,
        type: 'line',
        source: SRC,
        paint: {
          'line-color':   ['get', 'color'],
          'line-width':   20,
          'line-opacity': 0.30,
          'line-blur':    14,
        },
      });

      // 5 ── Crisp solid ground boundary
      map.addLayer({
        id: L_BORDER,
        type: 'line',
        source: SRC,
        paint: {
          'line-color':   ['get', 'color'],
          'line-width':   ['case', ['==', ['get', 'sel'], 1], 3.5, 2.5],
          'line-opacity': 1.0,
        },
      });

      // 6 ── Animated white energy flash along boundary
      map.addLayer({
        id: L_FLASH,
        type: 'line',
        source: SRC,
        paint: { 'line-color': '#ffffff', 'line-width': 2.0, 'line-opacity': 0.0 },
      });

      // 7 ── Corner anchor pylons
      map.addLayer({
        id: L_PILLARS,
        type: 'circle',
        source: SRC_VERTS,
        paint: {
          'circle-radius':       ['case', ['==', ['get', 'sel'], 1], 9, 6],
          'circle-color':        '#ffffff',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 5, 3],
          'circle-opacity':       1.0,
        },
      });

      // 8 ── Territory name label
      map.addLayer({
        id: L_LABEL,
        type: 'symbol',
        source: SRC_LABELS,
        layout: {
          'text-field':          ['get', 'name'],
          'text-font':           ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':           14,
          'text-anchor':         'center',
          'text-letter-spacing': 0.10,
          'text-max-width':      9,
        },
        paint: {
          'text-color':      '#ffffff',
          'text-halo-color': ['get', 'color'],
          'text-halo-width': 3,
          'text-halo-blur':  1,
        },
      });

      // ── Click & cursor ─────────────────────────────────────
      [L_FILL, L_WALLS, L_CROWN].forEach((layer) => {
        map.on('click', layer, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onTerritoryClick(id);
        });
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '';        });
      });
    }

    // ── Animation loop (30 fps) ───────────────────────────────
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let phase = Math.random() * Math.PI * 2;
    let lastFrame = 0;
    const FRAME_MS = 1000 / 30;

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      phase += 0.045;

      const shimmer = 0.03 + 0.11 * (0.5 + 0.5 * Math.sin(phase * 0.48));
      const raw     = 0.5 + 0.5 * Math.sin(phase * 1.25);
      const flash   = Math.pow(raw, 4);
      const fWidth  = 1.5 + flash * 4.5;

      try {
        if (map.getLayer(L_SHIMMER)) map.setPaintProperty(L_SHIMMER, 'fill-opacity', shimmer);
        if (map.getLayer(L_FLASH)) {
          map.setPaintProperty(L_FLASH, 'line-opacity', flash);
          map.setPaintProperty(L_FLASH, 'line-width',   fWidth);
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
