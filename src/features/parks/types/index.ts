export type PlaceType = 'park' | 'lake' | 'garden';

export interface Park {
  id: string;
  name: string;
  lat: number;
  lng: number;
  placeType: PlaceType;
  /** Distance from user in meters */
  distance: number;
  /** Estimated walk time in minutes (5 km/h) */
  walkMinutes: number;
  /** Whether the user already has a territory inside this park */
  isClaimed: boolean;
}

/** Park area computed from OSM boundary geometry */
export interface ParkArea {
  /** Area in square meters */
  m2: number;
  /** Human-readable label e.g. "3.2 ha" or "0.4 km²" */
  label: string;
}

/** Format square meters into a readable area string */
export function formatParkArea(m2: number): string {
  if (m2 < 10000) return `${Math.round(m2).toLocaleString()} m²`;
  const ha = m2 / 10000;
  if (ha < 100) return `${ha.toFixed(1)} ha`;
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

/** Compute polygon area (m²) from [lng, lat][] ring using Shoelace + spherical correction */
export function polygonAreaM2(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const lat1 = toRad(coords[j][1]);
    const lat2 = toRad(coords[i][1]);
    const lng1 = toRad(coords[j][0]);
    const lng2 = toRad(coords[i][0]);
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(area * R * R) / 2;
}
