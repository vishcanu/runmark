import type { Park } from '../types';

const WALK_SPEED_MPS = 5000 / 3600; // 5 km/h in m/s

/** Haversine distance (meters) between two lat/lng pairs */
export function distanceBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Format metres to human-readable string */
export function formatParkDistance(m: number): string {
  if (m < 100) return `${Math.round(m)}m`;
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/** Estimate walk time in minutes */
export function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / WALK_SPEED_MPS / 60));
}

/** Open native maps navigation to a lat/lng */
export function navigateToPark(lat: number, lng: number): void {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Attach distance + walkMinutes to raw park data */
export function enrichPark(
  raw: Omit<Park, 'distance' | 'walkMinutes' | 'isClaimed'>,
  userLat: number,
  userLng: number,
  claimedIds: Set<string>
): Park {
  const dist = distanceBetween(userLat, userLng, raw.lat, raw.lng);
  return {
    ...raw,
    distance: dist,
    walkMinutes: walkMinutes(dist),
    isClaimed: claimedIds.has(raw.id),
  };
}
