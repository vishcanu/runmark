import { useState } from 'react';
import { Square, Timer, Footprints, Zap, Bike, type LucideIcon } from 'lucide-react';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import { ACTIVITY_CONFIGS } from '../utils/points';
import type { ActivityStatus, ActivityType } from '../../../types';
import styles from './ActivityControls.module.css';

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  run:   Zap,
  walk:  Footprints,
  cycle: Bike,
};

interface ActivityControlsProps {
  status: ActivityStatus;
  elapsedSeconds: number;
  distance: number;
  activityType: ActivityType;
  onStart: (type: ActivityType) => void;
  onStop: () => void;
  isSnapping?: boolean;
}

export function ActivityControls({
  status,
  elapsedSeconds,
  distance,
  activityType,
  onStart,
  onStop,
  isSnapping = false,
}: ActivityControlsProps) {
  const isActive = status === 'active';
  const [selected, setSelected] = useState<ActivityType>('run');
  const cfg = ACTIVITY_CONFIGS[isActive ? activityType : selected];
  const ActiveIcon = ACTIVITY_ICONS[isActive ? activityType : selected];

  return (
    <div className={styles.container}>
      {/* Live stats pill — shown above the stop button during activity */}
      {isActive && (
        <div className={styles.statsCard}>
          <ActiveIcon size={14} strokeWidth={2.5} style={{ color: cfg.color, flexShrink: 0 }} />
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <Timer size={13} strokeWidth={2.5} className={styles.statIcon} />
            <span className={styles.statVal}>{formatDuration(elapsedSeconds)}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <Footprints size={13} strokeWidth={2.5} className={styles.statIcon} />
            <span className={styles.statVal}>{formatDistance(distance)}</span>
          </div>
        </div>
      )}

      {/* Single row: [Run][Walk][Cycle] → [Start FAB]  or  [Stop] */}
      <div className={styles.actionRow}>
        {/* Activity type chips — only when idle */}
        {!isActive && !isSnapping && (
          <div className={styles.typePicker}>
            {(['run', 'walk', 'cycle'] as ActivityType[]).map((type) => {
              const c = ACTIVITY_CONFIGS[type];
              const Icon = ACTIVITY_ICONS[type];
              const isChosen = selected === type;
              return (
                <button
                  key={type}
                  className={[styles.typeBtn, isChosen ? styles.typeBtnActive : ''].join(' ')}
                  style={isChosen ? { borderColor: c.color, color: c.color, background: c.color + '18' } : {}}
                  onClick={() => setSelected(type)}
                >
                  <Icon size={14} strokeWidth={2.5} />
                  <span className={styles.typeLabel}>{c.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* FAB */}
        {!isActive ? (
          isSnapping ? (
            <button className={styles.fabStop} disabled aria-label="Mapping territory" style={{ opacity: 0.7, flexDirection: 'column', gap: '2px' }}>
              <Square size={14} strokeWidth={2.5} />
              <span style={{ fontSize: '10px', lineHeight: 1 }}>Map…</span>
            </button>
          ) : (
            <button
              className={styles.fab}
              style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` }}
              onClick={() => onStart(selected)}
              aria-label={`Start ${cfg.label}`}
            >
              <ActiveIcon size={17} strokeWidth={2.5} />
              Start {cfg.label}
            </button>
          )
        ) : (
          <button className={styles.fabStop} onClick={onStop} aria-label="Stop activity">
            <Square size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}

