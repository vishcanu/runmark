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

export function useTerritoryStoreState(): TerritoryStoreContextType {
  const [territories, setTerritories] = useState<Territory[]>([]);
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

