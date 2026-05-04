import { createContext, useContext, useState, useCallback } from 'react';
import type { Territory } from '../../../types';

export interface TerritoryStoreState {
  territories: Territory[];
  selectedId: string | null;
}

export interface TerritoryStoreActions {
  addTerritory: (t: Territory) => void;
  removeTerritory: (id: string) => void;
  updateTerritory: (id: string, patch: Partial<Territory>) => void;
  selectTerritory: (id: string | null) => void;
  getTerritory: (id: string) => Territory | undefined;
}

export type TerritoryStoreContextType = TerritoryStoreState & TerritoryStoreActions;

export const TerritoryStoreContext = createContext<TerritoryStoreContextType | null>(null);

// ── TEST TERRITORY — Sri SK Nataraj Park, JP Nagar 1st Phase ─
// Real OSM way #32258996. Remove before production.
const _NOW = Date.now();
const _DAY = 86_400_000;
const _df  = (t: number) => Math.floor(t / _DAY) * _DAY;  // day-floor

const TEST_TERRITORY: Territory = {
  id: 'test-nataraj-park',
  name: 'Sri SK Nataraj Park',
  color: '#0284c7',
  createdAt: _df(_NOW - 2 * _DAY),
  distance: 1290,   // ~3 loops of the park perimeter
  duration: 1140,
  runs: 3,          // 3 loops completed → city building unlocked
  lastRunAt: _NOW,
  theme: 'cobalt',
  emblem: 'shield',
  tagline: 'My morning fortress',
  activityType: 'run',
  points: 1245,
  // 3 consecutive days → cityUnlocked = true (streak ≥ 3, runs ≥ 3)
  visitDays: [_df(_NOW - 2 * _DAY), _df(_NOW - _DAY), _df(_NOW)],
  coordinates: [
    [77.5808963, 12.9080499],
    [77.5811258, 12.9074393],
    [77.5819348, 12.9074199],
    [77.5819142, 12.9084285],
    [77.5814871, 12.9084415],
    [77.5809874, 12.9084571],
    [77.5808963, 12.9080499], // closed ring
  ],
  buildings: [],
};
// ─────────────────────────────────────────────────────────────

export function useTerritoryStoreState(): TerritoryStoreContextType {
  const [territories, setTerritories] = useState<Territory[]>([TEST_TERRITORY]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addTerritory = useCallback((t: Territory) => {
    setTerritories((prev) => [t, ...prev]);
  }, []);

  const removeTerritory = useCallback((id: string) => {
    setTerritories((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const updateTerritory = useCallback((id: string, patch: Partial<Territory>) => {
    setTerritories((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const selectTerritory = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const getTerritory = useCallback(
    (id: string) => territories.find((t) => t.id === id),
    [territories]
  );

  return { territories, selectedId, addTerritory, removeTerritory, updateTerritory, selectTerritory, getTerritory };
}

export function useTerritoryStore(): TerritoryStoreContextType {
  const ctx = useContext(TerritoryStoreContext);
  if (!ctx) throw new Error('useTerritoryStore must be used inside TerritoryStoreProvider');
  return ctx;
}

