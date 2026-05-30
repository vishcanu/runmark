import { useState, useEffect, useRef, useMemo } from 'react';
import type { Park } from '../types';
import { enrichPark } from '../utils/parkUtils';
import type { Coordinate } from '../../../types';
import { getMapInstance } from '../../map/mapSingleton';

// Strategy: map tiles FIRST (instant, no network), Overpass API in background.
// queryRenderedFeatures() reads park/water polygons already drawn on screen.
// Overpass runs silently and refreshes the localStorage cache on success.

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const SEARCH_RADIUS_M         = 5000;
const CACHE_TTL_MS            = 24 * 60 * 60 * 1000;
const LS_CACHE_KEY            = 'parks_cache_v2';
const PER_ENDPOINT_TIMEOUT_MS = 20_000;
const MAP_QUERY_DELAY_MS      = 1_200;

const MAP_PARK_LAYERS  = ['park', 'nature-green', 'pitch'];
const MAP_WATER_LAYERS = ['water'];

function queryParksFromMap(): Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[] {
  const map = getMapInstance();
  if (!map) return [];
  try {
    const features = map.queryRenderedFeatures(undefined, {
      layers: [...MAP_PARK_LAYERS, ...MAP_WATER_LAYERS],
    });
    const seen    = new Set<string>();
    const results: Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[] = [];
    for (const feat of features) {
      const name = (feat.properties?.name ?? feat.properties?.['name:en']) as string | undefined;
      if (!name?.trim()) continue;
      const key = name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      let cLng = 0, cLat = 0, valid = false;
      const geom = feat.geometry as unknown as GeoJSON.Geometry;
      if (geom.type === 'Polygon') {
        const ring = (geom as GeoJSON.Polygon).coordinates[0];
        if (ring?.length) { cLng = ring.reduce((s,c)=>s+c[0],0)/ring.length; cLat = ring.reduce((s,c)=>s+c[1],0)/ring.length; valid = true; }
      } else if (geom.type === 'MultiPolygon') {
        const ring = (geom as GeoJSON.MultiPolygon).coordinates[0]?.[0];
        if (ring?.length) { cLng = ring.reduce((s,c)=>s+c[0],0)/ring.length; cLat = ring.reduce((s,c)=>s+c[1],0)/ring.length; valid = true; }
      } else if (geom.type === 'Point') {
        [cLng, cLat] = (geom as GeoJSON.Point).coordinates; valid = true;
      }
      if (!valid) continue;
      const isWater = MAP_WATER_LAYERS.includes(feat.layer.id);
      results.push({
        id: `map-${key.replace(/[^a-z0-9]/g,'-')}`,
        name: name.trim(), lat: cLat, lng: cLng,
        placeType: isWater ? 'lake' : feat.properties?.leisure === 'garden' ? 'garden' : 'park',
      });
    }
    return results.slice(0, 20);
  } catch { return []; }
}

interface CacheEntry {
  parks: Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[];
  timestamp: number; lat: number; lng: number;
}

function loadCacheFromLS(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CacheEntry;
    if (!Array.isArray(p.parks) || typeof p.timestamp !== 'number') return null;
    return p;
  } catch { return null; }
}
function saveCacheToLS(entry: CacheEntry): void {
  try { localStorage.setItem(LS_CACHE_KEY, JSON.stringify(entry)); } catch { /* full */ }
}

let cache: CacheEntry | null = loadCacheFromLS();
let _lastKnownParks: Park[] = [];

function isCacheValid(lat: number, lng: number): boolean {
  if (!cache) return false;
  if (Date.now() - cache.timestamp > CACHE_TTL_MS) return false;
  const dlat = Math.abs(cache.lat - lat) * 111_320;
  const dlng = Math.abs(cache.lng - lng) * 111_320;
  return Math.sqrt(dlat ** 2 + dlng ** 2) < 500;
}

async function fetchParksFromOSM(lat: number, lng: number): Promise<Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[]> {
  const query = `[out:json][timeout:18];(way[leisure=park](around:${SEARCH_RADIUS_M},${lat},${lng});relation[leisure=park](around:${SEARCH_RADIUS_M},${lat},${lng});way[leisure=garden](around:${SEARCH_RADIUS_M},${lat},${lng});way[natural=water][name](around:${SEARCH_RADIUS_M},${lat},${lng});relation[natural=water][name](around:${SEARCH_RADIUS_M},${lat},${lng}););out center tags;`;
  type OsmData = { elements: { id:number;type:string;center?:{lat:number;lon:number};lat?:number;lon?:number;tags?:{name?:string;leisure?:string;natural?:string}; }[]; };
  let lastError: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), PER_ENDPOINT_TIMEOUT_MS);
    try {
      const resp = await fetch(url, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`data=${encodeURIComponent(query)}`, signal:ctrl.signal });
      clearTimeout(tid);
      if (!resp.ok) { lastError = new Error(`HTTP ${resp.status}`); continue; }
      const data = (await resp.json()) as OsmData;
      return data.elements.filter(el=>el.tags?.name&&(el.center||(el.lat&&el.lon))).map(el=>({ id:`osm-${el.id}`, name:el.tags!.name!, lat:el.center?.lat??el.lat!, lng:el.center?.lon??el.lon!, placeType: el.tags?.natural==='water'?('lake' as const):el.tags?.leisure==='garden'?('garden' as const):('park' as const) }));
    } catch (err) { clearTimeout(tid); lastError = err; }
  }
  throw lastError ?? new Error('All endpoints failed');
}

export interface ParkSearchState { parks: Park[]; loading: boolean; error: string | null; }

export function useParkSearch(userPosition: Coordinate | null, claimedParkIds?: Set<string>): ParkSearchState {
  const claimedKey = useMemo(
    () => (claimedParkIds ? [...claimedParkIds].sort().join(',') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claimedParkIds ? [...claimedParkIds].sort().join(',') : '']
  );

  const [state, setState] = useState<ParkSearchState>(() => ({ parks: _lastKnownParks, loading: _lastKnownParks.length === 0, error: null }));
  const mapTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overpassRef       = useRef(false);
  const posRef            = useRef<Coordinate | null>(null);

  useEffect(() => { return () => { if (mapTimerRef.current) clearTimeout(mapTimerRef.current); }; }, []);

  useEffect(() => {
    if (!userPosition) return;
    posRef.current = userPosition;
    const [lng, lat] = userPosition;

    // 1. Serve from valid localStorage cache immediately
    if (isCacheValid(lat, lng) && cache!.parks.length > 0) {
      const enriched = cache!.parks.map(p=>enrichPark(p,lat,lng,claimedParkIds??new Set())).sort((a,b)=>a.distance-b.distance).slice(0,10);
      _lastKnownParks = enriched;
      setState({ parks: enriched, loading: false, error: null });
      return;
    }

    // 2. Query map tiles after flyTo settles
    if (mapTimerRef.current) clearTimeout(mapTimerRef.current);
    mapTimerRef.current = setTimeout(() => {
      const mapParks = queryParksFromMap();
      if (mapParks.length > 0) {
        const enriched = mapParks.map(p=>enrichPark(p,lat,lng,claimedParkIds??new Set())).sort((a,b)=>a.distance-b.distance).slice(0,10);
        _lastKnownParks = enriched;
        setState({ parks: enriched, loading: false, error: null });
      }

      // 3. Overpass in background
      if (overpassRef.current) return;
      overpassRef.current = true;
      fetchParksFromOSM(lat, lng)
        .then(raw => {
          if (!posRef.current) return;
          const [cLng, cLat] = posRef.current;
          cache = { parks: raw, timestamp: Date.now(), lat: cLat, lng: cLng };
          saveCacheToLS(cache);
          const enriched = raw.map(p=>enrichPark(p,cLat,cLng,claimedParkIds??new Set())).sort((a,b)=>a.distance-b.distance).slice(0,10);
          _lastKnownParks = enriched;
          setState({ parks: enriched, loading: false, error: null });
        })
        .catch(() => { if (_lastKnownParks.length===0) setState(s=>({...s,loading:false,error:'Could not load nearby places'})); })
        .finally(() => { overpassRef.current = false; });
    }, MAP_QUERY_DELAY_MS);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, claimedKey]);

  return state;
}
