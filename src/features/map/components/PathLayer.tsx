import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Coordinate } from '../../../types';

interface PathLayerProps {
  map: Map;
  path: Coordinate[];
}

const SOURCE_ID = 'active-path-source';
const LAYER_ID = 'active-path-line';

export function PathLayer({ map, path }: PathLayerProps) {
  useEffect(() => {
    if (!map) return;

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: path,
      },
      properties: {},
    };

    const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      map.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#48dfe4',
          'line-width': 4,
          'line-opacity': 0.9,
          'line-dasharray': [1, 0],
        },
      });
    }
  }, [map, path]);

  return null;
}
