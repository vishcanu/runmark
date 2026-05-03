import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Coordinate } from '../../../types';
import { haversineDistance } from '../utils/geo';

interface PathLayerProps {
  map: Map;
  path: Coordinate[];
}

const SRC_PATH    = 'active-path-source';
const SRC_START   = 'active-path-start-source';
const SRC_CURSOR  = 'active-path-cursor-source';
const L_LINE      = 'active-path-line';
const L_LINE_GLOW = 'active-path-line-glow';
const L_START     = 'active-path-start';
const L_START_RING = 'active-path-start-ring';
const L_CURSOR    = 'active-path-cursor';

const CLOSE_LOOP_M = 30;

// ── Ramer-Douglas-Peucker path simplification ─────────────────
// Removes GPS noise while preserving real direction changes.
// epsilon = max perpendicular deviation to keep (metres).

function _perpDistM(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const lat = (a[1] + b[1]) / 2;
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

export function PathLayer({ map, path }: PathLayerProps) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;

    // Smooth the raw GPS path for display — removes criss-cross jitter
    // while keeping real turns. 20 m epsilon is aggressive enough to lock
    // the drawn line to the road centerline visually.
    const drawPath = path.length > 4 ? _rdp(path, 20) : path;

    const lineGeo = (): GeoJSON.Feature<GeoJSON.LineString> => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: drawPath },
      properties: {},
    });

    const startPt = path.length > 0 ? path[0] : null;
    const curPt   = path.length > 1 ? path[path.length - 1] : null;
    const distToStart = startPt && curPt ? haversineDistance(startPt, curPt) : Infinity;
    const nearStart = path.length >= 4 && distToStart <= CLOSE_LOOP_M;

    const startGeo = (): GeoJSON.FeatureCollection => ({
      type: 'FeatureCollection',
      features: startPt
        ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: startPt }, properties: { near: nearStart ? 1 : 0 } }]
        : [],
    });

    const cursorGeo = (): GeoJSON.FeatureCollection => ({
      type: 'FeatureCollection',
      features: curPt
        ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: curPt }, properties: {} }]
        : [],
    });

    const existingSrc = map.getSource(SRC_PATH) as GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(lineGeo());
      (map.getSource(SRC_START)  as GeoJSONSource)?.setData(startGeo());
      (map.getSource(SRC_CURSOR) as GeoJSONSource)?.setData(cursorGeo());
    } else {
      map.addSource(SRC_PATH,   { type: 'geojson', data: lineGeo()  });
      map.addSource(SRC_START,  { type: 'geojson', data: startGeo() });
      map.addSource(SRC_CURSOR, { type: 'geojson', data: cursorGeo() });

      // Glow underline
      map.addLayer({
        id: L_LINE_GLOW, type: 'line', source: SRC_PATH,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#48dfe4', 'line-width': 14, 'line-opacity': 0.18, 'line-blur': 8 },
      });

      // Crisp trail line
      map.addLayer({
        id: L_LINE, type: 'line', source: SRC_PATH,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#48dfe4', 'line-width': 3.5, 'line-opacity': 0.95 },
      });

      // Start dot outer ring (pulses green when near start)
      map.addLayer({
        id: L_START_RING, type: 'circle', source: SRC_START,
        paint: {
          'circle-radius':       16,
          'circle-color':        'transparent',
          'circle-stroke-color': ['case', ['==', ['get', 'near'], 1], '#22c55e', '#48dfe4'],
          'circle-stroke-width': ['case', ['==', ['get', 'near'], 1], 2.5, 1.5],
          'circle-stroke-opacity': ['case', ['==', ['get', 'near'], 1], 0.9, 0.45],
        },
      });

      // Start dot fill
      map.addLayer({
        id: L_START, type: 'circle', source: SRC_START,
        paint: {
          'circle-radius':       7,
          'circle-color':        '#22c55e',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity':      1.0,
        },
      });

      // Current position dot
      map.addLayer({
        id: L_CURSOR, type: 'circle', source: SRC_CURSOR,
        paint: {
          'circle-radius':       6,
          'circle-color':        '#ffffff',
          'circle-stroke-color': '#48dfe4',
          'circle-stroke-width': 2.5,
          'circle-opacity':      1.0,
        },
      });
    }

    // Animate start ring pulse
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let phase = 0;
    let lastFrame = 0;
    const animate = (now: number) => {
      rafRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < 50) return; // 20 fps
      lastFrame = now;
      phase += 0.08;
      const pulse = 0.5 + 0.5 * Math.sin(phase);
      try {
        if (map.getLayer(L_START_RING)) {
          const r = nearStart ? 16 + pulse * 6 : 16;
          const op = nearStart ? 0.7 + pulse * 0.3 : 0.45;
          map.setPaintProperty(L_START_RING, 'circle-radius', r);
          map.setPaintProperty(L_START_RING, 'circle-stroke-opacity', op);
        }
      } catch { /* mid-teardown */ }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [map, path]);

  return null;
}
