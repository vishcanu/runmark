import { Play, Square, Timer, Footprints } from 'lucide-react';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import type { ActivityStatus } from '../../../types';
import styles from './ActivityControls.module.css';

interface ActivityControlsProps {
  status: ActivityStatus;
  elapsedSeconds: number;
  distance: number;
  onStart: () => void;
  onStop: () => void;
}

export function ActivityControls({
  status,
  elapsedSeconds,
  distance,
  onStart,
  onStop,
}: ActivityControlsProps) {
  const isActive = status === 'active';

  return (
    <div className={styles.container}>
      {/* Live stats — shown only during activity */}
      {isActive && (
        <div className={styles.statsCard}>
          <div className={styles.stat}>
            <Timer size={13} strokeWidth={2.5} className={styles.statIcon} />
            <span className={styles.statVal}>{formatDuration(elapsedSeconds)}</span>
            <span className={styles.statLbl}>Time</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <Footprints size={13} strokeWidth={2.5} className={styles.statIcon} />
            <span className={styles.statVal}>{formatDistance(distance)}</span>
            <span className={styles.statLbl}>Distance</span>
          </div>
        </div>
      )}

      {/* FAB */}
      {!isActive ? (
        <div className={styles.fabWrap}>
          <button className={styles.fab} onClick={onStart} aria-label="Start activity">
            <Play size={18} strokeWidth={2.5} />
            Start Run
          </button>
        </div>
      ) : (
        <div className={styles.fabWrap}>
          <button className={styles.fabStop} onClick={onStop} aria-label="Stop activity">
            <Square size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}

