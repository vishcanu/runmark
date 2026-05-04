// ─── Core Geo Types ──────────────────────────────────────────────────────────
/** [longitude, latitude] */
export type Coordinate = [number, number];

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
