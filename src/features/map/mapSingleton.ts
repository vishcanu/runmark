/**
 * Module-level singleton for the MapLibre map instance.
 * Set by useMap after the map loads; cleared on unmount.
 * Consumed by share-card capture in TerritoryDetails (no context needed).
 */
import type { Map } from 'maplibre-gl';

let _instance: Map | null = null;

export function setMapInstance(m: Map | null): void {
  _instance = m;
}

export function getMapInstance(): Map | null {
  return _instance;
}
