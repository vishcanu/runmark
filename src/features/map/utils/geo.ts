import type { Coordinate } from '../../../types';

/** Haversine distance in meters between two coordinates */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Total path distance in meters */
export function totalPathDistance(path: Coordinate[]): number {
  if (path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineDistance(path[i - 1], path[i]);
  }
  return total;
}

/** Convert a polyline path to a closed GeoJSON polygon ring */
export function pathToPolygon(path: Coordinate[]): Coordinate[] {
  if (path.length < 3) return path;
  const closed = [...path];
  // Close the ring by repeating first point
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closed.push([first[0], first[1]]);
  }
  return closed;
}

/** Bounding box of a list of coordinates */
export function getBoundingBox(coords: Coordinate[]): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** Format meters to readable distance string */
export function formatDistance(meters: number): string {
  if (!meters || isNaN(meters)) return '0m';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** Format seconds to readable duration string */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Pace in min/km for running. Returns formatted string e.g. "5:30"
 * Returns null when there is not enough data for a meaningful reading.
 */
export function formatPace(distanceM: number, elapsedSeconds: number): string | null {
  if (distanceM < 50 || elapsedSeconds < 5) return null;
  const paceSecsPerKm = (elapsedSeconds * 1000) / distanceM;
  if (paceSecsPerKm > 3600) return null; // slower than 60 min/km — GPS noise
  const mins = Math.floor(paceSecsPerKm / 60);
  const secs = Math.round(paceSecsPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Speed in km/h for cycling. Returns formatted string e.g. "18.2"
 * Returns null when there is not enough data for a meaningful reading.
 */
export function formatSpeed(distanceM: number, elapsedSeconds: number): string | null {
  if (distanceM < 10 || elapsedSeconds < 3) return null;
  const kmh = (distanceM / 1000) / (elapsedSeconds / 3600);
  if (kmh > 120) return null; // GPS spike guard
  return kmh.toFixed(1);
}

/**
 * Estimate step count from distance.
 * Uses WHO/sports-science average stride lengths:
 *   walk = 0.762 m/step (30 in), run = 1.4 m/step
 */
export function estimateSteps(distanceM: number, activityType: 'walk' | 'run'): number {
  const strideLength = activityType === 'walk' ? 0.762 : 1.4;
  return Math.round(distanceM / strideLength);
}

/** Format a raw step count with thousand-separator, e.g. 1234 → "1,234" */
export function formatSteps(steps: number): string {
  return steps.toLocaleString('en-US');
}

/** Average centroid of a coordinate ring */
export function polyCentroid(coords: Coordinate[]): Coordinate {
  let lng = 0, lat = 0;
  const n = coords.length;
  for (const [lo, la] of coords) { lng += lo; lat += la; }
  return [lng / n, lat / n];
}

// ── Shoelace polygon area (degrees²) ─────────────────────────
function _shoelaceArea(coords: Coordinate[]): number {
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  return Math.abs(area) / 2;
}

/**
 * Returns true when the GPS path is a linear corridor (straight run, out-and-back)
 * rather than a closed loop (block loop, park circuit).
 *
 * Two-stage decision:
 *
 * Stage 1 — closure check:
 *   If the endpoint is > 25 % of total path length away from the start, the
 *   user ran in a direction and didn't return → definitely a corridor.
 *
 * Stage 2 — area check (start ≈ end, could be loop OR out-and-back):
 *   Compute the area enclosed by the snapped path.
 *   • area / len² < 0.008 → very flat/thin shape → out-and-back → corridor.
 *   • area / len² ≥ 0.008 → meaningful enclosed area → loop → zone.
 *
 * Why not just use area?  Area alone fails on OSRM-snapped data because a
 * "straight" run along a curved road can pick up spurious area, while a small
 * block loop with few sample points can appear thin.  The closure ratio is a
 * much stronger signal of user intent.
 */
export function isLinearPath(path: Coordinate[]): boolean {
  if (path.length < 3) return true;

  const totalLen       = totalPathDistance(path);
  const startEndDist   = haversineDistance(path[0], path[path.length - 1]);
  const closureRatio   = totalLen > 0 ? startEndDist / totalLen : 1;

  // Stage 1: end is far from start → corridor
  if (closureRatio > 0.25) return true;

  // Stage 2: end is near start — distinguish loop vs out-and-back by area
  const poly    = pathToPolygon(path);
  const avgLat  = path.reduce((s, p) => s + p[1], 0) / path.length;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos(avgLat * Math.PI / 180);
  const areaM2  = _shoelaceArea(poly) * mPerLat * mPerLng;

  // Out-and-back paths collapse to near-zero area even after snapping
  return areaM2 / (totalLen * totalLen) < 0.008;
}

/**
 * Buffer a polyline by `bufferM` metres on each side, returning a closed GeoJSON ring.
 *
 * Handles two path shapes:
 *
 * Open path (start ≠ end) — straight road / corridor:
 *   Buffers each side independently, caps the ends, returns a rectangle-like ring.
 *
 * Closed loop (start ≈ end within 20 m) — block walk, park circuit:
 *   Wraps the tangent at the join point so the buffer ring closes cleanly.
 *   Result: a donut-shaped ring that covers only the road perimeter, NOT the interior.
 *   This is key — a block walk claims the 4 roads, not the block interior.
 */
export function bufferPath(path: Coordinate[], bufferM: number): Coordinate[] {
  const n = path.length;
  if (n < 2) return path;

  const avgLat   = path.reduce((s, p) => s + p[1], 0) / n;
  const mPerLat  = 111_320;
  const mPerLng  = 111_320 * Math.cos(avgLat * Math.PI / 180);
  const dLatPerM = 1 / mPerLat;
  const dLngPerM = 1 / mPerLng;

  // Detect if path is a closed loop (start and end are within 20 m of each other).
  // OSRM returns the last point ≈ first point for loop routes.
  const isClosed = haversineDistance(path[0], path[n - 1]) < 20;

  const left:  Coordinate[] = [];
  const right: Coordinate[] = [];

  for (let i = 0; i < n; i++) {
    let dx = 0, dy = 0;

    if (isClosed) {
      // Wrap: treat the path as a circular array so the tangent at
      // endpoints uses the correct neighboring points across the loop boundary.
      const prev = path[(i - 1 + n) % n];
      const next = path[(i + 1) % n];
      dx = (next[0] - prev[0]) * mPerLng;
      dy = (next[1] - prev[1]) * mPerLat;
    } else if (i === 0) {
      dx = (path[1][0] - path[0][0]) * mPerLng;
      dy = (path[1][1] - path[0][1]) * mPerLat;
    } else if (i === n - 1) {
      dx = (path[n - 1][0] - path[n - 2][0]) * mPerLng;
      dy = (path[n - 1][1] - path[n - 2][1]) * mPerLat;
    } else {
      dx = (path[i + 1][0] - path[i - 1][0]) * mPerLng;
      dy = (path[i + 1][1] - path[i - 1][1]) * mPerLat;
    }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) { left.push(path[i]); right.push(path[i]); continue; }

    // Perpendicular unit vectors: left = (-dy, dx), right = (dy, -dx)
    const px = -dy / len;
    const py =  dx / len;
    left.push( [path[i][0] + px * bufferM * dLngPerM, path[i][1] + py * bufferM * dLatPerM] as Coordinate);
    right.push([path[i][0] - px * bufferM * dLngPerM, path[i][1] - py * bufferM * dLatPerM] as Coordinate);
  }

  if (isClosed) {
    // Closed loop: left side IS the outer road edge, right side IS the inner edge.
    // Build a ring: outer forward → close outer → inner reversed → close inner.
    // GeoJSON polygon with a hole: outer ring + inner ring (reversed) = road band only.
    // We encode this as a single winding ring that traces outer forward then inner backward.
    const ring: Coordinate[] = [
      ...left,
      left[0],                          // close outer ring
      ...[...right].reverse(),          // inner edge reversed
      right[right.length - 1],          // close inner ring
      left[0],                          // close back to outer start
    ];
    return ring;
  }

  // Open path: cap both ends, return a simple rectangular corridor ring
  const ring: Coordinate[] = [...left, ...[...right].reverse(), left[0]];
  return ring;
}

/** Generate a deterministic color from a string id */
export function colorFromId(id: string): string {
  const COLORS = [
    '#6c63ff',
    '#48dfe4',
    '#f59e0b',
    '#22c55e',
    '#ec4899',
    '#3b82f6',
    '#a78bfa',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}
