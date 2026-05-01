import { useState, useEffect, useRef } from 'react';
import type { Park } from '../types';
import { enrichPark } from '../utils/parkUtils';
import type { Coordinate } from '../../../types';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const SEARCH_RADIUS_M = 5000; // 5km radius
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  parks: Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[];
  timestamp: number;
  lat: number;
  lng: number;
}


let cache: CacheEntry | null = null;

function isCacheValid(lat: number, lng: number): boolean {
  if (!cache) return false;
  if (Date.now() - cache.timestamp > CACHE_TTL_MS) return false;
  // Re-use if user hasn't moved more than 500m
  const dlat = Math.abs(cache.lat - lat) * 111320;
  const dlng = Math.abs(cache.lng - lng) * 111320;
  return Math.sqrt(dlat ** 2 + dlng ** 2) < 500;
}

async function fetchParksFromOSM(
  lat: number,
  lng: number
): Promise<Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>[]> {
  const query = `
    [out:json][timeout:15];
    (
      way[leisure=park](around:${SEARCH_RADIUS_M},${lat},${lng});
      relation[leisure=park](around:${SEARCH_RADIUS_M},${lat},${lng});
      way[leisure=garden](around:${SEARCH_RADIUS_M},${lat},${lng});
      way[natural=water][name](around:${SEARCH_RADIUS_M},${lat},${lng});
      relation[natural=water][name](around:${SEARCH_RADIUS_M},${lat},${lng});
    );
    out center tags;
  `;

  // Use manual AbortController — AbortSignal.timeout() not supported on iOS < 17
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), 18000);

  type OsmData = {
    elements: {
      id: number;
      type: string;
      center?: { lat: number; lon: number };
      lat?: number;
      lon?: number;
      tags?: { name?: string; leisure?: string; natural?: string };
    }[];
  };

  let data: OsmData | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!resp.ok) continue; // try next endpoint
      data = (await resp.json()) as OsmData;
      break;
    } catch {
      if (controller.signal.aborted) break; // timeout — stop retrying
    }
  }

  clearTimeout(timerId);
  if (!data) throw new Error('Overpass API error');

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
        el.tags?.natural === 'water'
          ? ('lake' as const)
          : el.tags?.leisure === 'garden'
          ? ('garden' as const)
          : ('park' as const),
    }));
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
  const [state, setState] = useState<ParkSearchState>({
    parks: [],
    loading: false,
    error: null,
  });
  const fetchingRef = useRef(false);
  const lastFetchPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!userPosition || fetchingRef.current) return;

    const [lng, lat] = userPosition;

    // Skip if already fetched near this position
    if (lastFetchPosRef.current) {
      const dlat = Math.abs(lastFetchPosRef.current.lat - lat) * 111320;
      const dlng = Math.abs(lastFetchPosRef.current.lng - lng) * 111320;
      if (Math.sqrt(dlat ** 2 + dlng ** 2) < 500) {
        // Just re-enrich with updated claimed set if needed
        if (isCacheValid(lat, lng)) {
          const enriched = cache!.parks
            .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);
          setState({ parks: enriched, loading: false, error: null });
        }
        return;
      }
    }

    if (isCacheValid(lat, lng)) {
      lastFetchPosRef.current = { lat, lng };
      const enriched = cache!.parks
        .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
      setState({ parks: enriched, loading: false, error: null });
      return;
    }

    fetchingRef.current = true;
    lastFetchPosRef.current = { lat, lng };
    setState((s) => ({ ...s, loading: true, error: null }));

    fetchParksFromOSM(lat, lng)
      .then((raw) => {
        cache = { parks: raw, timestamp: Date.now(), lat, lng };
        const enriched = raw
          .map((p) => enrichPark(p, lat, lng, claimedParkIds ?? new Set()))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);
        setState({ parks: enriched, loading: false, error: null });
      })
      .catch(() => {
        // Silently fail — parks are a nice-to-have, not critical
        setState({ parks: [], loading: false, error: null });
        lastFetchPosRef.current = null; // allow retry on next position fix
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [userPosition, claimedParkIds]);

  return state;
}
