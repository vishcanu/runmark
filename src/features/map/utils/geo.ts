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

// ── Ramer-Douglas-Peucker path simplification ─────────────────────────────
//
// Removes redundant points from a path while preserving all real geometry:
//   - Points on a straight road segment that add no shape → removed
//   - Real corners (intersections, turns) → kept (large perpendicular deviation)
//   - Curves → kept proportionally (tighter curve = more points kept)
//
// epsilon: max perpendicular deviation in metres to still drop a point.
//   8 m  → road-centerline noise removed, gentle curves preserved
//   A 90° intersection corner deviates 30-50 m → always kept.
//   A circular road with r=50 m keeps ~16 points → visually smooth circle.

function _perpDistM(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const lat  = (a[1] + b[1]) / 2;
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos(lat * Math.PI / 180);
  const ax = a[0] * mLng, ay = a[1] * mLat;
  const bx = b[0] * mLng, by = b[1] * mLat;
  const px = p[0] * mLng, py = p[1] * mLat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dx * (ay - py) - dy * (ax - px)) / Math.sqrt(len2);
}

function _rdp(pts: Coordinate[], eps: number): Coordinate[] {
  if (pts.length <= 2) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = _perpDistM(pts[i], a, b);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const L = _rdp(pts.slice(0, idx + 1), eps);
    const R = _rdp(pts.slice(idx), eps);
    return [...L.slice(0, -1), ...R];
  }
  return [a, b];
}

/**
 * Simplify a coordinate path using Ramer-Douglas-Peucker.
 * epsilon = 8 m is the right value for post-OSRM road paths:
 *   - removes straight-road redundancy (GPS/snap noise < 5 m)
 *   - preserves real corners (deviation > 20 m at any real turn)
 *   - preserves curves (arc deviation > 8 m for r < ~350 m roads)
 */
export function simplifyPath(path: Coordinate[], epsilonM = 8): Coordinate[] {
  if (path.length <= 3) return path;
  return _rdp(path, epsilonM);
}

/**
 * Close a loop path cleanly.
 *
 * When the user walks a loop (start ≈ end), OSRM returns a last point that
 * is close to but not exactly the first point. This leaves a small gap or
 * micro-edge at the join.
 *
 * If start and end are within `thresholdM` metres, replace the last point
 * with the first point exactly — ensuring the polygon ring closes with zero gap.
 */
export function closeLoopIfNeeded(path: Coordinate[], thresholdM = 20): Coordinate[] {
  if (path.length < 3) return path;
  if (haversineDistance(path[0], path[path.length - 1]) < thresholdM) {
    return [...path.slice(0, -1), path[0]];
  }
  return path;
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
 * Buffer a polyline by `bufferM` metres on each side, returning a closed ring.
 * Used to turn an out-and-back road run into a corridor polygon.
 */
export function bufferPath(path: Coordinate[], bufferM: number): Coordinate[] {
  const n = path.length;
  if (n < 2) return path;
  const avgLat  = path.reduce((s, p) => s + p[1], 0) / n;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos(avgLat * Math.PI / 180);
  const dLatPerM = 1 / mPerLat;
  const dLngPerM = 1 / mPerLng;

  const left:  Coordinate[] = [];
  const right: Coordinate[] = [];

  for (let i = 0; i < n; i++) {
    // tangent direction: average of adjacent segments
    let dx = 0, dy = 0;
    if (i === 0) {
      dx = (path[1][0] - path[0][0]) * mPerLng;
      dy = (path[1][1] - path[0][1]) * mPerLat;
    } else if (i === n - 1) {
      dx = (path[n-1][0] - path[n-2][0]) * mPerLng;
      dy = (path[n-1][1] - path[n-2][1]) * mPerLat;
    } else {
      dx = (path[i+1][0] - path[i-1][0]) * mPerLng;
      dy = (path[i+1][1] - path[i-1][1]) * mPerLat;
    }
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) { left.push(path[i]); right.push(path[i]); continue; }
    // perpendicular unit vectors: (-dy,dx) = left, (dy,-dx) = right
    const px = -dy / len;
    const py =  dx / len;
    left.push( [path[i][0] + px * bufferM * dLngPerM, path[i][1] + py * bufferM * dLatPerM] as Coordinate);
    right.push([path[i][0] - px * bufferM * dLngPerM, path[i][1] - py * bufferM * dLatPerM] as Coordinate);
  }

  // ring: left side forward → right side reversed → close
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
