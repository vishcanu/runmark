import type { ActivityType, Coordinate } from '../../../types';

/**
 * OSRM routing profile per activity type.
 *
 * - `foot`: pedestrians, runners — footpaths, parks, trails, streets.
 * - `bike`: cyclists — cycling infrastructure, roads; excludes pedestrian-only paths.
 *
 * Using the wrong profile degrades match quality: e.g. `foot` on a cycle lane
 * may snap to the parallel pavement; `bike` on a footpath-only park path
 * will return NoMatch and we fall back to raw GPS automatically.
 */
const OSRM_PROFILE: Record<ActivityType, 'foot' | 'bike'> = {
  run:   'foot',
  walk:  'foot',
  cycle: 'bike',
};

/**
 * OSRM snap radius in metres — how far from each GPS point to search for a
 * matching road segment.
 *
 * - foot (walk/run): 40 m — standard GPS accuracy on footpaths.
 * - bike: 50 m — cyclists ride on wider roads where GPS drift (multi-path
 *   from buildings, overpasses) is larger; wider search avoids NoMatch.
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

    return snapped.length >= 3 ? snapped : path;
  } catch {
    // timeout, network error, JSON parse error — always fall back to raw GPS
    return path;
  }
}
