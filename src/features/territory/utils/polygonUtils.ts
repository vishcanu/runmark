import type { Coordinate } from '../../../types';

/**
 * Ray-casting algorithm: returns true if the point is inside the polygon.
 * Polygon is a closed ring (first == last point is acceptable).
 */
export function pointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  const [px, py] = point;
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Signed area of a polygon (Shoelace formula, in coordinate units²).
 * Positive = CCW, negative = CW.
 */
export function polygonArea(polygon: Coordinate[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += polygon[j][0] * polygon[i][1];
    area -= polygon[i][0] * polygon[j][1];
  }
  return area / 2;
}

/**
 * Approximate polygon area in m² using a degree-to-meter conversion.
 */
export function polygonAreaMeters(polygon: Coordinate[]): number {
  const METERS_PER_DEG_LAT = 111320;
  const avgLat =
    polygon.reduce((sum, c) => sum + c[1], 0) / polygon.length;
  const metersPerDegLng = Math.cos((avgLat * Math.PI) / 180) * METERS_PER_DEG_LAT;

  let area = 0;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const x1 = polygon[j][0] * metersPerDegLng;
    const y1 = polygon[j][1] * METERS_PER_DEG_LAT;
    const x2 = polygon[i][0] * metersPerDegLng;
    const y2 = polygon[i][1] * METERS_PER_DEG_LAT;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}
