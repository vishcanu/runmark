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
  /** Distance walked in meters */
  distance: number;
  /** Duration in seconds */
  duration: number;
  buildings: Building[];
  color: string;
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
