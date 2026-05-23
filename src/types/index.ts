// ─── Core Geo Types ──────────────────────────────────────────────────────────
/** [longitude, latitude] */
export type Coordinate = [number, number];

// ─── Health Profile ───────────────────────────────────────────────────────────
export interface HealthProfile {
  age?:      number;    // years — used for max HR / pace zones
  weightKg?: number;    // kg    — used for MET calorie formula
  heightCm?: number;    // cm    — used for stride-based step count
  gender?:   'male' | 'female' | 'other';
}

// ─── Building Types ───────────────────────────────────────────────────────────
export type BuildingType = 'cottage' | 'tower' | 'skyscraper' | 'landmark';

/** Type of construction the user has chosen to build on their territory */
export type ConstructionBuildingType = 'watchtower' | 'barracks' | 'fortification' | 'market' | 'monument';

export interface Building {
  id: string;
  position: Coordinate;
  height: number;
  type: BuildingType;
}

// ─── Territory Types ──────────────────────────────────────────────────────────
/** One completed run — stored per-run so Activity page can show per-day accurate stats. */
export interface RunEntry {
  ts:   number;       // timestamp when the run finished
  dist: number;       // metres walked/run/cycled in this single run
  dur:  number;       // seconds
  type: ActivityType; // activity type for this specific run
}

export interface Territory {
  id: string;
  name: string;
  /** Closed ring of coordinates [lng, lat][] */
  coordinates: Coordinate[];
  createdAt: number;
  /** Distance walked in meters (total across all runs) */
  distance: number;
  /** Duration in seconds */
  duration: number;
  buildings: Building[];
  color: string;
  /** Number of full loops completed around this territory */
  runs: number;
  /** Timestamp of most recent run — used for territory decay */
  lastRunAt: number;
  /** Theme ID — drives gradient swatch selection in the edit panel */
  theme?: string;
  /** Lucide icon ID shown as zone emblem */
  emblem?: string;
  /** Short tagline / motto displayed under the name */
  tagline?: string;
  /** Shape type: 'zone' = closed polygon, 'corridor' = buffered road/path */
  shape?: 'zone' | 'corridor';
  /** Original GPS centerline — only set for corridors */
  rawPath?: Coordinate[];
  /** User-chosen building type — unlocked at 3 runs */
  buildingType?: ConstructionBuildingType;
  /** Activity type used on the most recent run */
  activityType?: ActivityType;
  /** Total gamification points accumulated across all runs */
  points: number;
  /** Day-floor timestamps (one per calendar day) of every visit — used for streak tracking */
  visitDays?: number[];
  /** Per-run log — each entry is one completed run; used for accurate per-day stats in Activity page */
  runLog?: RunEntry[];
  /** Inner hole ring for road-ring zone territories.
   *  outerRing = territory.coordinates (outer road edge, expanded from GPS centerline)
   *  innerHole = this field (inner road edge = block boundary, reversed for GeoJSON hole)
   *  Together they form a donut polygon: road strip filled, block interior empty. */
  innerRing?: Coordinate[];
  /** Owner user ID — populated when territory is fetched from Supabase */
  userId?: string;
  /** Active attack state written by the attacker */
  attackType?:      AttackType | null;
  attackExpiresAt?: number | null;
  attackerId?:      string | null;
}

// ─── Activity Types ───────────────────────────────────────────────────────────
export type ActivityType = 'run' | 'walk' | 'cycle';

export type ActivityStatus = 'idle' | 'active' | 'paused' | 'completed';

export interface ActivitySession {
  id: string;
  status: ActivityStatus;
  path: Coordinate[];
  startTime: number | null;
  endTime: number | null;
  distance: number;
  activityType: ActivityType;
}

// ─── Siege System ─────────────────────────────────────────────────────────────
/** Charge counts for each of the 5 siege powers */
export interface SiegeCharges {
  inferno: number;  // max 5 — earned by km covered
  cyclone: number;  // max 3 — earned per session completed
  tremor:  number;  // max 5 — earned by revisiting territories
  deluge:  number;  // max 3 — earned by daily streaks
  vortex:  number;  // max 1 — earned by holding 5+ territories
}

export const SIEGE_MAX: SiegeCharges = { inferno: 5, cyclone: 3, tremor: 5, deluge: 3, vortex: 1 };
export const SIEGE_ZERO: SiegeCharges = { inferno: 0, cyclone: 0, tremor: 0, deluge: 0, vortex: 0 };

// ─── Siege Attack System ──────────────────────────────────────────────────────
export type AttackType = 'inferno' | 'cyclone' | 'tremor' | 'deluge' | 'vortex';

export const ATTACK_COSTS: Record<AttackType, number> = {
  inferno: 1,
  cyclone: 1,
  tremor:  3,   // heavy — collapses tier
  deluge:  1,
  vortex:  1,
};

export const ATTACK_DURATIONS_MS: Record<AttackType, number> = {
  inferno: 86_400_000,   // 24h
  cyclone: 43_200_000,   // 12h
  tremor:  0,            // permanent until re-run
  deluge:  172_800_000,  // 48h
  vortex:  7_200_000,    // 2h
};

/** A territory enriched with owner info — used for enemy territory rendering & attacks */
export interface WorldTerritory extends Territory {
  userId:     string;
  ownerName:  string;
  ownerColor: string;
}
