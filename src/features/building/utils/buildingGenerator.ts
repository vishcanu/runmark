import type { Coordinate, Building, BuildingType } from '../../../types';
import { getBoundingBox } from '../../map/utils/geo';
import { pointInPolygon } from '../../territory/utils/polygonUtils';

/** Determine building type by height */
function heightToType(height: number): BuildingType {
  if (height < 20) return 'cottage';
  if (height < 50) return 'tower';
  if (height < 100) return 'skyscraper';
  return 'landmark';
}

/**
 * Generate buildings inside a polygon.
 * @param polygon  Closed coordinate ring.
 * @param distance Distance walked in meters → controls count.
 * @param duration Duration in seconds → controls height.
 */
export function generateBuildings(
  polygon: Coordinate[],
  distance: number,
  duration: number,
  existingIds?: Set<string>
): Building[] {
  if (polygon.length < 4) return [];

  const bbox = getBoundingBox(polygon);
  const lngSpan = bbox.maxLng - bbox.minLng;
  const latSpan = bbox.maxLat - bbox.minLat;

  // Scale building count by distance (1 per 50m, min 3, max 60)
  const count = Math.min(60, Math.max(3, Math.floor(distance / 50)));

  // Base height from duration (1m per 10 seconds, min 10, max 120)
  const baseHeight = Math.min(120, Math.max(10, Math.floor(duration / 10)));

  const buildings: Building[] = [];
  let attempts = 0;
  const maxAttempts = count * 20;

  while (buildings.length < count && attempts < maxAttempts) {
    attempts++;

    // Deterministic pseudo-random using attempt index
    const t1 = Math.sin(attempts * 127.1 + buildings.length * 311.7) * 43758.5453123;
    const t2 = Math.sin(attempts * 269.5 + buildings.length * 183.3) * 43758.5453123;

    const lng = bbox.minLng + (t1 - Math.floor(t1)) * lngSpan;
    const lat = bbox.minLat + (t2 - Math.floor(t2)) * latSpan;
    const position: Coordinate = [lng, lat];

    if (!pointInPolygon(position, polygon)) continue;

    const heightVariance = Math.sin(attempts * 57.3) * 0.5 + 0.5;
    const height = Math.round(baseHeight * (0.5 + heightVariance));

    const id = `b-${buildings.length}-${Math.round(lng * 1e6)}-${Math.round(lat * 1e6)}`;
    if (existingIds?.has(id)) continue;

    buildings.push({
      id,
      position,
      height,
      type: heightToType(height),
    });
  }

  return buildings;
}
