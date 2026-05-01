import { Activity as ActivityIcon, TrendingUp, Clock } from 'lucide-react';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { TerritoryCard } from '../../features/territory/components/TerritoryCard';
import { Modal } from '../../components/Modal/Modal';
import { TerritoryDetails } from '../../features/territory/components/TerritoryDetails';
import { formatDistance, formatDuration } from '../../features/map/utils/geo';
import { useUserProfile } from '../../hooks/useUserProfile';
import styles from './Activity.module.css';

export function Activity() {
  const store = useTerritoryStore();
  const user = useUserProfile();

  const totalDistance = store.territories.reduce((sum, t) => sum + t.distance, 0);
  const totalDuration = store.territories.reduce((sum, t) => sum + t.duration, 0);

  const selectedTerritory = store.selectedId
    ? store.getTerritory(store.selectedId)
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Activity</h1>
            <p className={styles.subtitle}>Hey, {user.name} 👋</p>
          </div>
          <div className={styles.avatarSmall} style={{ background: user.color }}>
            <span className={styles.avatarInitial}>{user.initial}</span>
          </div>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <TrendingUp size={18} strokeWidth={2} className={styles.summaryIcon} />
          <span className={styles.summaryValue}>{formatDistance(totalDistance)}</span>
          <span className={styles.summaryLabel}>Total Distance</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <Clock size={18} strokeWidth={2} className={styles.summaryIcon} />
          <span className={styles.summaryValue}>{formatDuration(totalDuration)}</span>
          <span className={styles.summaryLabel}>Total Time</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <ActivityIcon size={18} strokeWidth={2} className={styles.summaryIcon} />
          <span className={styles.summaryValue}>{store.territories.length}</span>
          <span className={styles.summaryLabel}>Territories</span>
        </div>
      </div>

      <div className={styles.list}>
        {store.territories.length === 0 ? (
          <div className={styles.empty}>
            <ActivityIcon size={40} strokeWidth={1.5} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No territories yet</p>
            <p className={styles.emptyText}>
              Go to the map and start an activity to claim your first territory.
            </p>
          </div>
        ) : (
          store.territories.map((t) => (
            <TerritoryCard
              key={t.id}
              territory={t}
              onClick={store.selectTerritory}
            />
          ))
        )}
      </div>

      {selectedTerritory && (
        <Modal
          open={!!store.selectedId}
          onClose={() => store.selectTerritory(null)}
          title={selectedTerritory.name}
        >
          <TerritoryDetails
            territory={selectedTerritory}
            onDelete={(id) => {
              store.removeTerritory(id);
              store.selectTerritory(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
