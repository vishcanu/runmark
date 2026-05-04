import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import type { Territory } from '../../../types';
import { getTierInfo } from '../../territory/utils/territoryTier';

// ─────────────────────────────────────────────────────────────────────────────
//  TERRITORY VISUAL — Solid Walls + Daily Decay
//
//  THE DAILY HOOK: Territory walls decay if you don't run.
//    Day 0-1   → full height, full color        (fresh)
//    Day 2-3   → 85% height                     (slightly faded)
//    Day 4-5   → 65% height, color shifts amber (weakening)
//    Day 6-7   → 50% height, color shifts red   (critical)
//    Day 8+    → 35% height, pulsing red border  (almost lost)
//  → Runs reset lastRunAt and restore full height
//
//  fill-extrusion-opacity MUST be a constant per MapLibre spec.
//  height, color, crownBase ARE data-driven (fine).
// ─────────────────────────────────────────────────────────────────────────────

const SRC        = 'territories-source';
const SRC_FLOOR  = 'territories-floor-source';
const SRC_VERTS  = 'territories-verts-source';
const SRC_LABELS = 'territories-labels-source';
const SRC_ROADS  = 'territories-roads-source';
const L_FILL     = 'territories-fill';
const L_SHIMMER  = 'territories-shimmer';
const L_WALLS    = 'territories-walls';
const L_CROWN    = 'territories-crown';
const L_HALO     = 'territories-halo';
const L_BORDER   = 'territories-border';
const L_FLASH    = 'territories-flash';
const L_PILLARS  = 'territories-pillars';
const L_LABEL    = 'territories-label';
// Corridor-specific
const L_ROAD_SLAB   = 'territories-road-slab';
const L_ROAD_STRIPE = 'territories-road-stripe';
// Cleared-ground overlay — darkens the territory interior so existing map
// buildings are visually de-emphasized ("cleared" plain feeling)
const L_GROUND = 'territories-ground';

const MS_PER_DAY = 86_400_000;

// ── Base height from runs (before decay) ─────────────────────
function baseHeight(runs: number): number {
  return Math.min(60 + (runs - 1) * 25, 130);
}

// ── Decay multiplier: 1.0 → 0.35 over 8 days ─────────────────
function decayMultiplier(lastRunAt: number): number {
  const days = (Date.now() - lastRunAt) / MS_PER_DAY;
  return Math.max(0.35, 1 - days * 0.082);
}

// ── Decay color: own color → amber → red as days pass ─────────
function decayColor(baseColor: string, lastRunAt: number): string {
  const days = (Date.now() - lastRunAt) / MS_PER_DAY;
  if (days < 4)  return baseColor;
  if (days < 6)  return '#d97706';  // amber — weakening
  if (days < 8)  return '#ea580c';  // orange-red — critical
  return '#dc2626';                  // red — almost lost
}

function computeProps(t: Territory, selected: boolean) {
  const runs  = t.runs ?? 1;
  const mul   = decayMultiplier(t.lastRunAt ?? t.createdAt);
  const h     = Math.round(baseHeight(runs) * mul * (selected ? 1.5 : 1));
  const color = decayColor(t.color, t.lastRunAt ?? t.createdAt);
  const tier  = getTierInfo(runs);
  const crownBase = Math.max(0, h - tier.crownH);
  const isCorr = t.shape === 'corridor';

  // Corridors: solid flat road slab — different visual weight than zone walls
  const wallM        = isCorr ? 5 : tier.wallM + (selected ? 1 : 0);
  const floorOpacity = isCorr
    ? Math.min(0.50 + (selected ? 0.12 : 0), 0.65)
    : Math.min(tier.floorOpacity + (selected ? 0.10 : 0), 0.45);
  const borderWidth  = isCorr
    ? (selected ? 3.5 : 2.5)
    : tier.borderWidth + (selected ? 1.0 : 0);
  const haloWidth    = isCorr
    ? (selected ? 14 : 7)
    : tier.haloWidth   + (selected ? 6   : 0);
  return {
    h, color, crownBase, crownColor: tier.crownColor, isCorr,
    wallM, floorOpacity, borderWidth, haloWidth,
  };
}

function centroid(coords: [number, number][]): [number, number] {
  const pts = coords.slice(0, -1);
  const n = pts.length;
  let x = 0, y = 0;
  for (const [lng, lat] of pts) { x += lng; y += lat; }
  return [x / n, y / n];
}

// ── Shrink each vertex toward the centroid by `meters` ────────
// 1° lat ≈ 111 320 m,  1° lng ≈ 111 320 * cos(lat) m
function shrinkRing(
  coords: [number, number][],
  meters: number,
): [number, number][] {
  const [cLng, cLat] = centroid(coords);
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((cLat * Math.PI) / 180);
  return coords.map(([lng, lat]) => {
    const dLat = lat - cLat;
    const dLng = lng - cLng;
    const distM = Math.sqrt((dLat * mPerLat) ** 2 + (dLng * mPerLng) ** 2);
    if (distM < meters) return [cLng, cLat] as [number, number]; // degenerate — collapse to centroid
    const scale = (distM - meters) / distM;
    return [cLng + dLng * scale, cLat + dLat * scale] as [number, number];
  });
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
      const sel = t.id === selectedId;
      const { h, color, crownBase, crownColor, wallM, isCorr } = computeProps(t, sel);
      const outer = t.coordinates as [number, number][];
      const shapeVal = isCorr ? 'corridor' : 'zone';
      if (isCorr) {
        // Corridors: plain polygon (flat slab, no donut walls)
        return {
          type: 'Feature' as const,
          id: t.id,
          geometry: { type: 'Polygon' as const, coordinates: [outer] },
          properties: { id: t.id, color, height: h, crownBase, crownColor, sel: sel ? 1 : 0, shape: shapeVal },
        };
      }
      // Zones: donut polygon → only perimeter band extrudes
      const inner = shrinkRing(outer, wallM);
      const innerHole = [...inner].reverse();
      return {
        type: 'Feature' as const,
        id: t.id,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [outer, innerHole],
        },
        properties: { id: t.id, color, height: h, crownBase, crownColor, sel: sel ? 1 : 0, shape: shapeVal },
      };
    });

    // Vertex dots — only for zone territories (corridors have too many edge vertices)
    const vertFeatures = territories
      .filter((t) => t.shape !== 'corridor')
      .flatMap((t) => {
        const sel = t.id === selectedId;
        const { color } = computeProps(t, sel);
        return t.coordinates.slice(0, -1).map((coord) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: coord },
          properties: { color, sel: sel ? 1 : 0 },
        }));
      });

    // Plain outer polygon for floor fill, halo, border — tier-driven properties
    const floorFeatures = territories.map((t) => {
      const sel = t.id === selectedId;
      const { color, floorOpacity, haloWidth, borderWidth, isCorr } = computeProps(t, sel);
      return {
        type: 'Feature' as const,
        id: `${t.id}-floor`,
        geometry: { type: 'Polygon' as const, coordinates: [t.coordinates] },
        properties: { id: t.id, color, sel: sel ? 1 : 0, floorOpacity, haloWidth, borderWidth, shape: isCorr ? 'corridor' : 'zone' },
      };
    });

    // Centerlines for corridor territories (used for the road-stripe layer)
    const roadFeatures = territories
      .filter((t) => t.shape === 'corridor' && t.rawPath && t.rawPath.length >= 2)
      .map((t) => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: t.rawPath! },
        properties: { id: t.id, color: t.color, sel: t.id === selectedId ? 1 : 0 },
      }));

    const labelFeatures = territories.map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: centroid(t.coordinates) },
      properties: { name: t.name, color: t.color },
    }));

    const polyGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: polyFeatures  };
    const floorGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: floorFeatures };
    const vertGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: vertFeatures  };
    const labelGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: labelFeatures };
    const roadGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: roadFeatures  };

    const existingSrc = map.getSource(SRC) as GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(polyGeo);
      (map.getSource(SRC_FLOOR)  as GeoJSONSource)?.setData(floorGeo);
      (map.getSource(SRC_VERTS)  as GeoJSONSource)?.setData(vertGeo);
      (map.getSource(SRC_LABELS) as GeoJSONSource)?.setData(labelGeo);
      (map.getSource(SRC_ROADS)  as GeoJSONSource)?.setData(roadGeo);
    } else {
      map.addSource(SRC,        { type: 'geojson', data: polyGeo  });
      map.addSource(SRC_FLOOR,  { type: 'geojson', data: floorGeo });
      map.addSource(SRC_VERTS,  { type: 'geojson', data: vertGeo  });
      map.addSource(SRC_LABELS, { type: 'geojson', data: labelGeo });
      map.addSource(SRC_ROADS,  { type: 'geojson', data: roadGeo  });

      // 0 ── Floor fill — opacity driven by tier (already boosted for selected in floorOpacity prop)
      map.addLayer({
        id: L_FILL, type: 'fill', source: SRC_FLOOR,
        paint: {
          'fill-color':   ['get', 'color'],
          'fill-opacity': ['get', 'floorOpacity'],
        },
      });

      // 1 ── Cleared-ground dark overlay — de-emphasizes existing map buildings
      //      inside owned territory ("plain land" feeling)
      map.addLayer({
        id: L_GROUND, type: 'fill', source: SRC_FLOOR,
        paint: {
          'fill-color':   '#0d1e0d', // very dark earthy green
          'fill-opacity': 0.68,
        },
      });

      // 2 ── Inner shimmer on floor (animated)
      map.addLayer({
        id: L_SHIMMER, type: 'fill', source: SRC_FLOOR,
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.04 },
      });

      // 2 ── Solid colored walls (zones only)
      map.addLayer({
        id: L_WALLS + '-zone', type: 'fill-extrusion', source: SRC,
        filter: ['==', ['get', 'shape'], 'zone'],
        paint: {
          'fill-extrusion-color':   ['get', 'color'],
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': 0.80,
        },
      });

      // 3 ── Crown cap (zones only)
      map.addLayer({
        id: L_CROWN + '-zone', type: 'fill-extrusion', source: SRC,
        filter: ['==', ['get', 'shape'], 'zone'],
        paint: {
          'fill-extrusion-color':   ['get', 'crownColor'],
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    ['get', 'crownBase'],
          'fill-extrusion-opacity': 0.92,
        },
      });

      // ── CORRIDOR layers — flat road fill only, no 3D walls ──
      // Just paints the road surface with the territory color.
      map.addLayer({
        id: L_ROAD_SLAB, type: 'fill-extrusion', source: SRC,
        filter: ['==', ['get', 'shape'], 'corridor'],
        paint: {
          'fill-extrusion-color':   ['get', 'color'],
          'fill-extrusion-height':  0.8,   // barely above ground — road paint
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': 0.82,
        },
      });

      // Road center stripe: dashed white line along the GPS centreline
      map.addLayer({
        id: L_ROAD_STRIPE, type: 'line', source: SRC_ROADS,
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color':      '#ffffff',
          'line-width':      1.8,
          'line-opacity':    0.75,
          'line-dasharray':  [5, 7],
        },
      });

      // 4 ── Wide diffuse halo — width grows with tier
      map.addLayer({
        id: L_HALO, type: 'line', source: SRC_FLOOR,
        paint: {
          'line-color':   ['get', 'color'],
          'line-width':   ['get', 'haloWidth'],
          'line-opacity': 0.28,
          'line-blur':    12,
        },
      });

      // 5 ── Crisp ground ring — width grows with tier
      map.addLayer({
        id: L_BORDER, type: 'line', source: SRC_FLOOR,
        paint: {
          'line-color':   ['get', 'color'],
          'line-width':   ['get', 'borderWidth'],
          'line-opacity': 1.0,
        },
      });

      // 6 ── White energy flash (animated)
      map.addLayer({
        id: L_FLASH, type: 'line', source: SRC_FLOOR,
        paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.0 },
      });

      // 7 ── Corner anchor dots — SMALL & PRECISE
      //      radius 4/3 (selected/idle) — aesthetic, not bulky
      map.addLayer({
        id: L_PILLARS, type: 'circle', source: SRC_VERTS,
        paint: {
          'circle-radius':       ['case', ['==', ['get', 'sel'], 1], 4, 3],
          'circle-color':        '#ffffff',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 2.5, 2],
          'circle-opacity':       1.0,
        },
      });

      // 8 ── Label
      map.addLayer({
        id: L_LABEL, type: 'symbol', source: SRC_LABELS,
        layout: {
          'text-field':          ['get', 'name'],
          'text-font':           ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':           12,
          'text-anchor':         'center',
          'text-letter-spacing': 0.10,
          'text-max-width':      9,
        },
        paint: {
          'text-color':      '#ffffff',
          'text-halo-color': ['get', 'color'],
          'text-halo-width': 2.5,
          'text-halo-blur':  1,
        },
      });

      [L_FILL, L_WALLS, L_CROWN, L_ROAD_SLAB].forEach((layer) => {
        map.on('click', layer, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onTerritoryClick(id);
        });
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '';        });
      });
    }

    // ── Suppress base-map buildings inside owned territories ─────
    // Uses MapLibre `within` expression to exclude base-style fill-extrusion
    // features that fall inside any owned territory polygon.
    if (territories.length > 0) {
      const multiPoly: GeoJSON.MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: territories.map((t) => [t.coordinates as [number, number][]]),
      };
      const mapStyleLayers = map.getStyle()?.layers ?? [];
      mapStyleLayers.forEach((l) => {
        if (l.type !== 'fill-extrusion') return;
        // Skip our own territory / building layers
        if (l.id.startsWith('territories-') || l.id.startsWith('construction-') || l.id.startsWith('buildings-')) return;
        try {
          const existing = map.getFilter(l.id);
          const exclude  = ['!', ['within', multiPoly]];
          const combined = existing ? ['all', existing, exclude] : exclude;
          map.setFilter(l.id, combined as maplibregl.FilterSpecification);
        } catch { /* some layers may have incompatible filter types — skip */ }
      });
    }

    // ── Animation (30 fps) ───────────────────────────────────
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let phase = Math.random() * Math.PI * 2;
    let lastFrame = 0;

    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < 33) return;
      lastFrame = now;
      phase += 0.045;

      const shimmer = 0.03 + 0.10 * (0.5 + 0.5 * Math.sin(phase * 0.48));
      const raw     = 0.5 + 0.5 * Math.sin(phase * 1.25);
      const flash   = Math.pow(raw, 4);

      try {
        if (map.getLayer(L_SHIMMER)) map.setPaintProperty(L_SHIMMER, 'fill-opacity', shimmer);
        if (map.getLayer(L_FLASH)) {
          map.setPaintProperty(L_FLASH, 'line-opacity', flash);
          map.setPaintProperty(L_FLASH, 'line-width', 1.0 + flash * 3.5);
        }
      } catch { /* mid-teardown */ }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [map, territories, selectedId, onTerritoryClick]);

  return null;
}
