import { createContext, useContext, useState, useCallback } from 'react';
import type { Territory } from '../../../types';

export interface TerritoryStoreState {
  territories: Territory[];
  selectedId: string | null;
}

export interface TerritoryStoreActions {
  addTerritory: (t: Territory) => void;
  removeTerritory: (id: string) => void;
  selectTerritory: (id: string | null) => void;
  getTerritory: (id: string) => Territory | undefined;
}

export type TerritoryStoreContextType = TerritoryStoreState & TerritoryStoreActions;

export const TerritoryStoreContext = createContext<TerritoryStoreContextType | null>(null);

// ── TEST TERRITORY — Sri SK Nataraj Park, Bengaluru ──────────
// Approximate polygon (~300 × 200 m) near Jayanagar / South Bengaluru.
// REMOVE this before production.
const TEST_TERRITORY: Territory = {
  id: 'test-nataraj-park',
  name: 'Sri SK Nataraj Park',
  color: '#0284c7',
  createdAt: Date.now(),
  distance: 980,
  duration: 720,
  coordinates: [
    [77.5930, 12.9240],
    [77.5958, 12.9240],
    [77.5958, 12.9258],
    [77.5930, 12.9258],
    [77.5930, 12.9240], // closed ring
  ],
  buildings: [
    { id: 'tb1', position: [77.5938, 12.9246], height: 12, type: 'cottage' },
    { id: 'tb2', position: [77.5948, 12.9250], height: 18, type: 'tower'   },
  ],
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

  const selectTerritory = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const getTerritory = useCallback(
    (id: string) => territories.find((t) => t.id === id),
    [territories]
  );

  return { territories, selectedId, addTerritory, removeTerritory, selectTerritory, getTerritory };
}

export function useTerritoryStore(): TerritoryStoreContextType {
  const ctx = useContext(TerritoryStoreContext);
  if (!ctx) throw new Error('useTerritoryStore must be used inside TerritoryStoreProvider');
  return ctx;
}

