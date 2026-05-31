// ── IMPRINT System ────────────────────────────────────────────
// Each lap around your territory physically reinforces it.
// More runs = taller walls, thicker perimeter, brighter crown.

export interface TierInfo {
  name:         string;  // display label
  wallM:        number;  // perimeter band thickness in metres
  crownH:       number;  // crown cap band height in metres
  crownColor:   string;  // crown extrusion colour
  floorOpacity: number;  // floor fill opacity (idle, non-selected)
  haloWidth:    number;  // diffuse halo line-width
  borderWidth:  number;  // crisp border line-width
  uiColor:      string;  // badge accent colour in UI
}

// Ordered high→low so the first match wins
const TIERS: Array<{ minRuns: number } & TierInfo> = [
  {
    minRuns: 10,
    name: 'CERTIFIED',
    wallM: 2.5, crownH: 10, crownColor: '#f97316',
    floorOpacity: 0.22, haloWidth: 11, borderWidth: 2.5,
    uiColor: '#f97316',
  },
  {
    minRuns: 5,
    name: 'GOATED',
    wallM: 2.2, crownH: 7,  crownColor: '#fbbf24',
    floorOpacity: 0.18, haloWidth:  9, borderWidth: 2.2,
    uiColor: '#fbbf24',
  },
  {
    minRuns: 3,
    name: 'SLAPS',
    wallM: 2,   crownH: 5,  crownColor: '#fde68a',
    floorOpacity: 0.13, haloWidth:  7, borderWidth: 2.0,
    uiColor: '#a3e635',
  },
  {
    minRuns: 2,
    name: 'COOKING',
    wallM: 1.8, crownH: 4,  crownColor: '#e2e8f0',
    floorOpacity: 0.09, haloWidth:  5, borderWidth: 1.8,
    uiColor: '#60a5fa',
  },
  {
    minRuns: 1,
    name: 'LOWKEY',
    wallM: 1.5, crownH: 0,  crownColor: '#ffffff',  // crownH=0 → no crown on first run
    floorOpacity: 0.06, haloWidth:  4, borderWidth: 1.5,
    uiColor: '#94a3b8',
  },
];

export function getTierInfo(runs: number): TierInfo {
  return TIERS.find((t) => runs >= t.minRuns) ?? TIERS[TIERS.length - 1];
}

/** Next tier threshold, or null if already max */
export function nextTierAt(runs: number): number | null {
  const idx = TIERS.findIndex((t) => runs >= t.minRuns);
  if (idx <= 0) return null; // already at top tier
  return TIERS[idx - 1].minRuns;
}

const MS_PER_DAY = 86_400_000;

/**
 * Count consecutive days of visits ending today (or yesterday).
 * visitDays: array of timestamps from completed runs.
 * Returns at minimum 1 (the day a territory was first created).
 */
export function computeDailyStreak(visitDays: number[]): number {
  if (!visitDays || visitDays.length === 0) return 1;
  // Floor each timestamp to its calendar day index
  const days = [...new Set(visitDays.map((d) => Math.floor(d / MS_PER_DAY)))]
    .sort((a, b) => b - a); // newest first
  const todayDay = Math.floor(Date.now() / MS_PER_DAY);
  let streak = 0;
  let expected = todayDay;
  for (const day of days) {
    if (day === expected) {
      streak++;
      expected--;
    } else if (day < expected) {
      break; // gap — stop counting
    }
  }
  return Math.max(streak, 1);
}
