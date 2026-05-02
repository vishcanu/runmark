import { useState, useEffect, useRef, useMemo } from 'react';
import type { Park } from '../types';
import { enrichPark } from '../utils/parkUtils';
import type { Coordinate } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT CAUSES FIXED:
//
//  1. Shared AbortController across all endpoints — if timeout fired during
//     endpoint-1 fetch, signal.aborted caused immediate break, endpoint-2 was
//     never tried. Fix: each endpoint gets its own 12s AbortController.
//
//  2. Retry only when zero parks — if you had stale parks from last session,
//     failures were completely silent forever. Fix: always retry after 12s
//     regardless of whether we have cached parks.
//
//  3. claimedParkIds was a new Set() on every render in the parent, making
//     it an unstable dep that re-ran the effect on every render. Fix: memo-
//     ize the Set in this hook using JSON.stringify of the IDs array.
// ─────────────────────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter', // 3rd fallback
];

const SEARCH_RADIUS_M = 5000;
const CACHE_TTL_MS    = 5 * 60 * 1000; // 5 min
const PER_ENDPOINT_TIMEOUT_MS = 20_000; // each endpoint gets 20s individually

interface CacheEntry {
  parks: Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[];
  timestamp: number;
  lat: number;
  lng: number;
}

let cache: CacheEntry | null = null;
let _lastKnownParks: Park[] = [];
let _lastKnownPosition: { lat: number; lng: number } | null = null;

function isCacheValid(lat: number, lng: number): boolean {
  if (!cache) return false;
  if (Date.now() - cache.timestamp > CACHE_TTL_MS) return false;
  const dlat = Math.abs(cache.lat - lat) * 111320;
  const dlng = Math.abs(cache.lng - lng) * 111320;
  return Math.sqrt(dlat ** 2 + dlng ** 2) < 500;
}

// Try each endpoint sequentially with its own timeout controller.
// Returns raw park data or throws if all endpoints fail.
async function fetchParksFromOSM(
  lat: number,
  lng: number
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
    // Each endpoint gets its OWN controller — timeout on one doesn't kill the others
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), PER_ENDPOINT_TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timerId);
      if (!resp.ok) { lastError = new Error(`HTTP ${resp.status}`); continue; }

      const data = (await resp.json()) as OsmData;

      return data.elements
        .filter((el) => {
          const name = el.tags?.name;
          return name && (el.center || (el.lat && el.lon));
        })
        .map((el) => ({
          id: `osm-${el.id}`,
          name: el.tags!.name!,
          lat: el.center?.lat ?? el.lat!,
          lng: el.center?.lon ?? el.lon!,
          placeType:
            el.tags?.natural === 'water' ? ('lake' as const)
            : el.tags?.leisure === 'garden' ? ('garden' as const)
            : ('park' as const),
        }));
    } catch (err) {
      clearTimeout(timerId);
      lastError = err;
      // Aborted = this endpoint timed out — move on to next immediately
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
  // Stable serialization of the claimed IDs set — prevents re-running the
  // effect just because the parent passed a new Set() reference every render
  const claimedKey = useMemo(
    () => (claimedParkIds ? [...claimedParkIds].sort().join(',') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claimedParkIds ? [...claimedParkIds].sort().join(',') : '']
  );

  const [state, setState] = useState<ParkSearchState>(() => ({
    parks: _lastKnownParks,
    loading: _lastKnownParks.length === 0,
    error: null,
  }));

  const fetchingRef      = useRef(false);
  const lastFetchPosRef  = useRef<{ lat: number; lng: number } | null>(_lastKnownPosition);
  const retryTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!userPosition || fetchingRef.current) return;

    const [lng, lat] = userPosition;

    // Serve instantly from valid cache if user hasn't moved > 500m
    if (lastFetchPosRef.current) {
      const dlat = Math.abs(lastFetchPosRef.current.lat - lat) * 111320;
      const dlng = Math.abs(lastFetchPosRef.current.lng - lng) * 111320;
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

    // Need a fresh fetch
    fetchingRef.current   = true;
    lastFetchPosRef.current = { lat, lng };

    // Show spinner only if nothing to show yet
    if (_lastKnownParks.length === 0) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }

    fetchParksFromOSM(lat, lng)
      .then((raw) => {
        cache = { parks: raw, timestamp: Date.now(), lat, lng };
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
        // Keep existing parks visible — do NOT clear to empty
        setState((_s) => ({
          parks: _lastKnownParks,
          loading: false,
          // Show subtle error only if we have nothing to show
          error: _lastKnownParks.length === 0 ? 'Could not load nearby places' : null,
        }));
        // Always retry after 15s — even if we have stale parks, we want fresh ones
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            lastFetchPosRef.current = null; // allow re-fetch from same position
            // Show loading state for retry so tray stays visible
            if (_lastKnownParks.length === 0) {
              setState((s) => ({ ...s, loading: true, error: null }));
            }
            setRetryTrigger((t) => t + 1);
          }, 15_000);
        }
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  // claimedKey is the stable string version of claimedParkIds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, claimedKey, retryTrigger]);

  return state;
}
