import type { Coordinate } from '../../../types';

/**
 * Snap a GPS path to real road/footpath geometry using the OSRM Match API.
 *
 * - Free public OSRM server (router.project-osrm.org) — no API key needed.
 * - `foot` profile includes streets, footpaths, parks, trails.
 * - 40m search radius is forgiving enough for parks and alleys.
 * - Falls back to the raw GPS path silently on any error or timeout.
 *
 * Result: a smooth path that follows actual road geometry → clean territory edges.
 */
export async function snapPathToRoads(path: Coordinate[]): Promise<Coordinate[]> {
  if (path.length < 3) return path;

  try {
    // OSRM match API allows max 100 waypoints per request
    const MAX = 100;
    const sampled: Coordinate[] = [];
    const step = Math.max(1, Math.floor(path.length / MAX));
    for (let i = 0; i < path.length; i += step) sampled.push(path[i]);
    // Always include the actual last point
    const last = path[path.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);

    const coordStr  = sampled.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
    const radii     = sampled.map(() => '40').join(';');
    const url       = `https://router.project-osrm.org/match/v1/foot/${coordStr}?overview=full&geometries=geojson&radiuses=${radii}`;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);  // 6s timeout

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return path;

    const data = await res.json();
    if (!Array.isArray(data.matchings) || data.matchings.length === 0) return path;

    // Flatten all match segments (OSRM may split on GPS gaps) into one path
    const snapped: Coordinate[] = data.matchings.flatMap(
      (m: { geometry?: { coordinates?: Coordinate[] } }) =>
        (m.geometry?.coordinates ?? []) as Coordinate[],
    );

    return snapped.length >= 3 ? snapped : path;
  } catch {
    return path; // timeout, network error, parse error — always fall back
  }
}
