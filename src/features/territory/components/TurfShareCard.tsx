import React, { forwardRef } from 'react';
import {
  Shield, Zap, Star, Crown, Flag, Target,
  Flame, Trophy, Gem, Anchor, Mountain, Crosshair,
} from 'lucide-react';
import type { Territory } from '../../../types';
import styles from './TurfShareCard.module.css';

// ── Duplicate theme/emblem data so card is fully self-contained ───────────────
const THEMES = [
  { id: 'azure',   grad: 'linear-gradient(135deg,#60a5fa,#1d4ed8)' },
  { id: 'arctic',  grad: 'linear-gradient(135deg,#e0f2fe,#0369a1)' },
  { id: 'lagoon',  grad: 'linear-gradient(135deg,#2dd4bf,#0f766e)' },
  { id: 'abyss',   grad: 'linear-gradient(135deg,#38bdf8,#164e63)' },
  { id: 'emerald', grad: 'linear-gradient(135deg,#34d399,#065f46)' },
  { id: 'moss',    grad: 'linear-gradient(135deg,#a3e635,#3f6212)' },
  { id: 'ember',   grad: 'linear-gradient(135deg,#fbbf24,#b45309)' },
  { id: 'inferno', grad: 'linear-gradient(135deg,#f97316,#7f1d1d)' },
  { id: 'nebula',  grad: 'linear-gradient(135deg,#a78bfa,#4c1d95)' },
  { id: 'aurora',  grad: 'linear-gradient(135deg,#f0abfc,#6b21a8)' },
  { id: 'sakura',  grad: 'linear-gradient(135deg,#fda4af,#9f1239)' },
  { id: 'rose',    grad: 'linear-gradient(135deg,#fb7185,#881337)' },
  { id: 'onyx',    grad: 'linear-gradient(135deg,#475569,#0f172a)' },
  { id: 'gold',    grad: 'linear-gradient(135deg,#fde68a,#92400e)' },
  { id: 'prism',   grad: 'linear-gradient(135deg,#818cf8,#06b6d4)' },
  { id: 'dusk',    grad: 'linear-gradient(135deg,#fb923c,#7c3aed)' },
  // legacy fallback
  { id: 'cobalt',  grad: 'linear-gradient(135deg,#38bdf8,#0284c7)' },
];

const EMBLEMS: { id: string; Icon: React.ElementType }[] = [
  { id: 'shield',    Icon: Shield    },
  { id: 'crown',     Icon: Crown     },
  { id: 'zap',       Icon: Zap       },
  { id: 'star',      Icon: Star      },
  { id: 'flame',     Icon: Flame     },
  { id: 'trophy',    Icon: Trophy    },
  { id: 'target',    Icon: Target    },
  { id: 'flag',      Icon: Flag      },
  { id: 'gem',       Icon: Gem       },
  { id: 'anchor',    Icon: Anchor    },
  { id: 'mountain',  Icon: Mountain  },
  { id: 'crosshair', Icon: Crosshair },
];

function getGrad(id?: string) {
  return (THEMES.find((t) => t.id === id) ?? THEMES[0]).grad;
}
function getEmblem(id?: string) {
  return (EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0]).Icon;
}

// ── Level names ───────────────────────────────────────────────
function getLevel(runs: number): string {
  if (runs >= 5) return 'Understood the Assignment';
  if (runs >= 4) return 'Ate';
  if (runs >= 3) return 'Main Character';
  if (runs >= 2) return 'On Site';
  return 'Lowkey';
}

// ── Grip (health %) ───────────────────────────────────────────
const MS_PER_DAY = 86_400_000;
function gripPct(lastRunAt: number): number {
  const days = (Date.now() - lastRunAt) / MS_PER_DAY;
  return Math.max(0, Math.min(100, Math.round((1 - days * 0.082) * 100)));
}

// ── Territory coords → SVG polygon points ────────────────────
function toSvgPoints(coords: [number, number][], w: number, h: number): string {
  if (coords.length < 2) return '';
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const lngSpan = maxLng - minLng || 0.001;
  const latSpan = maxLat - minLat || 0.001;
  const pad = 20;
  const scale = Math.min((w - pad * 2) / lngSpan, (h - pad * 2) / latSpan);
  const drawW = lngSpan * scale;
  const drawH = latSpan * scale;
  const ox = (w - drawW) / 2;
  const oy = (h - drawH) / 2;
  return coords
    .map(([lng, lat]) => `${(ox + (lng - minLng) * scale).toFixed(1)},${(oy + (maxLat - lat) * scale).toFixed(1)}`)
    .join(' ');
}

// ── Distance formatter ────────────────────────────────────────
function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

interface Props {
  territory: Territory;
}

export const TurfShareCard = forwardRef<HTMLDivElement, Props>(({ territory }, ref) => {
  const grad = getGrad(territory.theme);
  const EmblemIcon = getEmblem(territory.emblem);
  const grip = gripPct(territory.lastRunAt ?? territory.createdAt);
  const level = getLevel(territory.runs ?? 1);
  const SVG_W = 280;
  const SVG_H = 190;
  const points = toSvgPoints(territory.coordinates as [number, number][], SVG_W, SVG_H);

  return (
    <div ref={ref} className={styles.card} style={{ background: grad }}>

      {/* Dot-grid texture */}
      <div className={styles.texture} />

      {/* Level pill — top right */}
      <div className={styles.levelPill}>{level}</div>

      {/* Territory shape */}
      <div className={styles.shapeWrap}>
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ display: 'block' }}
        >
          {points && (
            <>
              {/* outer glow */}
              <polygon
                points={points}
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="8"
                strokeLinejoin="round"
              />
              {/* fill */}
              <polygon
                points={points}
                fill="rgba(255,255,255,0.15)"
                stroke="rgba(255,255,255,0.75)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
      </div>

      {/* Middle: emblem + name + tagline */}
      <div className={styles.middle}>
        <div className={styles.emblemBadge}>
          <EmblemIcon size={30} strokeWidth={1.75} color="#ffffff" />
        </div>
        <h2 className={styles.zoneName}>{territory.name}</h2>
        {territory.tagline ? (
          <p className={styles.tagline}>"{territory.tagline}"</p>
        ) : null}
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statChip}>
          <span className={styles.statVal}>{grip}%</span>
          <span className={styles.statKey}>Grip</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statChip}>
          <span className={styles.statVal}>{territory.runs ?? 1}×</span>
          <span className={styles.statKey}>Grinds</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statChip}>
          <span className={styles.statVal}>{fmtDist(territory.distance)}</span>
          <span className={styles.statKey}>Distance</span>
        </div>
      </div>

      {/* Brand */}
      <div className={styles.brand}>
        <span className={styles.brandText}>RunMark</span>
      </div>

    </div>
  );
});

TurfShareCard.displayName = 'TurfShareCard';
