import { Trees, Waves, Navigation, Play, X, ChevronRight, Building2 } from 'lucide-react';
import { navigateToPark, formatParkDistance } from '../utils/parkUtils';
import type { Park } from '../types';
import styles from './NearbyParkCard.module.css';

interface NearbyParkCardProps {
  park: Park;
  /** Estimated buildings the user could earn running the park perimeter */
  estimatedBuildings?: number;
  onStartActivityHere: () => void;
  onDismiss: () => void;
}

export function NearbyParkCard({
  park,
  estimatedBuildings,
  onStartActivityHere,
  onDismiss,
}: NearbyParkCardProps) {
  const isVeryClose = park.distance < 500;
  const isLake = park.placeType === 'lake';
  const Icon = isLake ? Waves : Trees;

  const placeWord = isLake ? 'lake' : park.placeType === 'garden' ? 'garden' : 'park';
  const placeWordCap = placeWord.charAt(0).toUpperCase() + placeWord.slice(1);

  return (
    <div
      className={[
        styles.card,
        isVeryClose ? styles.close : '',
        isLake ? styles.lake : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Close button */}
      <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss card">
        <X size={14} strokeWidth={2.5} />
      </button>

      {/* Header row */}
      <div className={styles.header}>
        <div className={[styles.iconWrap, isLake ? styles.iconLake : ''].filter(Boolean).join(' ')}>
          <Icon size={20} strokeWidth={1.75} />
          {isVeryClose && <span className={styles.pulseDot} />}
        </div>
        <div className={styles.info}>
          <p className={styles.label}>
            {isVeryClose
              ? `${placeWordCap} nearby — claim it now!`
              : `${placeWordCap} within reach`}
          </p>
          <h3 className={styles.name}>{park.name}</h3>
        </div>
        <div className={styles.distancePill}>
          <span className={styles.distanceValue}>{formatParkDistance(park.distance)}</span>
          <span className={styles.walkTime}>{park.walkMinutes} min</span>
        </div>
      </div>

      {/* Insight row */}
      <div className={styles.insight}>
        <div className={styles.insightItem}>
          <Building2 size={13} strokeWidth={2} className={styles.insightIcon} />
          <span>
            {park.isClaimed
              ? `You own this ${placeWord} — run to expand`
              : estimatedBuildings
              ? `Claim ~${estimatedBuildings} buildings here`
              : 'Unclaimed territory available'}
          </span>
        </div>
        {!park.isClaimed && <span className={styles.firstBadge}>First to claim!</span>}
      </div>

      {/* Action row */}
      <div className={styles.actions}>
        <button
          className={styles.navigateBtn}
          onClick={() => navigateToPark(park.lat, park.lng)}
          aria-label={`Navigate to ${placeWord}`}
        >
          <Navigation size={15} strokeWidth={2} />
          Directions
        </button>
        <button
          className={[styles.startBtn, isLake ? styles.startBtnLake : ''].filter(Boolean).join(' ')}
          onClick={onStartActivityHere}
          aria-label={`Start activity at ${park.name}`}
        >
          <Play size={14} strokeWidth={2.5} />
          {isLake ? 'Run the Lake' : 'Start Run Here'}
          <ChevronRight size={14} strokeWidth={2.5} className={styles.chevron} />
        </button>
      </div>
    </div>
  );
}
