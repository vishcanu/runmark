import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory, BuildingType } from '../../../types';

interface BuildingLayerProps {
  map: Map;
  territories: Territory[];
}

const SOURCE_ID     = 'buildings-source';
const EXTRUSION_ID  = 'buildings-extrusion';
const ROOF_ID       = 'buildings-roof';

// Footprint half-size in degrees (≈ varies by type)
const FOOTPRINT: Record<BuildingType, number> = {
  cottage:     0.000030, //  ~3 m half-side → 6×6 m block
  tower:       0.000045, //  ~5 m half-side → 10×10 m block
  skyscraper:  0.000060, //  ~7 m half-side → 14×14 m block
  landmark:    0.000080, // ~10 m half-side → 18×18 m block
};

// Small square polygon around a point (fill-extrusion needs polygons)
function buildingSquare(
  lon: number,
  lat: number,
  half: number
): [number, number][] {
  return [
    [lon - half, lat - half],
    [lon + half, lat - half],
    [lon + half, lat + half],
    [lon - half, lat + half],
    [lon - half, lat - half],
  ];
}

export function BuildingLayer({ map, territories }: BuildingLayerProps) {
  useEffect(() => {
    if (!map) return;

    const features = territories.flatMap((t) =>
      t.buildings.map((b) => {
        const half = FOOTPRINT[b.type] ?? 0.000035;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [buildingSquare(b.position[0], b.position[1], half)],
          },
          properties: {
            id: b.id,
            height: b.height,
            type: b.type,
            color: t.color,
          },
        };
      })
    );

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      // ── 3D block extrusion (walls) ──────────────────────────
      map.addLayer({
        id: EXTRUSION_ID,
        type: 'fill-extrusion',
        source: SOURCE_ID,
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.90,
        },
      });

      // ── Bright roof cap — white tint on top face ────────────
      // Achieved via a second extrusion layer that starts at height-0.5
      // and goes to height, giving a brighter top face appearance
      map.addLayer({
        id: ROOF_ID,
        type: 'fill-extrusion',
        source: SOURCE_ID,
        paint: {
          'fill-extrusion-color': '#ffffff',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['-', ['get', 'height'], 0.8],
          'fill-extrusion-opacity': 0.45,
        },
      });
    }
  }, [map, territories]);

  return null;
}
