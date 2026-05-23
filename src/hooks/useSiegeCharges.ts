/**
 * useSiegeCharges — loads, earns, and spends the 5 siege power charges.
 *
 * Charges are persisted in the Supabase `profiles` table.
 * All earning is activity-agnostic: every player can accumulate all 5 powers.
 * Activity type only gives a speed bonus, never exclusive access.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchCharges, saveCharges } from '../lib/db';
import { useUserProfile } from './useUserProfile';
import type { SiegeCharges, ActivityType } from '../types';
import { SIEGE_MAX, SIEGE_ZERO } from '../types';

// ── Earning formula ───────────────────────────────────────────
/**
 * Compute charges earned at end of one activity session.
 *
 * @param distanceM       metres covered in this session
 * @param activityType    run / walk / cycle
 * @param isNewTerritory  true if a brand-new territory was claimed
 * @param newTotal        total territories owned after this session
 * @param wasActiveYday   was the user active yesterday? (streak)
 */
export function computeEarnedCharges(
  distanceM:       number,
  activityType:    ActivityType,
  isNewTerritory:  boolean,
  newTotal:        number,
  wasActiveYday:   boolean,
): Partial<SiegeCharges> {
  const halfKm = Math.floor(distanceM / 500);   // 1 unit per 500 m

  return {
    // 🔥 Inferno — km covered. Runners earn 1.5×
    inferno: activityType === 'run'
      ? Math.floor(halfKm * 1.5)
      : halfKm,

    // 🌪️ Cyclone — flat +1 per session. Cyclists earn +2
    cyclone: activityType === 'cycle' ? 2 : 1,

    // 💥 Tremor — revisiting territories. 0 for brand-new claim. Walkers earn 2×
    tremor: isNewTerritory
      ? 0
      : (activityType === 'walk' ? 2 : 1),

    // 🌊 Deluge — consecutive active days (streak)
    deluge: wasActiveYday ? 1 : 0,

    // 🔮 Vortex — reaching a multiple of 5 territories owned
    vortex: newTotal > 0 && newTotal % 5 === 0 ? 1 : 0,
  };
}

// ── Hook ─────────────────────────────────────────────────────
export function useSiegeCharges() {
  const user = useUserProfile();
  const [charges, setCharges] = useState<SiegeCharges>({ ...SIEGE_ZERO });
  const [loaded,  setLoaded]  = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    fetchCharges(user.id).then(c => {
      setCharges(c);
      setLoaded(true);
    });
  }, [user.id]);

  // Debounced Supabase save (300 ms) — avoid hammering on quick multi-adds
  const persist = useCallback((next: SiegeCharges) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCharges(user.id, next), 300);
  }, [user.id]);

  /** Add earned charges (clamped to max) */
  const addCharges = useCallback((earned: Partial<SiegeCharges>) => {
    setCharges(prev => {
      const next: SiegeCharges = {
        inferno: Math.min(SIEGE_MAX.inferno, prev.inferno + (earned.inferno ?? 0)),
        cyclone: Math.min(SIEGE_MAX.cyclone, prev.cyclone + (earned.cyclone ?? 0)),
        tremor:  Math.min(SIEGE_MAX.tremor,  prev.tremor  + (earned.tremor  ?? 0)),
        deluge:  Math.min(SIEGE_MAX.deluge,  prev.deluge  + (earned.deluge  ?? 0)),
        vortex:  Math.min(SIEGE_MAX.vortex,  prev.vortex  + (earned.vortex  ?? 0)),
      };
      persist(next);
      return next;
    });
  }, [persist]);

  /** Spend charges (clamped to 0) */
  const spendCharges = useCallback((cost: Partial<SiegeCharges>) => {
    setCharges(prev => {
      const next: SiegeCharges = {
        inferno: Math.max(0, prev.inferno - (cost.inferno ?? 0)),
        cyclone: Math.max(0, prev.cyclone - (cost.cyclone ?? 0)),
        tremor:  Math.max(0, prev.tremor  - (cost.tremor  ?? 0)),
        deluge:  Math.max(0, prev.deluge  - (cost.deluge  ?? 0)),
        vortex:  Math.max(0, prev.vortex  - (cost.vortex  ?? 0)),
      };
      persist(next);
      return next;
    });
  }, [persist]);

  return { charges, addCharges, spendCharges, loaded };
}
