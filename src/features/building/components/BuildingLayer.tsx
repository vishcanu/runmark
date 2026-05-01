import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';

interface BuildingLayerProps {
  map: Map;
  territories: Territory[];
}

const SOURCE_ID = 'buildings-source';
const CIRCLE_LAYER_ID = 'buildings-circle';

export function BuildingLayer({ map, territories }: BuildingLayerProps) {
  useEffect(() => {
    if (!map) return;

    const allBuildings = territories.flatMap((t) =>
      t.buildings.map((b) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: b.position,
        },
        properties: {
          id: b.id,
          height: b.height,
          type: b.type,
          color: t.color,
        },
      }))
    );

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: allBuildings,
    };

    const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      // Circle layer for 2D representation (visible at lower pitches)
      map.addLayer({
        id: CIRCLE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14, ['/', ['get', 'height'], 20],
            18, ['/', ['get', 'height'], 5],
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 0.5,
          'circle-stroke-opacity': 0.4,
          'circle-blur': 0.1,
        },
      });
    }
  }, [map, territories]);

  return null;
}
