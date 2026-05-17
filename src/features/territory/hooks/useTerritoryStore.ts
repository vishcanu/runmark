import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Territory } from '../../../types';
import { fetchTerritories, upsertTerritory, deleteTerritory } from '../../../lib/db';

export interface TerritoryStoreState {
  territories: Territory[];
  selectedId: string | null;
  syncing: boolean;
}

export interface TerritoryStoreActions {
  addTerritory:    (t: Territory) => void;
  removeTerritory: (id: string) => void;
  updateTerritory: (id: string, patch: Partial<Territory>) => void;
  selectTerritory: (id: string | null) => void;
  getTerritory:    (id: string) => Territory | undefined;
}

export type TerritoryStoreContextType = TerritoryStoreState & TerritoryStoreActions;

export const TerritoryStoreContext = createContext<TerritoryStoreContextType | null>(null);

// ── localStorage helpers ──────────────────────────────────────
const LS_KEY = 'rg_territories_v2';

function loadFromStorage(): Territory[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Territory[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(territories: Territory[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(territories));
  } catch { /* storage full — ignore */ }
}

function getUserId(): string {
  return localStorage.getItem('rg_user_id') ?? 'local';
}

// ── Store ─────────────────────────────────────────────────────
export function useTerritoryStoreState(): TerritoryStoreContextType {
  const [territories, setTerritories] = useState<Territory[]>(() => loadFromStorage());
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [syncing,     setSyncing]      = useState(false);

  // ── Persist to localStorage on every change ────────────────
  useEffect(() => {
    saveToStorage(territories);
  }, [territories]);

  // ── Load from Supabase on mount (background sync) ──────────
  useEffect(() => {
    const userId = getUserId();
    if (userId === 'local') return; // not logged in yet
    setSyncing(true);
    fetchTerritories(userId)
      .then((remote) => {
        if (remote.length > 0) {
          // Merge: remote wins for existing IDs, keep local-only new territories
          setTerritories((local) => {
            const remoteIds = new Set(remote.map((t) => t.id));
            const localOnly = local.filter((t) => !remoteIds.has(t.id));
            return [...remote, ...localOnly];
          });
        }
      })
      .catch(() => { /* offline — silently keep localStorage data */ })
      .finally(() => setSyncing(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────
  const addTerritory = useCallback((t: Territory) => {
    setTerritories((prev) => [t, ...prev]);
    upsertTerritory(getUserId(), t).catch(() => {});
  }, []);

  const removeTerritory = useCallback((id: string) => {
    setTerritories((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    deleteTerritory(id).catch(() => {});
  }, []);

  const updateTerritory = useCallback((id: string, patch: Partial<Territory>) => {
    setTerritories((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...patch };
        upsertTerritory(getUserId(), updated).catch(() => {});
        return updated;
      }),
    );
  }, []);

  const selectTerritory = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const getTerritory = useCallback(
    (id: string) => territories.find((t) => t.id === id),
    [territories],
  );

  return { territories, selectedId, syncing, addTerritory, removeTerritory, updateTerritory, selectTerritory, getTerritory };
}

export function useTerritoryStore(): TerritoryStoreContextType {
  const ctx = useContext(TerritoryStoreContext);
  if (!ctx) throw new Error('useTerritoryStore must be used inside TerritoryStoreProvider');
  return ctx;
}

