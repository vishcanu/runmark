import type { Coordinate } from '../../../types';
import type { Map as MapLibreMap } from 'maplibre-gl';

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

/**
 * Closest point on line segment A→B to point P.
 * Returns the projected (clamped) [lng, lat] coordinate on the segment.
 */
export function closestPointOnSegment(
  p: Coordinate,
  a: Coordinate,
  b: Coordinate,
): Coordinate {
  const avgLat = (p[1] + a[1] + b[1]) / 3;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos(avgLat * Math.PI / 180);
  const px = (p[0] - a[0]) * mPerLng, py = (p[1] - a[1]) * mPerLat;
  const bx = (b[0] - a[0]) * mPerLng, by = (b[1] - a[1]) * mPerLat;
  const len2 = bx * bx + by * by;
  if (len2 < 0.01) return a;
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] as Coordinate;
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
 * Simplify a closed polygon ring (where first point === last point).
 * Opens the ring, runs RDP, then re-closes — so the GeoJSON ring stays valid.
 *
 * Why needed: bufferPath / buildRoadRing create one polygon vertex per GPS/snap
 * node. A straight 200 m road produces 8+ nearly-collinear vertices → wavy wall.
 * 5 m epsilon removes all straight-section redundancy while keeping every real
 * corner (a 90° turn deviates ~30 m >> 5 m, always preserved).
 */
export function simplifyRing(ring: Coordinate[], epsilonM = 5): Coordinate[] {
  if (ring.length <= 4) return ring;
  const first = ring[0], last = ring[ring.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];
  const open = isClosed ? ring.slice(0, -1) : ring;
  if (open.length <= 3) return ring;
  const simplified = _rdp(open, epsilonM);
  return isClosed ? [...simplified, simplified[0]] : simplified;
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
 * Uses per-segment perpendicular offset with miter joins at corners.
 * This produces clean parallel edges that follow the road geometry precisely —
 * rectangular blocks become clean rectangular rings, curved roads stay curved.
 *
 * At very sharp corners (miter ratio > MITER_LIMIT) a bevel join is used instead
 * to prevent extreme spikes.
 */
export function buildRoadRing(
  path: Coordinate[],
  halfWidthM: number,
): [Coordinate[], Coordinate[]] {
  const closed = pathToPolygon(path);
  const rawPts = closed.slice(0, -1);
  if (rawPts.length < 3) return [closed, []];

  const avgLat  = rawPts.reduce((s, p) => s + p[1], 0) / rawPts.length;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos(avgLat * Math.PI / 180);
  const dLatPerM = 1 / mPerLat;
  const dLngPerM = 1 / mPerLng;

  // Deduplicate: drop consecutive points closer than halfWidthM * 0.5.
  // GPS near corners records many points 1-3m apart; these create near-zero-length
  // segments whose normals are numerically unstable, producing miter spikes.
  const minSegM = Math.max(halfWidthM * 0.5, 2.0);
  const pts: Coordinate[] = [rawPts[0]];
  for (let i = 1; i < rawPts.length; i++) {
    const prev = pts[pts.length - 1];
    const dx = (rawPts[i][0] - prev[0]) * mPerLng;
    const dy = (rawPts[i][1] - prev[1]) * mPerLat;
    if (Math.sqrt(dx * dx + dy * dy) >= minSegM) pts.push(rawPts[i]);
  }
  const n = pts.length;
  if (n < 3) return [closed, []];

  // Centroid — used only to determine outward vs inward direction for each vertex
  let cLng = 0, cLat = 0;
  for (const [lng, lat] of pts) { cLng += lng; cLat += lat; }
  cLng /= n; cLat /= n;

  // Miter limit: 2.0 = bevel sooner → clean road corners, no large spikes.
  // (was 4.0, which allowed 14m spikes at near-acute GPS pseudo-corners)
  const MITER_LIMIT = 2.0;

  /**
   * Compute offset vertex/vertices for ring position i.
   * sign = +1 → outward (outer road edge)
   * sign = -1 → inward  (inner block boundary)
   * Returns 1 point (miter join) or 2 points (bevel join at very sharp corners).
   */
  function _offsetVertex(sign: number, i: number): Coordinate[] {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    // Incoming segment (prev→curr) in metres
    const s1x = (curr[0] - prev[0]) * mPerLng;
    const s1y = (curr[1] - prev[1]) * mPerLat;
    const l1  = Math.sqrt(s1x * s1x + s1y * s1y);

    // Outgoing segment (curr→next) in metres
    const s2x = (next[0] - curr[0]) * mPerLng;
    const s2y = (next[1] - curr[1]) * mPerLat;
    const l2  = Math.sqrt(s2x * s2x + s2y * s2y);

    // Skip segments shorter than 25% of halfWidthM — numerically unstable normals
    if (l1 < halfWidthM * 0.25 || l2 < halfWidthM * 0.25) return [curr];

    // Left normals (rotate segment direction 90° CCW)
    const n1x = -s1y / l1, n1y = s1x / l1;
    const n2x = -s2y / l2, n2y = s2x / l2;

    // Determine if "left" of incoming segment points away from centroid (= outward)
    const toCx = (cLng - curr[0]) * mPerLng;
    const toCy = (cLat - curr[1]) * mPerLat;
    const outwardSign = (n1x * toCx + n1y * toCy) < 0 ? 1 : -1;

    // Outward unit normals for each segment
    const o1x = outwardSign * n1x, o1y = outwardSign * n1y;
    const o2x = outwardSign * n2x, o2y = outwardSign * n2y;

    // Bisector of the two outward normals
    const mx = o1x + o2x;
    const my = o1y + o2y;
    const ml = Math.sqrt(mx * mx + my * my);

    if (ml < 1e-10) {
      // Anti-parallel normals (hairpin) — bevel with both normals
      return [
        [curr[0] + sign * o1x * halfWidthM * dLngPerM,
         curr[1] + sign * o1y * halfWidthM * dLatPerM] as Coordinate,
        [curr[0] + sign * o2x * halfWidthM * dLngPerM,
         curr[1] + sign * o2y * halfWidthM * dLatPerM] as Coordinate,
      ];
    }

    // Miter scale = halfWidthM / sin(half-angle) = halfWidthM * 2 / |n1+n2|
    // ml=2 (straight, 0° turn): miterM = halfWidthM ✓
    // ml=√2 (90° turn):         miterM = halfWidthM * √2 ✓
    const miterM = halfWidthM * 2 / ml;

    if (miterM > MITER_LIMIT * halfWidthM) {
      // Corner too sharp — bevel to avoid ugly spikes
      return [
        [curr[0] + sign * o1x * halfWidthM * dLngPerM,
         curr[1] + sign * o1y * halfWidthM * dLatPerM] as Coordinate,
        [curr[0] + sign * o2x * halfWidthM * dLngPerM,
         curr[1] + sign * o2y * halfWidthM * dLatPerM] as Coordinate,
      ];
    }

    // Miter: single point along the bisector at the correct perpendicular distance
    const ux = mx / ml, uy = my / ml;
    return [[
      curr[0] + sign * ux * miterM * dLngPerM,
      curr[1] + sign * uy * miterM * dLatPerM,
    ] as Coordinate];
  }

  const outerPts: Coordinate[] = [];
  const innerPts: Coordinate[] = [];

  for (let i = 0; i < n; i++) {
    outerPts.push(..._offsetVertex(+1, i));
    innerPts.push(..._offsetVertex(-1, i));
  }

  // Close the rings; inner ring reversed for GeoJSON hole winding convention
  const outerRing: Coordinate[] = [...outerPts, outerPts[0]];
  const innerRevPts = [...innerPts].reverse();
  const innerHole: Coordinate[] = [...innerRevPts, innerRevPts[0]];

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

// ── Road layer names in OFM Liberty style ─────────────────────────────────
const _ROAD_SNAP_LAYERS = [
  'road-motorway', 'road-trunk', 'road-primary',
  'road-secondary-tertiary', 'road-street', 'road-street-low',
  'road-service-link', 'road-path', 'road-track',
];

/**
 * Snap every GPS/OSRM point onto the nearest rendered road segment in the map tiles.
 *
 * Why this is the right fallback:
 *   - OSRM times out from India → raw GPS is 10–30 m off the road → zig-zag territory
 *   - Map tiles already contain actual OSM road geometry (rendered at the current view)
 *   - For each path point, we query rendered road features within 30 px and project
 *     the GPS coordinate onto the closest road segment using `closestPointOnSegment`
 *   - This anchors every point exactly on a visible road, fixing both scatter and diagonals
 *
 * Constraints:
 *   - Only snaps if the nearest road segment is within 35 m (prevents snapping to wrong road)
 *   - Silently keeps the original point if no road feature is found nearby
 *   - Works completely offline — no network dependency
 *   - Requires the map to be showing the walked area (it always is right after a run)
 */
export function projectToRenderedRoads(
  path: Coordinate[],
  map: MapLibreMap,
): Coordinate[] {
  const MAX_SNAP_M = 35; // don't snap if nearest road is > 35 m away
  const PX_RADIUS  = 28; // pixel search box half-size

  return path.map((point) => {
    try {
      const px = map.project(point as [number, number]);
      const features = map.queryRenderedFeatures(
        [[px.x - PX_RADIUS, px.y - PX_RADIUS],
         [px.x + PX_RADIUS, px.y + PX_RADIUS]],
        { layers: _ROAD_SNAP_LAYERS },
      );
      if (!features.length) return point;

      let best: Coordinate = point;
      let bestDist = Infinity;

      for (const feat of features) {
        if (feat.geometry.type !== 'LineString') continue;
        const coords = feat.geometry.coordinates as number[][];
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i]   as Coordinate;
          const b = coords[i+1] as Coordinate;
          const proj = closestPointOnSegment(point, a, b);
          const d    = haversineDistance(point, proj);
          if (d < bestDist) { bestDist = d; best = proj; }
        }
      }

      return bestDist <= MAX_SNAP_M ? best : point;
    } catch {
      return point; // off-screen or style mismatch — keep original
    }
  });
}
