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
const TEST_TERRITORY: Territory = {
  id: 'test-nataraj-park',
  name: 'Sri SK Nataraj Park',
  color: '#0284c7',
  createdAt: Date.now(),
  distance: 430,   // ~one loop of the park perimeter
  duration: 380,
  runs: 3,         // 3 loops completed → building picker unlocked
  lastRunAt: Date.now(),
  theme: 'cobalt',
  emblem: 'shield',
  tagline: 'My morning fortress',
  activityType: 'run',
  points: 1245,
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

