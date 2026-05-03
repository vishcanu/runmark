import type { ActivityType } from '../../../types';

// ── Points system ─────────────────────────────────────────────
//
// Philosophy: Running is hardest, so it earns the most per metre.
// Walking is moderate. Cycling covers distance with far less effort,
// so the per-metre rate is lowest. New territory claims give a flat
// bonus — revisiting gives a smaller maintenance bonus.
//
// Formula per run:
//   points = round(distance_m × MULTIPLIER[type]) + BONUS
//
// Multipliers (pts per metre):
//   run   → 1.5   (e.g. 400 m run  = 600 pts)
//   walk  → 1.0   (e.g. 400 m walk = 400 pts)
//   cycle → 0.4   (e.g. 400 m ride = 160 pts)
//
// Bonuses:
//   First claim (new territory)  → +300 pts
//   Revisit (maintenance run)    → +75 pts

export interface ActivityConfig {
  label: string;
  emoji: string;
  multiplier: number;         // pts per metre
  color: string;
  description: string;
}

export const ACTIVITY_CONFIGS: Record<ActivityType, ActivityConfig> = {
  run: {
    label:       'Run',
    emoji:       '🏃',
    multiplier:  1.5,
    color:       '#ef4444',
    description: '1.5 pts/m — highest reward',
  },
  walk: {
    label:       'Walk',
    emoji:       '🚶',
    multiplier:  1.0,
    color:       '#22c55e',
    description: '1.0 pts/m — balanced reward',
  },
  cycle: {
    label:       'Cycle',
    emoji:       '🚴',
    multiplier:  0.4,
    color:       '#f59e0b',
    description: '0.4 pts/m — distance reward',
  },
};

const NEW_TERRITORY_BONUS = 300;
const REVISIT_BONUS       = 75;

/**
 * Calculate points earned for a single run/walk/ride.
 * @param distanceM   distance covered in metres
 * @param type        activity type
 * @param isNewTerritory  true when this is the first claim (not a revisit)
 */
export function calcPoints(
  distanceM: number,
  type: ActivityType,
  isNewTerritory: boolean,
): number {
  const cfg   = ACTIVITY_CONFIGS[type];
  const base  = Math.round(distanceM * cfg.multiplier);
  const bonus = isNewTerritory ? NEW_TERRITORY_BONUS : REVISIT_BONUS;
  return base + bonus;
}
