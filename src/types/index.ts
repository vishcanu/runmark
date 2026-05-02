// ─── Core Geo Types ──────────────────────────────────────────────────────────
/** [longitude, latitude] */
export type Coordinate = [number, number];

// ─── Building Types ───────────────────────────────────────────────────────────
export type BuildingType = 'cottage' | 'tower' | 'skyscraper' | 'landmark';

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
  /** Theme ID — drives gradient swatch selection in the edit panel */
  theme?: string;
  /** Lucide icon ID shown as zone emblem */
  emblem?: string;
  /** Short tagline / motto displayed under the name */
  tagline?: string;
}

// ─── Activity Types ───────────────────────────────────────────────────────────
export type ActivityStatus = 'idle' | 'active' | 'paused' | 'completed';

export interface ActivitySession {
  id: string;
  status: ActivityStatus;
  path: Coordinate[];
  startTime: number | null;
  endTime: number | null;
  distance: number;
}
