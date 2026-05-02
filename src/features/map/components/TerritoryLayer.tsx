import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
//  TERRITORY VISUAL CONCEPT: "Energy Dome / Invisible Force Field"
//
//  1st claim  → short dome (~16 m) — nearly invisible frosted-glass wall
//  More runs  → dome grows taller (up to 110 m) as buildings fill inside
//  Selected   → dome activates: walls brighten, crown blazes, pillars light up
//
//  The key insight: the WALLS are white & translucent (you see through them).
//  Buildings inside remain fully visible. The CROWN (top 6 m) is full-opacity
//  in the territory color — that blazing cap is what makes it feel powered.
//  The GROUND RING is a crisp colored line — the primary ownership signal.
// ─────────────────────────────────────────────────────────────────────────────

const SRC           = 'territories-source';
const SRC_VERTS     = 'territories-verts-source';
const SRC_LABELS    = 'territories-labels-source';
const L_GHOST_FLOOR = 'territories-ghost-floor';  // faint colored tint inside
const L_SHIMMER     = 'territories-shimmer';       // animated white fog (breathing)
const L_WALLS       = 'territories-walls';         // frosted glass dome walls
const L_CROWN       = 'territories-crown';         // blazing energy cap (top 6 m)
const L_FIELD_HALO  = 'territories-field-halo';   // diffuse outer electric glow
const L_GROUND_RING = 'territories-ground-ring';  // crisp colored boundary ring
const L_SCANLINE    = 'territories-scanline';      // animated white energy pulse
const L_PILLARS     = 'territories-pillars';       // corner energy pylon anchors
const L_LABEL       = 'territories-label';         // territory name

// ── Dome height scales with total distance run ────────────────
//   First claim (~400 m perimeter): dome is ~22 m — ghostly thin barrier
//   Repeat runs grow it to 110 m — skyscraper-height fortress
function domeHeight(distanceM: number, selected: boolean): number {
  const h = Math.min(Math.max(distanceM * 0.055, 16), 110);
  return selected ? h * 1.5 : h;
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

    const polyFeatures = territories.map((t) => {
      const h = domeHeight(t.distance, t.id === selectedId);
      return {
        type: 'Feature' as const,
        id: t.id,
        geometry: { type: 'Polygon' as const, coordinates: [t.coordinates] },
        properties: {
          id: t.id,
          color: t.color,
          height: h,
          crownBase: Math.max(0, h - 6),
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

      // 0 ── Ghost floor: barely-there colored tint ─────────────
      //      Just communicates ownership without covering the map
      map.addLayer({
        id: L_GHOST_FLOOR,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'sel'], 1], 0.13, 0.07],
        },
      });

      // 1 ── Atmospheric shimmer (animated) ─────────────────────
      //      White mist breathing inside the dome — trapped energy
      map.addLayer({
        id: L_SHIMMER,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 0.03,
        },
      });

      // 2 ── Frosted glass dome walls ────────────────────────────
      //      Ice-white, very low opacity = see-through force field
      //      Buildings inside remain visible through the walls
      map.addLayer({
        id: L_WALLS,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color': '#e8f4ff',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['case', ['==', ['get', 'sel'], 1], 0.32, 0.20],
        },
      });

      // 3 ── Blazing crown: top 6 m of the dome ─────────────────
      //      Full-opacity colored band = the powered ceiling of the dome
      //      This is the primary "wow" element at 50-degree pitch view
      map.addLayer({
        id: L_CROWN,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'crownBase'],
          'fill-extrusion-opacity': ['case', ['==', ['get', 'sel'], 1], 0.98, 0.85],
        },
      });

      // 4 ── Diffuse electric field halo ─────────────────────────
      map.addLayer({
        id: L_FIELD_HALO,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 20,
          'line-opacity': 0.22,
          'line-blur': 12,
        },
      });

      // 5 ── Crisp ground-level ownership ring ───────────────────
      //      Where the dome meets the earth — primary boundary signal
      map.addLayer({
        id: L_GROUND_RING,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'sel'], 1], 3.2, 2.4],
          'line-opacity': 1.0,
        },
      });

      // 6 ── White energy pulse scanline (animated) ──────────────
      //      Cubic-eased: stays dark, spikes to a white flash
      map.addLayer({
        id: L_SCANLINE,
        type: 'line',
        source: SRC,
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.0,
          'line-opacity': 0.0,
        },
      });

      // 7 ── Corner energy pylons ────────────────────────────────
      //      White core (always visible) + colored thick ring (ownership)
      //      These are the anchors holding the dome in place
      map.addLayer({
        id: L_PILLARS,
        type: 'circle',
        source: SRC_VERTS,
        paint: {
          'circle-radius':       ['case', ['==', ['get', 'sel'], 1], 8, 6],
          'circle-color':        '#ffffff',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 4, 3],
          'circle-opacity':       1.0,
        },
      });

      // 8 ── Territory name ──────────────────────────────────────
      map.addLayer({
        id: L_LABEL,
        type: 'symbol',
        source: SRC_LABELS,
        layout: {
          'text-field':          ['get', 'name'],
          'text-font':           ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':           13,
          'text-anchor':         'center',
          'text-letter-spacing': 0.12,
          'text-max-width':      9,
        },
        paint: {
          'text-color':      '#ffffff',
          'text-halo-color': ['get', 'color'],
          'text-halo-width': 3,
          'text-halo-blur':  1,
        },
      });

      // ── Click + hover ──────────────────────────────────────
      map.on('click', L_GHOST_FLOOR, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onTerritoryClick(id);
      });
      map.on('click', L_WALLS, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onTerritoryClick(id);
      });
      map.on('click', L_CROWN, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onTerritoryClick(id);
      });
      [L_GHOST_FLOOR, L_WALLS, L_CROWN].forEach((layer) => {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '';        });
      });
    }

    // ── Dual animation (30 fps) ───────────────────────────────
    //   shimmer: slow sinusoid 0.02 → 0.11 (period ~4 s) — fog breath
    //   scanline: cubic spike, stays near 0, briefly blazes white (period ~2 s)
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let phase = Math.random() * Math.PI * 2;
    let lastFrame = 0;
    const FRAME_MS = 1000 / 30;

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      phase += 0.045;

      const shimmerOpacity = 0.02 + 0.09 * (0.5 + 0.5 * Math.sin(phase * 0.50));
      const raw            = 0.5 + 0.5 * Math.sin(phase * 1.30);
      const scanOpacity    = Math.pow(raw, 4);
      const scanWidth      = 1.5 + scanOpacity * 4.0;

      try {
        if (map.getLayer(L_SHIMMER))
          map.setPaintProperty(L_SHIMMER, 'fill-opacity', shimmerOpacity);
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
