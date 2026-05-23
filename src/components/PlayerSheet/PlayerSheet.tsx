import { useEffect, useRef, useState } from 'react';
import { Map, Eye, Zap, Flag, Crown, Star, Footprints, Bike } from 'lucide-react';
import { fetchPlayerTerritories } from '../../lib/db';
import { formatDistance } from '../../features/map/utils/geo';
import { getTierInfo } from '../../features/territory/utils/territoryTier';
import type { Territory } from '../../types';
import styles from './PlayerSheet.module.css';

// ── Rank system (mirrors Arena.tsx) ──────────────────────────
const RANKS = [
  { title: 'Scout',     color: '#64748b', min: 0,  max: 2,  Icon: Eye   },
  { title: 'Raider',    color: '#0284c7', min: 3,  max: 5,  Icon: Zap   },
  { title: 'Warlord',   color: '#7c3aed', min: 6,  max: 10, Icon: Flag  },
  { title: 'Commander', color: '#ea580c', min: 11, max: 20, Icon: Star  },
  { title: 'Overlord',  color: '#dc2626', min: 21, max: Infinity, Icon: Crown },
];
function getRank(territories: number) {
  return RANKS.find(r => territories >= r.min && territories <= r.max) ?? RANKS[0];
}
function siegeScore(territories: number, distanceM: number) {
  return territories * 300 + Math.round(distanceM / 10);
}

const ACT_ICONS = { run: Zap, walk: Footprints, cycle: Bike } as const;

export interface PlayerEntry {
  id:          string;
  name:        string;
  color:       string;
  territories: number;
  distanceM:   number;
  score:       number;
}

interface Props {
  entry:      PlayerEntry;
  onClose:    () => void;
  onViewMap:  (territories: Territory[]) => void;
}

export function PlayerSheet({ entry, onClose, onViewMap }: Props) {
  const [territories, setTerritories] = useState<Territory[] | null>(null);
  const [loading, setLoading]         = useState(true);

  const sheetRef  = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const dragRef   = useRef(0);

  // Fetch this player's territories from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    fetchPlayerTerritories(entry.id).then(data => {
      if (!cancelled) { setTerritories(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [entry.id]);

  // ── Drag-to-dismiss ────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY;
    dragRef.current   = 0;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }

  function onTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta < 0) return;
    dragRef.current = delta;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`;
  }

  function onTouchEnd() {
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
    }
    if (dragRef.current > 100) {
      onClose();
    } else {
      if (sheetRef.current) sheetRef.current.style.transform = 'translateY(0)';
    }
    dragRef.current = 0;
  }

  const rank    = getRank(entry.territories);
  const RankIcon = rank.Icon;
  const score   = entry.score || siegeScore(entry.territories, entry.distanceM);

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className={styles.handle} />

        {/* Header — avatar + name + rank */}
        <div className={styles.header}>
          <div className={styles.avatar} style={{ background: entry.color }}>
            {entry.name[0].toUpperCase()}
          </div>
          <div className={styles.headerInfo}>
            <p className={styles.playerName}>{entry.name}</p>
            <div className={styles.rankRow}>
              <span
                className={styles.rankBadge}
                style={{ color: rank.color, borderColor: rank.color + '40', background: rank.color + '12' }}
              >
                <RankIcon size={11} strokeWidth={2.5} />
                {rank.title}
              </span>
              <span className={styles.scoreLabel}>{score.toLocaleString()} pts</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statVal}>{entry.territories}</span>
            <span className={styles.statLbl}>Zones</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statVal}>{formatDistance(entry.distanceM)}</span>
            <span className={styles.statLbl}>Distance</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statVal}>{score.toLocaleString()}</span>
            <span className={styles.statLbl}>Score</span>
          </div>
        </div>

        {/* Territory list */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Their Territories</span>
            {!loading && territories !== null && (
              <span className={styles.sectionCount}>{territories.length}</span>
            )}
          </div>

          <div className={styles.territoryList}>
            {loading ? (
              // Skeleton rows
              [80, 110, 72, 95].map((w, i) => (
                <div key={i} className={styles.skeletonRow}>
                  <div className={styles.skeletonDot} />
                  <div style={{ flex: 1 }}>
                    <div className={styles.skeletonName} style={{ width: w }} />
                    <div className={styles.skeletonMeta} style={{ width: w * 0.65 }} />
                  </div>
                  <div className={styles.skeletonTag} />
                </div>
              ))
            ) : territories && territories.length > 0 ? (
              territories.map(t => {
                const tier = getTierInfo(t.runs ?? 1);
                const ActIcon = ACT_ICONS[t.activityType ?? 'run'] ?? Zap;
                return (
                  <div key={t.id} className={styles.territoryRow}>
                    <div className={styles.tDot} style={{ background: t.color }} />
                    <div className={styles.tInfo}>
                      <span className={styles.tName}>{t.name}</span>
                      <span className={styles.tMeta}>
                        <ActIcon size={9} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {formatDistance(t.distance)} · {t.runs ?? 1} {(t.runs ?? 1) === 1 ? 'run' : 'runs'}
                      </span>
                    </div>
                    <span
                      className={styles.tierTag}
                      style={{ color: tier.crownColor, borderColor: tier.crownColor + '50', background: tier.crownColor + '12' }}
                    >
                      {tier.name}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className={styles.emptyState}>No territories yet</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            className={styles.viewMapBtn}
            style={{ background: entry.color, boxShadow: `0 4px 20px ${entry.color}50` }}
            disabled={loading || !territories || territories.length === 0}
            onClick={() => onViewMap(territories ?? [])}
          >
            <Map size={16} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 7 }} />
            View on Map
          </button>
          <button className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
