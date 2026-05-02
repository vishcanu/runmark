import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
//  TERRITORY VISUAL — "Game Zone / Owned Ground"
//
//  Philosophy: the territory should SCREAM "I OWN THIS" from the map.
//  Think Ingress / Clash of Clans / SimCity zoning — a solid colored block
//  rising from the ground, not a faint outline.
//
//  Progression (based on runs completed):
//    runs = 1  → freshly claimed  → solid 60m walls  (just took it)
//    runs = 2  → 85m walls        (reinforcing)
//    runs = 3+ → 110m+ walls      (fortress tier)
//    selected  → ×1.5 height      (activated / zoomed in)
//
//  Layer stack (bottom → top):
//   L_FILL      flat colored floor     — "this ground is mine"
//   L_WALLS     colored fill-extrusion — solid opaque box/walls rising up
//   L_CAP       white fill-extrusion   — glowing white top edge (powered crown)
//   L_INNER     animated white shimmer fill — living energy inside
//   L_HALO      wide blurred outer line — diffuse electric field
//   L_BORDER    crisp colored boundary — sharp ownership edge
//   L_FLASH     animated white scanline — energy pulse along edge
//   L_PILLARS   corner circle anchors  — pylons holding the zone
//   L_LABEL     territory name
// ─────────────────────────────────────────────────────────────────────────────

const SRC        = 'territories-source';
const SRC_VERTS  = 'territories-verts-source';
const SRC_LABELS = 'territories-labels-source';
const L_FILL     = 'territories-fill';
const L_WALLS    = 'territories-walls';
const L_CAP      = 'territories-cap';
const L_INNER    = 'territories-inner';
const L_HALO     = 'territories-halo';
const L_BORDER   = 'territories-border';
const L_FLASH    = 'territories-flash';
const L_PILLARS  = 'territories-pillars';
const L_LABEL    = 'territories-label';

// ── Wall height based on runs completed ──────────────────────
//   runs=1 → 60m (freshly claimed)
//   runs=2 → 85m
//   runs=3 → 110m
//   runs=4+ → 130m (capped)
function wallHeight(runs: number, selected: boolean): number {
  const h = Math.min(60 + (runs - 1) * 25, 130);
  return selected ? Math.round(h * 1.5) : h;
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

    // ── Build GeoJSON features ────────────────────────────────
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
          capBase: Math.max(0, h - 8),  // top 8 m = glowing white crown
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

    // ── Update sources if already mounted ────────────────────
    const existingSrc = map.getSource(SRC) as GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(polyGeo);
      (map.getSource(SRC_VERTS)  as GeoJSONSource)?.setData(vertGeo);
      (map.getSource(SRC_LABELS) as GeoJSONSource)?.setData(labelGeo);
    } else {
      // ── First mount: create sources + all layers ──────────
      map.addSource(SRC,        { type: 'geojson', data: polyGeo  });
      map.addSource(SRC_VERTS,  { type: 'geojson', data: vertGeo  });
      map.addSource(SRC_LABELS, { type: 'geojson', data: labelGeo });

      // 0 ── Solid colored floor ──────────────────────────────
      //      First thing you see: "this ground is claimed"
      //      Strong opacity — no ambiguity about ownership
      map.addLayer({
        id: L_FILL,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color':   ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'sel'], 1], 0.55, 0.40],
        },
      });

      // 1 ── Animated inner shimmer ──────────────────────────
      //      Subtle white breathing fog — living energy inside the zone
      //      (opacity driven by RAF animation)
      map.addLayer({
        id: L_INNER,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color':   '#ffffff',
          'fill-opacity': 0.04,
        },
      });

      // 2 ── Solid colored walls — THE main visual element ───
      //      Territory color, high opacity = a real physical block
      //      At 50° pitch you see the side faces clearly rising up
      //      This is what makes it look like a game zone, not just lines
      map.addLayer({
        id: L_WALLS,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color':   ['get', 'color'],
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': ['case', ['==', ['get', 'sel'], 1], 0.92, 0.80],
        },
      });

      // 3 ── White glowing crown — powered top edge ──────────
      //      The top 8 m of the wall is pure white at near-full opacity
      //      Creates a "powered fortress" look — like the dome is charged
      //      Contrast against the colored walls = premium layered effect
      map.addLayer({
        id: L_CAP,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color':   '#ffffff',
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    ['get', 'capBase'],
          'fill-extrusion-opacity': ['case', ['==', ['get', 'sel'], 1], 0.95, 0.75],
        },
      });

      // 4 ── Wide diffuse outer halo ─────────────────────────
      //      Electric field extending beyond the walls
      map.addLayer({
        id: L_HALO,
        type: 'line',
        source: SRC,
        paint: {
          'line-color':   ['get', 'color'],
          'line-width':   22,
          'line-opacity': 0.28,
          'line-blur':    14,
        },
      });

      // 5 ── Crisp colored ground boundary ───────────────────
      //      Exact edge of ownership, full opacity, no blur
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

      // 6 ── White energy flash (animated) ───────────────────
      //      Cubic-eased: sits dark, fires a white spike every ~2 s
      //      Feels like an energy pulse running around the perimeter
      map.addLayer({
        id: L_FLASH,
        type: 'line',
        source: SRC,
        paint: {
          'line-color':   '#ffffff',
          'line-width':   2.0,
          'line-opacity': 0.0,
        },
      });

      // 7 ── Corner anchor pylons ────────────────────────────
      //      White core dot always visible on any background
      //      Colored stroke = ownership ring around each corner
      map.addLayer({
        id: L_PILLARS,
        type: 'circle',
        source: SRC_VERTS,
        paint: {
          'circle-radius':        ['case', ['==', ['get', 'sel'], 1], 9, 6],
          'circle-color':         '#ffffff',
          'circle-stroke-color':  ['get', 'color'],
          'circle-stroke-width':  ['case', ['==', ['get', 'sel'], 1], 5, 3],
          'circle-opacity':        1.0,
        },
      });

      // 8 ── Territory name label ────────────────────────────
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

      // ── Click + cursor ────────────────────────────────────
      [L_FILL, L_WALLS, L_CAP].forEach((layer) => {
        map.on('click', layer, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onTerritoryClick(id);
        });
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '';        });
      });
    }

    // ── Animation loop (30 fps) ───────────────────────────────
    //   inner shimmer: slow sinusoid 0.03→0.14 (period ~4 s)
    //   flash:         cubic spike, mostly dark, white burst (~2 s)
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let phase = Math.random() * Math.PI * 2;
    let lastFrame = 0;
    const FRAME_MS = 1000 / 30;

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      phase += 0.045;

      const innerOpacity = 0.03 + 0.11 * (0.5 + 0.5 * Math.sin(phase * 0.48));
      const raw          = 0.5 + 0.5 * Math.sin(phase * 1.25);
      const flashOpacity = Math.pow(raw, 4);
      const flashWidth   = 1.5 + flashOpacity * 4.5;

      try {
        if (map.getLayer(L_INNER))
          map.setPaintProperty(L_INNER, 'fill-opacity', innerOpacity);
        if (map.getLayer(L_FLASH)) {
          map.setPaintProperty(L_FLASH, 'line-opacity', flashOpacity);
          map.setPaintProperty(L_FLASH, 'line-width',   flashWidth);
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
