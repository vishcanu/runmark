import { Building2, Ruler, Clock, Trash2 } from 'lucide-react';
import { Button } from '../../../components/Button/Button';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import type { Territory } from '../../../types';
import styles from './TerritoryDetails.module.css';

interface TerritoryDetailsProps {
  territory: Territory;
  onDelete: (id: string) => void;
}

export function TerritoryDetails({ territory, onDelete }: TerritoryDetailsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.colorAccent} style={{ background: territory.color }} />

      <h2 className={styles.name}>{territory.name}</h2>
      <span className={styles.date}>
        Created {new Date(territory.createdAt).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Ruler size={18} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <div>
            <span className={styles.statValue}>{formatDistance(territory.distance)}</span>
            <span className={styles.statLabel}>Distance</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Clock size={18} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <div>
            <span className={styles.statValue}>{formatDuration(territory.duration)}</span>
            <span className={styles.statLabel}>Duration</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Building2 size={18} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <div>
            <span className={styles.statValue}>{territory.buildings.length}</span>
            <span className={styles.statLabel}>Buildings</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Buildings</h3>
        <div className={styles.buildingGrid}>
          {territory.buildings.slice(0, 12).map((b) => (
            <div key={b.id} className={styles.buildingChip}>
              <div
                className={styles.buildingBar}
                style={{
                  height: `${Math.min(32, Math.round(b.height / 4))}px`,
                  background: territory.color,
                }}
              />
              <span className={styles.buildingType}>{b.type}</span>
            </div>
          ))}
          {territory.buildings.length > 12 && (
            <div className={styles.moreChip}>+{territory.buildings.length - 12} more</div>
          )}
        </div>
      </div>

      <Button
        variant="danger"
        size="md"
        className={styles.deleteBtn}
        onClick={() => onDelete(territory.id)}
      >
        <Trash2 size={16} strokeWidth={2} />
        Delete Territory
      </Button>
    </div>
  );
}
