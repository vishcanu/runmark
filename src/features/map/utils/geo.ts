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
 * Returns true when the GPS path is a linear corridor (open path or out-and-back)
 * rather than a closed loop that encloses real area.
 *
 * Three-stage decision — any stage can classify as corridor:
 *
 * Stage 1 — closure check:
 *   End point > 25 % of total length from start → clearly going somewhere → corridor.
 *
 * Stage 2 — area check:
 *   Shoelace area / len² < 0.008 → path is flat/thin → out-and-back on same road.
 *   This handles the common case: OSRM snaps both passes to the same centerline → area = 0.
 *
 * Stage 3 — max-extent check (out-and-back with GPS deviation):
 *   When the user walks on a divided road, OSRM may snap outward/return passes
 *   to different footpaths (8-15 m apart), creating a non-zero sliver area that
 *   would fool Stage 2. Stage 3 catches this:
 *     Out-and-back: maxDist from start ≈ halfLen (you went out then came back).
 *     Any compact loop (circle/square/polygon): maxDist ≤ ~75% of halfLen
 *       (geometry: diameter / (perimeter/2) ≤ 2/π ≈ 0.64 for circles, ~0.71 for squares).
 *   Threshold 0.9 cleanly separates them for all realistic road shapes.
 */
export function isLinearPath(path: Coordinate[]): boolean {
  if (path.length < 3) return true;

  const totalLen     = totalPathDistance(path);
  const startEndDist = haversineDistance(path[0], path[path.length - 1]);
  const closureRatio = totalLen > 0 ? startEndDist / totalLen : 1;

  // Stage 1: end is far from start — user is still going, not returning
  if (closureRatio > 0.25) return true;

  // Stage 2: area check — out-and-back on same road collapses to near-zero area
  const poly    = pathToPolygon(path);
  const avgLat  = path.reduce((s, p) => s + p[1], 0) / path.length;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos(avgLat * Math.PI / 180);
  const areaM2  = _shoelaceArea(poly) * mPerLat * mPerLng;
  if (areaM2 / (totalLen * totalLen) < 0.008) return true;

  // Stage 3: max-extent check — turnaround pattern (out-and-back on divided road)
  // For out-and-back: the farthest point from start ≈ half the total distance.
  // For any compact loop: that ratio is always ≤ ~0.75.
  // 0.9 threshold gives a safe gap between the two cases.
  const halfLen = totalLen / 2;
  const maxDist = path.reduce((m, p) => Math.max(m, haversineDistance(path[0], p)), 0);
  if (halfLen > 0 && maxDist / halfLen > 0.9) return true;

  // Enclosed loop → zone with 3D walls
  return false;
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

/**
 * Build a GeoJSON-ready road ring for a closed GPS loop (e.g. walking around a block).
 *
 * Returns [outerRing, innerHole] where:
 *   outerRing = GPS centerline expanded OUTWARD by halfWidthM  (outer kerb / road edge)
 *   innerHole = GPS centerline shrunk  INWARD  by halfWidthM, reversed (inner kerb = block boundary)
 *
 * Using [outerRing, innerHole] as GeoJSON Polygon coordinates gives a donut:
 *   only the road strip is filled — the block interior (homes) stays empty.
 *
 * The centroid-based offset works correctly for any convex/near-convex block shape.
 * For an irregular shape the error is proportional to deviation from convexity — in
 * practice all real-world block perimeters are convex enough for this to look right.
 */
export function buildRoadRing(
  path: Coordinate[],
  halfWidthM: number,
): [Coordinate[], Coordinate[]] {
  const closed = pathToPolygon(path);
  const n = closed.length;
  if (n < 3) return [closed, []];

  // Centroid of the closed ring (= approximate centre of the block)
  let cLng = 0, cLat = 0;
  for (const [lng, lat] of closed) { cLng += lng; cLat += lat; }
  cLng /= n; cLat /= n;

  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((cLat * Math.PI) / 180);

  // sign = +1 → expand outward (outer road edge)
  // sign = -1 → shrink inward  (inner road edge / block boundary)
  function _offset(coords: Coordinate[], sign: number): Coordinate[] {
    return coords.map(([lng, lat]) => {
      const dLng  = lng - cLng;
      const dLat  = lat - cLat;
      const distM = Math.sqrt((dLng * mPerLng) ** 2 + (dLat * mPerLat) ** 2);
      if (distM < 0.5) return [cLng, cLat] as Coordinate; // degenerate point
      const scale = (distM + sign * halfWidthM) / distM;
      return [cLng + dLng * scale, cLat + dLat * scale] as Coordinate;
    });
  }

  const outerRing = _offset(closed, +1);           // outer road edge (away from block)
  const innerHole = _offset(closed, -1).reverse();  // inner road edge (block boundary), reversed for GeoJSON hole

  return [outerRing, innerHole];
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
