import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Territory } from '../../../types';

interface TerritoryLayerProps {
  map: Map;
  territories: Territory[];
  selectedId: string | null;
  onTerritoryClick: (id: string) => void;
}

export function TerritoryLayer({
  map,
  territories,
  selectedId,
  onTerritoryClick,
}: TerritoryLayerProps) {
  useEffect(() => {
    if (!map) return;

    const SOURCE_ID = 'territories-source';
    const FILL_LAYER_ID = 'territories-fill';
    const LINE_LAYER_ID = 'territories-line';
    const SELECT_LAYER_ID = 'territories-selected';

    // Build GeoJSON FeatureCollection
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: territories.map((t) => ({
        type: 'Feature',
        id: t.id,
        geometry: {
          type: 'Polygon',
          coordinates: [t.coordinates],
        },
        properties: {
          id: t.id,
          name: t.name,
          color: t.color,
          isSelected: t.id === selectedId,
        },
      })),
    };

    // Add or update source
    const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      // Fill layer
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'isSelected'], 0.35, 0.2],
        },
      });

      // Border layer
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'isSelected'], 3, 2],
          'line-opacity': 0.9,
        },
      });

      // Selected glow overlay
      map.addLayer({
        id: SELECT_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['get', 'isSelected'], true],
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.12,
        },
      });

      // Click handler
      map.on('click', FILL_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id as string | undefined;
        if (id) onTerritoryClick(id);
      });

      map.on('mouseenter', FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }, [map, territories, selectedId, onTerritoryClick]);

  return null;
}

