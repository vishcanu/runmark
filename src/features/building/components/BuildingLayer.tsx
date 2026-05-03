import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';
import { getConstructionLevel, BUILDING_DEFS } from '../buildingCatalog';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTRUCTION LAYER
//
//  One building per territory, placed at the territory centroid.
//  Height and appearance are driven purely by territory.runs + territory.buildingType.
//
//  runs=1  → cleared land (no building rendered)
//  runs=2  → foundation slab (4m, stone grey)
//  runs=3+ → building chosen by user: height grows each tier
//
//  Layer stack:
//    L_GROUND   – fill, dark earth overlay to "clear" the existing map buildings
//    L_BUILDING – fill-extrusion, the construction walls (matches building type color)
//    L_ROOF     – fill-extrusion, bright accent cap on the top face
// ─────────────────────────────────────────────────────────────────────────────

const SRC_CONSTRUCTION = 'construction-source';
const L_BUILDING       = 'construction-building';
const L_ROOF           = 'construction-roof';

interface BuildingLayerProps {
  map: Map;
  territories: Territory[];
}

function centroid(coords: [number, number][]): [number, number] {
  const pts = coords.slice(0, -1);
  const n   = pts.length || 1;
  let x = 0, y = 0;
  for (const [lng, lat] of pts) { x += lng; y += lat; }
  return [x / n, y / n];
}

/** Small square polygon footprint around a lat/lng centre point */
function makeFootprint(lon: number, lat: number, halfDeg: number): [number, number][] {
  return [
    [lon - halfDeg, lat - halfDeg],
    [lon + halfDeg, lat - halfDeg],
    [lon + halfDeg, lat + halfDeg],
    [lon - halfDeg, lat + halfDeg],
    [lon - halfDeg, lat - halfDeg],
  ];
}

export function BuildingLayer({ map, territories }: BuildingLayerProps) {
  useEffect(() => {
    if (!map) return;

    // Territories with runs >= 2 get a visible construction building.
    // Territories with runs === 1 have cleared land but no building yet.
    const features = territories
      .filter((t) => (t.runs ?? 1) >= 2)
      .map((t) => {
        const coords = t.coordinates as [number, number][];
        const [cLng, cLat] = centroid(coords);
        const level = getConstructionLevel(t.runs ?? 1);

        // Footprint size: ~10% of territory bounding-box span, bounded between 5–25m
        const lngs   = coords.map((c) => c[0]);
        const lats   = coords.map((c) => c[1]);
        const lngSpan = Math.max(...lngs) - Math.min(...lngs);
        const latSpan = Math.max(...lats) - Math.min(...lats);
        const span    = Math.max(lngSpan, latSpan) || 0.001;
        // 1° ≈ 111 320 m, so 25 m ≈ 0.000225°
        const halfDeg = Math.max(0.000045, Math.min(span * 0.10, 0.000225));

        // Color: building type color if chosen;
        //        stone grey for foundation (runs < 3, no type);
        //        territory color for runs ≥ 3 without a chosen type yet
        let buildingColor: string;
        if (t.buildingType) {
          buildingColor = BUILDING_DEFS[t.buildingType].color;
        } else if ((t.runs ?? 1) < 3) {
          buildingColor = '#a8a29e'; // stone grey foundation
        } else {
          buildingColor = t.color;  // theme color — pick a type in the details panel
        }

        const roofColor = t.buildingType ? BUILDING_DEFS[t.buildingType].roofColor : '#e7e5e4';

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [makeFootprint(cLng, cLat, halfDeg)],
          },
          properties: {
            id:         t.id,
            height:     level.height,
            color:      buildingColor,
            roofColor,
          },
        };
      });

    const geojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    const existing = map.getSource(SRC_CONSTRUCTION) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(SRC_CONSTRUCTION, { type: 'geojson', data: geojson });

      // ── Walls ────────────────────────────────────────────────
      map.addLayer({
        id:     L_BUILDING,
        type:   'fill-extrusion',
        source: SRC_CONSTRUCTION,
        paint: {
          'fill-extrusion-color':   ['get', 'color'],
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': 0.94,
        },
      });

      // ── Bright roof cap ───────────────────────────────────────
      map.addLayer({
        id:     L_ROOF,
        type:   'fill-extrusion',
        source: SRC_CONSTRUCTION,
        paint: {
          'fill-extrusion-color':   ['get', 'roofColor'],
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    ['-', ['get', 'height'], 1.0],
          'fill-extrusion-opacity': 0.55,
        },
      });
    }
  }, [map, territories]);

  return null;
}
