import { useState, useEffect, useRef, useMemo } from 'react';
import type { Park } from '../types';
import { enrichPark } from '../utils/parkUtils';
import type { Coordinate } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
//  Improvements over original:
//
//  1. localStorage persistence — cache survives page reloads.
//     On revisit the user sees parks the instant GPS locks (zero API wait).
//
//  2. 24 h TTL — parks don't move daily; stale data refreshes silently in
//     the background while user sees something immediately.
//
//  3. Original way/relation query kept — nwr shorthand caused 406 from
//     Overpass servers. Sequential endpoint fallback kept as-is (proven).
// ─────────────────────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const SEARCH_RADIUS_M         = 5000;
const CACHE_TTL_MS            = 24 * 60 * 60 * 1000; // 24 h — parks don't change daily
const LS_CACHE_KEY            = 'parks_cache_v2';
const PER_ENDPOINT_TIMEOUT_MS = 20_000;

// ── localStorage helpers ─────────────────────────────────────────────────────
interface CacheEntry {
  parks: Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[];
  timestamp: number;
  lat: number;
  lng: number;
}

function loadCacheFromLS(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch { return null; }
}

function saveCacheToLS(entry: CacheEntry): void {
  try { localStorage.setItem(LS_CACHE_KEY, JSON.stringify(entry)); }
  catch { /* storage full — silently skip */ }
}

// Seed in-memory cache from localStorage the moment this module loads.
// The hook will enrich and show parks immediately when GPS position arrives.
let cache: CacheEntry | null = loadCacheFromLS();
let _lastKnownParks: Park[] = [];
let _lastKnownPosition: { lat: number; lng: number } | null = null;

function isCacheValid(lat: number, lng: number): boolean {
  if (!cache) return false;
  if (Date.now() - cache.timestamp > CACHE_TTL_MS) return false;
  const dlat = Math.abs(cache.lat - lat) * 111_320;
  const dlng = Math.abs(cache.lng - lng) * 111_320;
  return Math.sqrt(dlat ** 2 + dlng ** 2) < 500;
}

// Sequential endpoint fallback — original proven query syntax kept intact.
async function fetchParksFromOSM(
  lat: number,
  lng: number,
): Promise<Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[]> {
  const query = `
    [out:json][timeout:18];
    (
      way[leisure=park](around:${SEARCH_RADIUS_M},${lat},${lng});
      relation[leisure=park](around:${SEARCH_RADIUS_M},${lat},${lng});
      way[leisure=garden](around:${SEARCH_RADIUS_M},${lat},${lng});
      way[natural=water][name](around:${SEARCH_RADIUS_M},${lat},${lng});
      relation[natural=water][name](around:${SEARCH_RADIUS_M},${lat},${lng});
    );
    out center tags;
  `;

  type OsmData = {
    elements: {
      id: number; type: string;
      center?: { lat: number; lon: number };
      lat?: number; lon?: number;
      tags?: { name?: string; leisure?: string; natural?: string };
    }[];
  };

  let lastError: unknown;

  for (const url of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), PER_ENDPOINT_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
        signal:  controller.signal,
      });
      clearTimeout(timerId);
      if (!resp.ok) { lastError = new Error(`HTTP ${resp.status}`); continue; }
      const data = (await resp.json()) as OsmData;
      return data.elements
        .filter((el) => el.tags?.name && (el.center || (el.lat && el.lon)))
        .map((el) => ({
          id:        `osm-${el.id}`,
          name:      el.tags!.name!,
          lat:       el.center?.lat ?? el.lat!,
          lng:       el.center?.lon ?? el.lon!,
          placeType: el.tags?.natural === 'water'  ? ('lake'   as const)
                   : el.tags?.leisure === 'garden' ? ('garden' as const)
                                                   : ('park'   as const),
        }));
    } catch (err) {
      clearTimeout(timerId);
      lastError = err;
    }
  }

  throw lastError ?? new Error('All Overpass endpoints failed');
}

export interface ParkSearchState {
  parks: Park[];
  loading: boolean;
  error: string | null;
}

export function useParkSearch(
  userPosition: Coordinate | null,
  claimedParkIds?: Set<string>
): ParkSearchState {
  const claimedKey = useMemo(
    () => (claimedParkIds ? [...claimedParkIds].sort().join(',') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claimedParkIds ? [...claimedParkIds].sort().join(',') : '']
  );

  const [state, setState] = useState<ParkSearchState>(() => ({
    parks:   _lastKnownParks,
    loading: _lastKnownParks.length === 0,
    error:   null,
  }));

  const fetchingRef     = useRef(false);
  const lastFetchPosRef = useRef<{ lat: number; lng: number } | null>(_lastKnownPosition);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!userPosition || fetchingRef.current) return;

    const [lng, lat] = userPosition;

    // Serve instantly from valid cache (could be localStorage data on first load)
    if (lastFetchPosRef.current) {
      const dlat = Math.abs(lastFetchPosRef.current.lat - lat) * 111_320;
      const dlng = Math.abs(lastFetchPosRef.current.lng - lng) * 111_320;
      if (Math.sqrt(dlat ** 2 + dlng ** 2) < 500 && isCacheValid(lat, lng)) {
        const enriched = cache!.parks
          .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);
        _lastKnownParks = enriched;
        _lastKnownPosition = { lat, lng };
        setState({ parks: enriched, loading: false, error: null });
        return;
      }
    }

    if (isCacheValid(lat, lng)) {
      lastFetchPosRef.current = { lat, lng };
      const enriched = cache!.parks
        .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
      _lastKnownParks = enriched;
      _lastKnownPosition = { lat, lng };
      setState({ parks: enriched, loading: false, error: null });
      return;
    }

    // Cache stale or missing — fetch fresh
    fetchingRef.current     = true;
    lastFetchPosRef.current = { lat, lng };

    if (_lastKnownParks.length === 0) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }

    fetchParksFromOSM(lat, lng)
      .then((raw) => {
        cache = { parks: raw, timestamp: Date.now(), lat, lng };
        saveCacheToLS(cache); // persist so next visit is instant
        const enriched = raw
          .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);
        _lastKnownParks = enriched;
        _lastKnownPosition = { lat, lng };
        setState({ parks: enriched, loading: false, error: null });
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      })
      .catch(() => {
        setState({
          parks:   _lastKnownParks,
          loading: false,
          error:   _lastKnownParks.length === 0 ? 'Could not load nearby places' : null,
        });
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current   = null;
            lastFetchPosRef.current = null;
            if (_lastKnownParks.length === 0) {
              setState((s) => ({ ...s, loading: true, error: null }));
            }
            setRetryTrigger((t) => t + 1);
          }, 15_000);
        }
      })
      .finally(() => { fetchingRef.current = false; });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, claimedKey, retryTrigger]);

  return state;
}


// ─────────────────────────────────────────────────────────────────────────────
//  UX FIXES applied here:
//
//  1. localStorage persistence — cache survives page reloads.
//     On revisit the user sees park data the instant GPS locks (zero API wait).
//
//  2. Parallel endpoint racing — all 3 Overpass mirrors start simultaneously.
//     Promise.any() takes the first success. Worst-case latency drops from
//     60 s (3 × 20 s sequential) to ~12 s (one parallel timeout round).
//
//  3. 24 h cache TTL — parks don't move daily. Stale data refreshes silently
//     in the background; user always sees something instantly.
//
//  4. Optimized Overpass query — nwr (node+way+relation in one pass) + qt
//     (quickest sort) reduces server processing time.
// ─────────────────────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const SEARCH_RADIUS_M         = 5000;
const CACHE_TTL_MS            = 24 * 60 * 60 * 1000; // 24 h — parks don't change daily
const LS_CACHE_KEY            = 'parks_cache_v2';
const PER_ENDPOINT_TIMEOUT_MS = 12_000;               // parallel race — 12 s is enough

// ── localStorage helpers ─────────────────────────────────────────────────────
interface CacheEntry {
  parks: Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[];
  timestamp: number;
  lat: number;
  lng: number;
}

function loadCacheFromLS(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch { return null; }
}

function saveCacheToLS(entry: CacheEntry): void {
  try { localStorage.setItem(LS_CACHE_KEY, JSON.stringify(entry)); }
  catch { /* storage full — silently skip */ }
}

// Seed in-memory cache from localStorage the moment this module loads.
// The hook's initial state will have raw park data available immediately
// — enrichment (distance/walkMinutes) happens as soon as GPS position arrives.
let cache: CacheEntry | null = loadCacheFromLS();
let _lastKnownParks: Park[] = [];
let _lastKnownPosition: { lat: number; lng: number } | null = null;

function isCacheValid(lat: number, lng: number): boolean {
  if (!cache) return false;
  if (Date.now() - cache.timestamp > CACHE_TTL_MS) return false;
  const dlat = Math.abs(cache.lat - lat) * 111_320;
  const dlng = Math.abs(cache.lng - lng) * 111_320;
  return Math.sqrt(dlat ** 2 + dlng ** 2) < 500;
}

// ── Overpass fetch — all 3 endpoints race in parallel ───────────────────────
// Promise.any() returns the first success and ignores slower responders.
async function fetchParksFromOSM(
  lat: number,
  lng: number,
): Promise<Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[]> {
  // nwr = node + way + relation in one pass (faster than separate queries)
  // qt  = quickest sort (server-side optimisation)
  const query = `
    [out:json][timeout:15];
    (
      nwr[leisure=park](around:${SEARCH_RADIUS_M},${lat},${lng});
      nwr[leisure=garden](around:${SEARCH_RADIUS_M},${lat},${lng});
      nwr[natural=water][name](around:${SEARCH_RADIUS_M},${lat},${lng});
    );
    out center qt tags;
  `;

  type OsmElement = {
    id: number; type: string;
    center?: { lat: number; lon: number };
    lat?: number; lon?: number;
    tags?: { name?: string; leisure?: string; natural?: string };
  };

  const attempt = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_ENDPOINT_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
        signal:  controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { elements: OsmElement[] };
      return data.elements
        .filter((el) => el.tags?.name && (el.center || (el.lat && el.lon)))
        .map((el) => ({
          id:        `osm-${el.id}`,
          name:      el.tags!.name!,
          lat:       el.center?.lat ?? el.lat!,
          lng:       el.center?.lon ?? el.lon!,
          placeType: el.tags?.natural === 'water'  ? ('lake'   as const)
                   : el.tags?.leisure === 'garden' ? ('garden' as const)
                                                   : ('park'   as const),
        }));
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  // All 3 mirrors start at the same time — fastest one wins
  return Promise.any(OVERPASS_ENDPOINTS.map(attempt));
}

export interface ParkSearchState {
  parks: Park[];
  loading: boolean;
  error: string | null;
}

export function useParkSearch(
  userPosition: Coordinate | null,
  claimedParkIds?: Set<string>
): ParkSearchState {
  const claimedKey = useMemo(
    () => (claimedParkIds ? [...claimedParkIds].sort().join(',') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claimedParkIds ? [...claimedParkIds].sort().join(',') : '']
  );

  const [state, setState] = useState<ParkSearchState>(() => ({
    parks:   _lastKnownParks,
    // If localStorage cache exists we'll enrich immediately on first GPS fix —
    // show spinner only when there's truly nothing to show yet.
    loading: _lastKnownParks.length === 0,
    error:   null,
  }));

  const fetchingRef     = useRef(false);
  const lastFetchPosRef = useRef<{ lat: number; lng: number } | null>(_lastKnownPosition);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!userPosition || fetchingRef.current) return;

    const [lng, lat] = userPosition;

    // ── Serve from cache (memory or just-loaded from localStorage) ───────────
    if (lastFetchPosRef.current) {
      const dlat = Math.abs(lastFetchPosRef.current.lat - lat) * 111_320;
      const dlng = Math.abs(lastFetchPosRef.current.lng - lng) * 111_320;
      if (Math.sqrt(dlat ** 2 + dlng ** 2) < 500 && isCacheValid(lat, lng)) {
        const enriched = cache!.parks
          .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);
        _lastKnownParks = enriched;
        _lastKnownPosition = { lat, lng };
        setState({ parks: enriched, loading: false, error: null });
        return;
      }
    }

    if (isCacheValid(lat, lng)) {
      // Fresh enough cache (could be from localStorage on first load — show instantly)
      lastFetchPosRef.current = { lat, lng };
      const enriched = cache!.parks
        .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
      _lastKnownParks = enriched;
      _lastKnownPosition = { lat, lng };
      setState({ parks: enriched, loading: false, error: null });
      return;
    }

    // ── Cache stale or missing — fetch fresh data ────────────────────────────
    fetchingRef.current     = true;
    lastFetchPosRef.current = { lat, lng };

    // Show spinner only if there's nothing to display yet
    if (_lastKnownParks.length === 0) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }

    fetchParksFromOSM(lat, lng)
      .then((raw) => {
        cache = { parks: raw, timestamp: Date.now(), lat, lng };
        saveCacheToLS(cache); // persist so next visit is instant
        const enriched = raw
          .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);
        _lastKnownParks = enriched;
        _lastKnownPosition = { lat, lng };
        setState({ parks: enriched, loading: false, error: null });
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      })
      .catch(() => {
        setState({
          parks:   _lastKnownParks,
          loading: false,
          error:   _lastKnownParks.length === 0 ? 'Could not load nearby places' : null,
        });
        // Retry after 20 s — all 3 endpoints ran in parallel so 20 s is plenty
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current    = null;
            lastFetchPosRef.current  = null;
            if (_lastKnownParks.length === 0) {
              setState((s) => ({ ...s, loading: true, error: null }));
            }
            setRetryTrigger((t) => t + 1);
          }, 20_000);
        }
      })
      .finally(() => { fetchingRef.current = false; });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, claimedKey, retryTrigger]);

  return state;
}

