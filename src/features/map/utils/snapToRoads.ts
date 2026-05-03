import type { ActivityType, Coordinate } from '../../../types';
import { simplifyPath, closeLoopIfNeeded } from './geo';

/**
 * OSRM routing profile per activity type.
 *
 * The public demo server at router.project-osrm.org only exposes two
 * profiles: `foot` and `driving`.  There is NO `bike` profile on this
 * server — requests to /match/v1/bike/ return a TooBig/Invalid error and
 * the app silently falls back to raw GPS.
 *
 * Profile choice:
 *  - walk / run → `foot`   : footways, parks, trails, shared roads.
 *  - cycle      → `foot`   : same coverage; in India cyclists share the
 *                            same roads/paths as pedestrians.  Using
 *                            `foot` gives the best match quality without
 *                            requiring a separate server.
 *
 * If you ever self-host OSRM with a `bicycle.lua` profile, change the
 * cycle entry to `'bike'` and update the base URL accordingly.
 */
const OSRM_PROFILE: Record<ActivityType, 'foot' | 'driving'> = {
  run:   'foot',
  walk:  'foot',
  cycle: 'foot',   // 'bike' does NOT exist on router.project-osrm.org
};

/**
 * OSRM snap radius in metres — how far from each GPS point to search for a
 * matching road segment.
 *
 * - walk/run: 40 m — standard GPS accuracy on footpaths.
 * - cycle:    50 m — cyclists on wider roads have more multi-path GPS error
 *                    (buildings, bridges); wider radius avoids NoMatch.
 */
const SNAP_RADIUS: Record<ActivityType, number> = {
  run:   40,
  walk:  40,
  cycle: 50,
};

/**
 * Snap a GPS path to real road/footpath geometry using the OSRM Match API.
 *
 * - Free public OSRM server (router.project-osrm.org) — no API key needed.
 * - Profile and radius are chosen per activity type (see above).
 * - Falls back to the raw GPS path silently on any error or timeout.
 *
 * Edge cases handled:
 *  - Path < 3 points: returned as-is (nothing to match).
 *  - OSRM splits result into multiple matchings (GPS gap / tunnel): flattened.
 *  - NoSegment / NoMatch / HTTP error: raw GPS path returned.
 *  - Network timeout (6 s): aborted, raw GPS path returned.
 *  - Cyclist on pedestrian-only path: bike profile returns NoMatch → raw GPS.
 */
export async function snapPathToRoads(
  path: Coordinate[],
  activityType: ActivityType = 'run',
): Promise<Coordinate[]> {
  if (path.length < 3) return path;

  try {
    const profile = OSRM_PROFILE[activityType];
    const radius  = SNAP_RADIUS[activityType];

    // OSRM match API allows max 100 waypoints per request — sample evenly.
    const MAX  = 100;
    const step = Math.max(1, Math.floor(path.length / MAX));
    const sampled: Coordinate[] = [];
    for (let i = 0; i < path.length; i += step) sampled.push(path[i]);
    // Always include the actual last point so the territory end is correct.
    const last = path[path.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);

    const coordStr = sampled
      .map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
      .join(';');
    const radii = sampled.map(() => String(radius)).join(';');
    const url   = `https://router.project-osrm.org/match/v1/${profile}/${coordStr}?overview=full&geometries=geojson&radiuses=${radii}`;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return path;

    const data = await res.json();
    if (!Array.isArray(data.matchings) || data.matchings.length === 0) return path;

    // Flatten all match segments (OSRM splits on GPS gaps, e.g. tunnel/bridge)
    const snapped: Coordinate[] = data.matchings.flatMap(
      (m: { geometry?: { coordinates?: Coordinate[] } }) =>
        (m.geometry?.coordinates ?? []) as Coordinate[],
    );

    if (snapped.length < 3) return path;

    // ── Post-process the snapped path ───────────────────────────────────
    //
    // OSRM returns one point per interpolated road node — a 200m straight
    // road may have 15-20 nearly-identical points.  Without simplification
    // these become 15-20 polygon vertices on what should be a straight wall.
    //
    // 1. RDP simplify at 8 m epsilon:
    //    - Removes redundant straight-segment points (road noise < 5 m)
    //    - Preserves real corners (deviation at a 90° turn ≈ 30-50 m >> 8 m)
    //    - Preserves curves proportionally (circle r=50 m → ~16 pts remain)
    //
    // 2. Close the loop if the user walked back to their start:
    //    - Replaces last point with first point when distance < 20 m
    //    - Prevents micro-gap / extra edge at the polygon join point
    //    - Works for all loop shapes: rectangle, oval, irregular polygon
    const simplified = simplifyPath(snapped, 8);
    const cleaned    = closeLoopIfNeeded(simplified, 20);

    return cleaned.length >= 3 ? cleaned : path;
  } catch {
    // timeout, network error, JSON parse error — always fall back to raw GPS
    return path;
  }
}
