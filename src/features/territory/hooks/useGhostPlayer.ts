/**
 * Module-level store for the "ghost" player whose territories are overlaid
 * on the map after tapping their leaderboard row in the Arena.
 *
 * Uses a simple pub/sub so any component can subscribe without context.
 */
import { useEffect, useReducer } from 'react';
import type { Territory } from '../../../types';

export interface GhostPlayer {
  id:          string;
  name:        string;
  color:       string;
  territories: Territory[];
}

let _state: GhostPlayer | null = null;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach(l => l()); }

export function setGhostPlayer(p: GhostPlayer): void {
  _state = p;
  notify();
}

export function clearGhostPlayer(): void {
  _state = null;
  notify();
}

export function useGhostPlayer(): GhostPlayer | null {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    _listeners.add(rerender);
    return () => { _listeners.delete(rerender); };
  }, []);
  return _state;
}
