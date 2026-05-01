import { Building2 } from 'lucide-react';
import { Card } from '../../../components/Card/Card';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import type { Territory } from '../../../types';
import styles from './TerritoryCard.module.css';

interface TerritoryCardProps {
  territory: Territory;
  onClick: (id: string) => void;
}

export function TerritoryCard({ territory, onClick }: TerritoryCardProps) {
  return (
    <Card interactive onClick={() => onClick(territory.id)} className={styles.card}>
      <div className={styles.colorBar} style={{ background: territory.color }} />
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.name}>{territory.name}</span>
          <div className={styles.buildingBadge}>
            <Building2 size={12} strokeWidth={2} />
            <span>{territory.buildings.length}</span>
          </div>
        </div>
        <div className={styles.meta}>
          <span>{formatDistance(territory.distance)}</span>
          <span className={styles.dot} />
          <span>{formatDuration(territory.duration)}</span>
          <span className={styles.dot} />
          <span>{new Date(territory.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Card>
  );
}
