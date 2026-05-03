import { useState, useEffect, useRef } from 'react';
import { Square, Timer, Footprints, Zap, Bike, Play, type LucideIcon } from 'lucide-react';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ActiveIcon = ACTIVITY_ICONS[activityType];
  const activeCfg = ACTIVITY_CONFIGS[activityType];

  // Close picker on outside tap
  useEffect(() => {
    if (!pickerOpen) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [pickerOpen]);

  function handlePick(type: ActivityType) {
    setPickerOpen(false);
    onStart(type);
  }

  return (
    <div className={styles.container} ref={wrapRef}>
      {/* Live stats pill — shown above stop button during activity */}
      {isActive && (
        <div className={styles.statsCard}>
          <ActiveIcon size={14} strokeWidth={2.5} style={{ color: activeCfg.color, flexShrink: 0 }} />
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

      {/* Activity picker popup — appears above FAB */}
      {pickerOpen && (
        <div className={styles.picker}>
          {(['run', 'walk', 'cycle'] as ActivityType[]).map((type) => {
            const c = ACTIVITY_CONFIGS[type];
            const Icon = ACTIVITY_ICONS[type];
            return (
              <button
                key={type}
                className={styles.pickerOption}
                onClick={() => handlePick(type)}
              >
                <span className={styles.pickerIcon} style={{ background: c.color + '20', color: c.color }}>
                  <Icon size={16} strokeWidth={2.5} />
                </span>
                <div className={styles.pickerText}>
                  <span className={styles.pickerLabel}>{c.label}</span>
                  <span className={styles.pickerDesc}>{c.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB row — single button at all times when idle */}
      <div className={styles.actionRow}>
        {!isActive ? (
          isSnapping ? (
            <button className={styles.fabStop} disabled aria-label="Mapping territory"
              style={{ opacity: 0.7, flexDirection: 'column', gap: '2px' }}>
              <Square size={14} strokeWidth={2.5} />
              <span style={{ fontSize: '10px', lineHeight: 1 }}>Map…</span>
            </button>
          ) : (
            <button
              className={styles.fab}
              onClick={() => setPickerOpen((o) => !o)}
              aria-label="Start activity"
            >
              <Play size={17} strokeWidth={2.5} />
              Start
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

