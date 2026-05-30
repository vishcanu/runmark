import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import type { Territory, WorldTerritory } from '../../../types';
import { getTierInfo, computeDailyStreak } from '../../territory/utils/territoryTier';
import { useGhostPlayer } from '../../territory/hooks/useGhostPlayer';

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
const SRC_LABELS = 'territories-labels-source';
const SRC_ROADS  = 'territories-roads-source';
const SRC_ROAD_SURFACE = 'territories-road-surface-source';
const L_FILL     = 'territories-fill';
const L_SHIMMER  = 'territories-shimmer';
const L_WALLS    = 'territories-walls';
const L_CROWN    = 'territories-crown';
const L_HALO     = 'territories-halo';
const L_BORDER   = 'territories-border';
const L_FLASH    = 'territories-flash';
const L_LABEL    = 'territories-label';
// Corridor-specific
const L_ROAD_SLAB   = 'territories-road-slab';
const L_ROAD_STRIPE = 'territories-road-stripe';
// Cleared-ground overlay — subtle tint inside owned territory
const L_GROUND     = 'territories-ground';
// Road surface fill — zoom-adaptive line rendered on rawPath centreline.
// Width grows with zoom exactly like the map's road layers, so the territory
// always visually covers the road at any zoom level (Google Maps style).
const L_ROAD_SURFACE = 'territories-road-surface';
// City-unlock golden pulse ring
const L_CITY_GLOW    = 'territories-city-glow';
const L_UNDER_ATTACK = 'territories-under-attack';

const MS_PER_DAY = 86_400_000;

// ── Height grows meaningfully with each run ───────────────────
// Run 1 → 4m  (tiny curb — just claimed, barely there)
// Run 2 → 12m (walls emerge — locked in)
// Run 3 → 22m (fortress walls — fortified, city build unlocks)
// Run 5 → 38m (tower — warlord)
// Run 10→ 60m (unbreakable landmark)
function baseHeight(runs: number): number {
  const HEIGHTS = [0, 4, 12, 22, 30, 38, 44, 50, 55, 58, 60];
  return HEIGHTS[Math.min(Math.max(runs, 1), HEIGHTS.length - 1)];
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
  const wallM        = isCorr ? 3 : tier.wallM + (selected ? 0.5 : 0);
  const floorOpacity = isCorr
    ? Math.min(0.50 + (selected ? 0.12 : 0), 0.65)
    : Math.min(tier.floorOpacity + (selected ? 0.10 : 0), 0.45);
  const borderWidth  = isCorr
    ? (selected ? 2.5 : 1.5)
    : tier.borderWidth + (selected ? 0.5 : 0);
  const haloWidth    = isCorr
    ? (selected ? 8 : 4)
    : tier.haloWidth   + (selected ? 4   : 0);
  // City building unlocks when the user has run here 3+ times AND visited 3+ consecutive days
  const streak = computeDailyStreak(t.visitDays ?? [t.createdAt ?? Date.now()]);
  const cityUnlocked = runs >= 3 && streak >= 3;

  return {
    h, color, crownBase, crownColor: tier.crownColor, isCorr,
    wallM, floorOpacity, borderWidth, haloWidth, cityUnlocked,
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
  enemyTerritories?: WorldTerritory[];
  onEnemyTerritoryClick?: (t: WorldTerritory) => void;
  attackedTerritoryId?: string | null;
}

export function TerritoryLayer({ map, territories, selectedId, onTerritoryClick, enemyTerritories = [], onEnemyTerritoryClick, attackedTerritoryId }: Props) {
  const rafRef              = useRef<number | null>(null);
  // Refs always point to the latest prop values so the one-time click handler
  // registered on source creation never becomes stale.
  const enemyTerritoriesRef = useRef<WorldTerritory[]>(enemyTerritories);
  const onEnemyClickRef     = useRef(onEnemyTerritoryClick);
  enemyTerritoriesRef.current = enemyTerritories;
  onEnemyClickRef.current     = onEnemyTerritoryClick;
  const ghost = useGhostPlayer();

  useEffect(() => {
    if (!map) return;

    const polyFeatures = territories.map((t) => {
      const sel = t.id === selectedId;
      const { h, color, crownBase, crownColor, wallM, isCorr } = computeProps(t, sel);
      const outer = t.coordinates as [number, number][];
      const shapeVal = isCorr ? 'corridor' : 'zone';
      if (isCorr) {
        // Corridors: road-strip polygon, extruded at wall height
        return {
          type: 'Feature' as const,
          id: t.id,
          geometry: { type: 'Polygon' as const, coordinates: [outer] },
          properties: { id: t.id, color, height: h, crownBase, crownColor, sel: sel ? 1 : 0, shape: shapeVal },
        };
      }
      // Zones: road-ring donut — outer road edge + inner hole (block boundary)
      // Use stored innerRing if the territory was created with buildRoadRing.
      // Fall back to shrinkRing for legacy / seed territories without innerRing.
      const storedHole = t.innerRing as [number, number][] | undefined;
      const innerHole  = storedHole ?? [...shrinkRing(outer, wallM)].reverse();
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

    // Plain outer polygon for floor fill, halo, border — tier-driven properties
    const floorFeatures = territories.map((t) => {
      const sel = t.id === selectedId;
      const { color, floorOpacity, haloWidth, borderWidth, isCorr, cityUnlocked } = computeProps(t, sel);
      return {
        type: 'Feature' as const,
        id: `${t.id}-floor`,
        geometry: { type: 'Polygon' as const, coordinates: [t.coordinates] },
        properties: {
          id: t.id, color, sel: sel ? 1 : 0, floorOpacity, haloWidth, borderWidth,
          shape: isCorr ? 'corridor' : 'zone',
          cityUnlocked: cityUnlocked ? 1 : 0,
          attackType: (t.attackType && (!t.attackExpiresAt || t.attackExpiresAt > Date.now())) ? t.attackType : '',
        },
      };
    });

    // Centerlines for road surface — ALL territories (zone + corridor)
    // Used for the zoom-adaptive line layer that visually covers the road.
    const roadSurfaceFeatures = territories
      .filter((t) => t.rawPath && t.rawPath.length >= 2)
      .map((t) => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: t.rawPath! },
        properties: { id: t.id, color: t.color, sel: t.id === selectedId ? 1 : 0, shape: t.shape ?? 'zone' },
      }));

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
    const labelGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: labelFeatures };
    const roadGeo:  GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: roadFeatures  };
    const roadSurfaceGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: roadSurfaceFeatures };

    const existingSrc = map.getSource(SRC) as GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(polyGeo);
      (map.getSource(SRC_FLOOR)        as GeoJSONSource)?.setData(floorGeo);
      (map.getSource(SRC_LABELS)       as GeoJSONSource)?.setData(labelGeo);
      (map.getSource(SRC_ROADS)        as GeoJSONSource)?.setData(roadGeo);
      (map.getSource(SRC_ROAD_SURFACE) as GeoJSONSource)?.setData(roadSurfaceGeo);
    } else {
      map.addSource(SRC,              { type: 'geojson', data: polyGeo  });
      map.addSource(SRC_FLOOR,        { type: 'geojson', data: floorGeo });
      map.addSource(SRC_LABELS,       { type: 'geojson', data: labelGeo });
      map.addSource(SRC_ROADS,        { type: 'geojson', data: roadGeo  });
      map.addSource(SRC_ROAD_SURFACE, { type: 'geojson', data: roadSurfaceGeo });

      // 0 ── Floor fill — opacity driven by tier (already boosted for selected in floorOpacity prop)
      map.addLayer({
        id: L_FILL, type: 'fill', source: SRC_FLOOR,
        paint: {
          'fill-color':   ['get', 'color'],
          'fill-opacity': ['get', 'floorOpacity'],
        },
      });

      // 1 ── Subtle tint overlay — keeps map readable while marking owned turf
      map.addLayer({
        id: L_GROUND, type: 'fill', source: SRC_FLOOR,
        paint: {
          'fill-color':   '#0d1e0d',
          'fill-opacity': 0.22,   // reduced from 0.68 so map remains readable
        },
      });

      // 2 ── Inner shimmer on floor (animated)
      map.addLayer({
        id: L_SHIMMER, type: 'fill', source: SRC_FLOOR,
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.04 },
      });

      // 2b ── Road surface fill — zoom-adaptive line on rawPath centreline.
      //
      // This is the primary road-fill visual (Google Maps style):
      //   - Line follows the OSRM road centreline (= actual road centre)
      //   - line-width uses the same exponential curve as OFM Liberty road layers
      //     so at every zoom level the line visually covers the drawn road exactly
      //   - Works for both zones (ring centreline) and corridors (straight path)
      //
      // Width calibration vs OFM Liberty road-street at Bangalore (~lat 13°):
      //   zoom 12 →  1 px  (thin overview marker)
      //   zoom 14 →  4 px  × 9.3 m/px  = 37 m drawn,  ~14 m real road on screen
      //   zoom 15 →  7 px  × 4.7 m/px  = 33 m drawn,  matches visual road width
      //   zoom 16 → 13 px  × 2.3 m/px  = 30 m drawn,  matches visual road width
      //   zoom 17 → 22 px  × 1.2 m/px  = 26 m drawn,  close to physical (7–9 m)
      //   zoom 18 → 38 px  × 0.6 m/px  = 23 m drawn,  physical road ≈ 20 m total
      map.addLayer({
        id: L_ROAD_SURFACE, type: 'line', source: SRC_ROAD_SURFACE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   ['get', 'color'],
          'line-width': [
            'interpolate', ['exponential', 1.5], ['zoom'],
            12,  1,
            14,  3,
            15,  5,
            16,  9,
            17, 15,
            18, 26,
            20, 55,
          ],
          'line-opacity': 0.85,
        },
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

      // ── CORRIDOR layers ───────────────────────────────────────
      // Road strip extruded at wall height (same tier progression as zones).
      // Looks like a raised road slab / barrier wall along the road.
      map.addLayer({
        id: L_ROAD_SLAB, type: 'fill-extrusion', source: SRC,
        filter: ['==', ['get', 'shape'], 'corridor'],
        paint: {
          'fill-extrusion-color':   ['get', 'color'],
          'fill-extrusion-height':  ['get', 'height'],  // tier-based wall height
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': 0.78,
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

      // 6b ── City-unlock golden pulse ring — only visible when streak ≥ 3 and runs ≥ 3
      map.addLayer({
        id: L_CITY_GLOW, type: 'line', source: SRC_FLOOR,
        filter: ['==', ['get', 'cityUnlocked'], 1],
        paint: {
          'line-color':   '#fbbf24',  // golden amber
          'line-width':   8,
          'line-opacity': 0.0,        // animated
          'line-blur':    4,
        },
      });

      // Under-attack alert border — own territories currently being sieged
      const underAttackColor = ([
        'case',
        ['==', ['get', 'attackType'], 'inferno'], '#ff4500',
        ['==', ['get', 'attackType'], 'cyclone'], '#a855f7',
        ['==', ['get', 'attackType'], 'tremor'],  '#92400e',
        ['==', ['get', 'attackType'], 'deluge'],  '#0ea5e9',
        ['==', ['get', 'attackType'], 'vortex'],  '#4c1d95',
        '#ef4444',
      ] as unknown) as string;
      map.addLayer({
        id: L_UNDER_ATTACK, type: 'line', source: SRC_FLOOR,
        filter: ['!=', ['get', 'attackType'], ''],
        paint: {
          'line-color':   underAttackColor,
          'line-width':   5,
          'line-opacity': 0.85,
          'line-blur':    3,
        },
      });

      // 8 ── Label
      map.addLayer({
        id: L_LABEL, type: 'symbol', source: SRC_LABELS,
        layout: {
          'text-field':          ['get', 'name'],
          'text-font':           ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size':           10,
          'text-anchor':         'center',
          'text-letter-spacing': 0.06,
          'text-max-width':      9,
        },
        paint: {
          'text-color':      '#ffffff',
          'text-halo-color': ['get', 'color'],
          'text-halo-width': 1.5,
          'text-halo-blur':  0.5,
        },
      });

      [L_FILL, L_WALLS + '-zone', L_CROWN + '-zone', L_ROAD_SLAB].forEach((layer) => {
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

      const shimmer  = 0.03 + 0.10 * (0.5 + 0.5 * Math.sin(phase * 0.48));
      const raw      = 0.5 + 0.5 * Math.sin(phase * 1.25);
      const flash    = Math.pow(raw, 4);
      // Slow golden pulse for city-unlocked territories
      const cityGlow = 0.35 + 0.40 * (0.5 + 0.5 * Math.sin(phase * 0.28));

      try {
        if (map.getLayer(L_SHIMMER)) map.setPaintProperty(L_SHIMMER, 'fill-opacity', shimmer);
        if (map.getLayer(L_FLASH)) {
          map.setPaintProperty(L_FLASH, 'line-opacity', flash);
          map.setPaintProperty(L_FLASH, 'line-width', 1.0 + flash * 3.5);
        }
        if (map.getLayer(L_CITY_GLOW)) {
          map.setPaintProperty(L_CITY_GLOW, 'line-opacity', cityGlow);
          map.setPaintProperty(L_CITY_GLOW, 'line-width', 6 + cityGlow * 5);
        }
      } catch { /* mid-teardown */ }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [map, territories, selectedId, onTerritoryClick]);

  // ── Ghost territory overlay (rival player's zones) ──────────
  const GHOST_SRC     = 'ghost-territories-source';
  const GHOST_SRC_LBL = 'ghost-territories-labels-source';
  const GHOST_FILL    = 'ghost-territories-fill';
  const GHOST_WALL    = 'ghost-territories-wall';
  const GHOST_BORDER  = 'ghost-territories-border';
  const GHOST_LABEL   = 'ghost-territories-label';
  const prevGhostId   = useRef<string | null>(null);

  useEffect(() => {
    if (!map) return;

    const gTerritories = ghost?.territories ?? [];

    const features = gTerritories.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [t.coordinates as [number, number][]] },
      properties: { color: t.color, height: 16 },
    }));
    const labelFeatures = gTerritories.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: centroid(t.coordinates as [number, number][]) },
      properties: { name: t.name, color: t.color },
    }));

    const geo: GeoJSON.FeatureCollection     = { type: 'FeatureCollection', features };
    const labelGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: labelFeatures };

    try {
      const existingSrc = map.getSource(GHOST_SRC) as GeoJSONSource | undefined;
      if (existingSrc) {
        existingSrc.setData(geo);
        (map.getSource(GHOST_SRC_LBL) as GeoJSONSource | undefined)?.setData(labelGeo);
      } else {
        map.addSource(GHOST_SRC,     { type: 'geojson', data: geo      });
        map.addSource(GHOST_SRC_LBL, { type: 'geojson', data: labelGeo });

        // Flat floor tint
        map.addLayer({ id: GHOST_FILL, type: 'fill', source: GHOST_SRC,
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.28 } });

        // Low ghost walls so the territory feels real, not just a sticker
        map.addLayer({ id: GHOST_WALL, type: 'fill-extrusion', source: GHOST_SRC,
          paint: {
            'fill-extrusion-color':   ['get', 'color'],
            'fill-extrusion-height':  ['get', 'height'],
            'fill-extrusion-base':    0,
            'fill-extrusion-opacity': 0.42,
          } });

        // Dashed perimeter ring
        map.addLayer({ id: GHOST_BORDER, type: 'line', source: GHOST_SRC,
          paint: {
            'line-color':     ['get', 'color'],
            'line-width':     2.5,
            'line-opacity':   0.85,
            'line-dasharray': [4, 5],
          } });

        // Territory name labels (same style as owned territories)
        map.addLayer({ id: GHOST_LABEL, type: 'symbol', source: GHOST_SRC_LBL,
          layout: {
            'text-field':          ['get', 'name'],
            'text-font':           ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size':           10,
            'text-anchor':         'center',
            'text-letter-spacing': 0.06,
            'text-max-width':      9,
          },
          paint: {
            'text-color':      '#ffffff',
            'text-halo-color': ['get', 'color'],
            'text-halo-width': 1.5,
            'text-halo-blur':  0.5,
          } });
      }
    } catch (err) {
      console.warn('[TerritoryLayer] ghost layer error', err);
    }

    // Fly to ghost territories when a new player is selected.
    // Small timeout lets the route transition finish before flying.
    if (ghost && ghost.id !== prevGhostId.current && gTerritories.length > 0) {
      prevGhostId.current = ghost.id;
      let minLng =  Infinity, maxLng = -Infinity;
      let minLat =  Infinity, maxLat = -Infinity;
      for (const t of gTerritories) {
        for (const [lng, lat] of (t.coordinates as [number, number][])) {
          if (lng < minLng) minLng = lng;  if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;  if (lat > maxLat) maxLat = lat;
        }
      }
      const cx = (minLng + maxLng) / 2;
      const cy = (minLat + maxLat) / 2;
      setTimeout(() => {
        try { map.flyTo({ center: [cx, cy], zoom: 15, duration: 1200, essential: true }); }
        catch { /* map mid-transition */ }
      }, 250);
    } else if (!ghost) {
      prevGhostId.current = null;
    }
  }, [map, ghost]);

  // ── Enemy territory layer (all other players' zones) ────────
  const ENEMY_SRC    = 'enemy-territories-source';
  const L_ENEMY_FILL = 'enemy-territories-fill';
  const L_ENEMY_WALL = 'enemy-territories-wall';
  const L_ENEMY_BDR  = 'enemy-territories-border';
  const L_ENEMY_LBL  = 'enemy-territories-label';
  const L_ENEMY_ATK  = 'enemy-territories-attack';

  useEffect(() => {
    if (!map) return;

    const now = Date.now();
    // MapLibre expression that picks an attack colour or falls back to owner colour
    // Cast via unknown because TS can't narrow the nested array to ExpressionSpecification
    const attackColorExpr = ([
      'case',
      ['==', ['get', 'attackType'], 'inferno'], '#ff4500',
      ['==', ['get', 'attackType'], 'cyclone'], '#a855f7',
      ['==', ['get', 'attackType'], 'tremor'],  '#92400e',
      ['==', ['get', 'attackType'], 'deluge'],  '#0ea5e9',
      ['==', ['get', 'attackType'], 'vortex'],  '#4c1d95',
      ['get', 'color'],
    ] as unknown) as string;
    const features = enemyTerritories.map(t => {
      const activeAttack = (t.attackType && (!t.attackExpiresAt || t.attackExpiresAt > now))
        ? t.attackType : '';
      return {
        type: 'Feature' as const,
        id: t.id,
        geometry: { type: 'Polygon' as const, coordinates: [t.coordinates as [number, number][]] },
        properties: { id: t.id, color: t.ownerColor, name: t.name, owner: t.ownerName, attackType: activeAttack },
      };
    });
    const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    try {
      const existingSrc = map.getSource(ENEMY_SRC) as GeoJSONSource | undefined;
      if (existingSrc) {
        existingSrc.setData(geo);
      } else {
        map.addSource(ENEMY_SRC, { type: 'geojson', data: geo });

        // Flat floor tint — below own territory layers
        map.addLayer(
          { id: L_ENEMY_FILL, type: 'fill', source: ENEMY_SRC,
            paint: {
              'fill-color':   attackColorExpr,
              'fill-opacity': ['case', ['!=', ['get', 'attackType'], ''], 0.38, 0.22],
            } },
          L_FILL,   // insert below own territory floor
        );

        // Short enemy walls (16m) so they look active but clearly foreign
        map.addLayer(
          { id: L_ENEMY_WALL, type: 'fill-extrusion', source: ENEMY_SRC,
            paint: {
              'fill-extrusion-color':   attackColorExpr,
              'fill-extrusion-height':  ['case', ['==', ['get', 'attackType'], 'tremor'], 5, 16],
              'fill-extrusion-base':    0,
              'fill-extrusion-opacity': 0.45,  // constant per MapLibre spec
            } },
          L_FILL,
        );

        // Dashed hostile border
        map.addLayer(
          { id: L_ENEMY_BDR, type: 'line', source: ENEMY_SRC,
            paint: {
              'line-color':     attackColorExpr,
              'line-width':     ['case', ['!=', ['get', 'attackType'], ''], 3, 2],
              'line-opacity':   ['case', ['!=', ['get', 'attackType'], ''], 1.0, 0.70],
              'line-dasharray': [3, 4],
            } },
          L_FILL,
        );

        // Name label (owner: name)
        map.addLayer({
          id: L_ENEMY_LBL, type: 'symbol', source: ENEMY_SRC,
          layout: {
            'text-field':          ['concat', ['get', 'name'], '\n', ['get', 'owner']],
            'text-font':           ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size':           9,
            'text-anchor':         'center',
            'text-max-width':      8,
            'text-line-height':    1.3,
          },
          paint: {
            'text-color':      '#ffffff',
            'text-halo-color': attackColorExpr,
            'text-halo-width': 1.5,
            'text-halo-blur':  0.5,
          },
        });

        // Attack glow ring — solid bright border only over territories under active siege
        map.addLayer({
          id: L_ENEMY_ATK, type: 'line', source: ENEMY_SRC,
          filter: ['!=', ['get', 'attackType'], ''],
          paint: {
            'line-color':   attackColorExpr,
            'line-width':   5,
            'line-opacity': 0.9,
            'line-blur':    3,
          },
        });

        // Click handler — uses refs so it always resolves against the latest data
        map.on('click', L_ENEMY_FILL, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (!id || !onEnemyClickRef.current) return;
          const t = enemyTerritoriesRef.current.find(et => et.id === id);
          if (t) onEnemyClickRef.current(t);
        });
        map.on('mouseenter', L_ENEMY_FILL, () => { map.getCanvas().style.cursor = 'crosshair'; });
        map.on('mouseleave', L_ENEMY_FILL, () => { map.getCanvas().style.cursor = ''; });
      }
    } catch (err) {
      console.warn('[TerritoryLayer] enemy layer error', err);
    }
  }, [map, enemyTerritories, onEnemyTerritoryClick]);

  // ── Just-attacked territory pulse animation ───────────────
  // A dedicated pulsing layer over the territory the player just attacked.
  // Active while the AttackStrike card is showing; cleared when user dismisses.
  const L_ATK_FILL  = 'atk-pulse-fill';
  const L_ATK_RING1 = 'atk-pulse-ring1';
  const L_ATK_RING2 = 'atk-pulse-ring2';
  const SRC_ATK     = 'atk-pulse-source';

  const ATTACK_COLORS: Record<string, string> = {
    inferno: '#ef4444',
    cyclone: '#8b5cf6',
    tremor:  '#d97706',
    deluge:  '#0ea5e9',
    vortex:  '#7c3aed',
  };

  useEffect(() => {
    if (!map) return;

    const cleanupLayers = () => {
      [L_ATK_RING2, L_ATK_RING1, L_ATK_FILL].forEach(id => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* teardown */ }
      });
      try { if (map.getSource(SRC_ATK)) map.removeSource(SRC_ATK); } catch { /* teardown */ }
    };

    if (!attackedTerritoryId) {
      cleanupLayers();
      return;
    }

    const t = enemyTerritoriesRef.current.find(et => et.id === attackedTerritoryId);
    if (!t) return;

    const attackColor = ATTACK_COLORS[t.attackType ?? ''] ?? '#ef4444';
    const coords      = t.coordinates as [number, number][];

    const geo: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      }],
    };

    cleanupLayers();

    try {
      map.addSource(SRC_ATK, { type: 'geojson', data: geo });

      // Filled tint over the territory
      map.addLayer({
        id: L_ATK_FILL, type: 'fill', source: SRC_ATK,
        paint: { 'fill-color': attackColor, 'fill-opacity': 0 },
      });

      // Inner glow ring
      map.addLayer({
        id: L_ATK_RING1, type: 'line', source: SRC_ATK,
        paint: { 'line-color': attackColor, 'line-width': 5, 'line-opacity': 0, 'line-blur': 2 },
      });

      // Outer diffuse halo ring
      map.addLayer({
        id: L_ATK_RING2, type: 'line', source: SRC_ATK,
        paint: { 'line-color': attackColor, 'line-width': 14, 'line-opacity': 0, 'line-blur': 10 },
      });
    } catch (err) {
      console.warn('[TerritoryLayer] atk-pulse layer error', err);
      return;
    }

    // Drive all three layers with a fast rAF pulse
    let phase     = 0;
    let lastFrame = 0;
    let rafId: number;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      if (now - lastFrame < 33) return; // ~30 fps
      lastFrame = now;
      phase += 0.11; // ~2 Hz pulse

      const p     = 0.5 + 0.5 * Math.sin(phase);        // 0 → 1 → 0
      const sharp = Math.pow(p, 1.5);                    // slight sharpening

      try {
        if (map.getLayer(L_ATK_FILL))  map.setPaintProperty(L_ATK_FILL,  'fill-opacity',  0.06 + sharp * 0.14);
        if (map.getLayer(L_ATK_RING1)) {
          map.setPaintProperty(L_ATK_RING1, 'line-opacity', 0.55 + sharp * 0.45);
          map.setPaintProperty(L_ATK_RING1, 'line-width',   3    + sharp * 6);
        }
        if (map.getLayer(L_ATK_RING2)) {
          map.setPaintProperty(L_ATK_RING2, 'line-opacity', 0.18 + sharp * 0.32);
          map.setPaintProperty(L_ATK_RING2, 'line-width',   10   + sharp * 12);
        }
      } catch { /* mid-teardown */ }
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      cleanupLayers();
    };
  }, [map, attackedTerritoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
