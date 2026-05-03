import type { ConstructionBuildingType } from '../../types';

// ── Construction level progression ───────────────────────────
// Each level is unlocked by reaching the required run count.
export interface ConstructionLevel {
  minRuns: number;
  name: string;
  /** Fill-extrusion height in metres */
  height: number;
  description: string;
  emoji: string;
}

export const CONSTRUCTION_LEVELS: ConstructionLevel[] = [
  { minRuns: 1,  name: 'Cleared',      height: 0,   description: 'Land claimed — ready to build', emoji: '🌿' },
  { minRuns: 2,  name: 'Foundation',   height: 4,   description: 'Foundation slab laid',          emoji: '🪨' },
  { minRuns: 3,  name: 'Ground Floor', height: 12,  description: 'First floor standing',          emoji: '🏗' },
  { minRuns: 5,  name: 'Low-Rise',     height: 30,  description: 'Building rising fast',          emoji: '🏢' },
  { minRuns: 8,  name: 'Mid-Rise',     height: 60,  description: 'Tower taking shape',            emoji: '🏙' },
  { minRuns: 12, name: 'Skyscraper',   height: 110, description: 'Dominating the skyline',        emoji: '🌆' },
  { minRuns: 20, name: 'Megaplex',     height: 210, description: 'Legendary structure',           emoji: '🌃' },
];

// ── Building type definitions ─────────────────────────────────
export interface BuildingDef {
  name: string;
  tagline: string;
  effect: string;
  color: string;
  /** Accent color for the roof layer */
  roofColor: string;
  icon: string;
  requiredRuns: number;
}

export const BUILDING_DEFS: Record<ConstructionBuildingType, BuildingDef> = {
  watchtower: {
    name: 'Watchtower',
    tagline: 'Sentinel of the district',
    effect: 'Slows territory decay',
    color: '#f59e0b',
    roofColor: '#fde68a',
    icon: '🗼',
    requiredRuns: 3,
  },
  barracks: {
    name: 'Barracks',
    tagline: 'Train harder, run faster',
    effect: 'Boosts XP on re-runs',
    color: '#22c55e',
    roofColor: '#86efac',
    icon: '⚔️',
    requiredRuns: 3,
  },
  fortification: {
    name: 'Fortification',
    tagline: 'Walls that never fall',
    effect: 'Expands territory boundary',
    color: '#94a3b8',
    roofColor: '#cbd5e1',
    icon: '🏰',
    requiredRuns: 3,
  },
  market: {
    name: 'Market',
    tagline: 'Heart of the district',
    effect: 'Prestige landmark',
    color: '#f97316',
    roofColor: '#fed7aa',
    icon: '🏪',
    requiredRuns: 3,
  },
  monument: {
    name: 'Monument',
    tagline: 'Legacy etched in stone',
    effect: 'Permanent legacy — immune to decay',
    color: '#a855f7',
    roofColor: '#e9d5ff',
    icon: '🗿',
    requiredRuns: 10,
  },
};

// ── Helpers ───────────────────────────────────────────────────

/** Returns the highest construction level reached for `runs`. */
export function getConstructionLevel(runs: number): ConstructionLevel {
  let level = CONSTRUCTION_LEVELS[0];
  for (const l of CONSTRUCTION_LEVELS) {
    if (runs >= l.minRuns) level = l;
    else break;
  }
  return level;
}

/** Returns the next level to unlock, or null if max level. */
export function nextConstructionLevel(runs: number): ConstructionLevel | null {
  for (const l of CONSTRUCTION_LEVELS) {
    if (runs < l.minRuns) return l;
  }
  return null;
}

/** Returns available building types for the given run count. */
export function availableBuildings(runs: number): ConstructionBuildingType[] {
  return (Object.entries(BUILDING_DEFS) as [ConstructionBuildingType, BuildingDef][])
    .filter(([, def]) => runs >= def.requiredRuns)
    .map(([type]) => type);
}
