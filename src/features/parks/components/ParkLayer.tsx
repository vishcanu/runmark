import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Park } from '../types';

interface ParkLayerProps {
  map: Map;
  parks: Park[];
  closestParkId: string | null;
}

const SOURCE_ID = 'parks-source';
const CIRCLE_LAYER = 'parks-circle';
const PULSE_LAYER = 'parks-pulse';

export function ParkLayer({ map, parks, closestParkId }: ParkLayerProps) {
  useEffect(() => {
    if (!map || parks.length === 0) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: parks.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          name: p.name,
          placeType: p.placeType,
          isClosest: p.id === closestParkId,
          isClaimed: p.isClaimed,
          walkMinutes: p.walkMinutes,
        },
      })),
    };

    const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
      return;
    }

    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

    // Outer pulse ring for closest park
    map.addLayer({
      id: PULSE_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'isClosest'], true],
      paint: {
        'circle-radius': 24,
        'circle-color': '#16a34a',
        'circle-opacity': 0.12,
        'circle-stroke-color': '#16a34a',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.35,
      },
    });

    // Core dot — green for parks/gardens, blue for lakes, indigo for claimed
    map.addLayer({
      id: CIRCLE_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'isClosest'], true], 9,
          6,
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'isClaimed'], true], '#4f46e5',
          ['==', ['get', 'placeType'], 'lake'], '#0284c7',
          '#16a34a',
        ],
        'circle-opacity': 0.95,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 1,
      },
    });
  }, [map, parks, closestParkId]);

  return null;
}
