import { Flame, TrendingUp, Clock, MapPin, Activity as ActivityIcon } from 'lucide-react';
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
  const runCount = store.territories.length;

  const selectedTerritory = store.selectedId
    ? store.getTerritory(store.selectedId)
    : null;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className={styles.page}>

      {/* ── Hero header ─────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.heroDate}>{today}</p>
            <h1 className={styles.heroName}>Hey, {user.name} 👋</h1>
          </div>
          <div className={styles.heroAvatar} style={{ background: user.color }}>
            {user.initial}
          </div>
        </div>
        <div className={styles.streakPill}>
          <Flame size={13} strokeWidth={2.2} className={styles.streakIcon} />
          <span className={styles.streakText}>
            {runCount > 0
              ? `${runCount} run${runCount !== 1 ? 's' : ''} completed`
              : 'Start your first run!'}
          </span>
        </div>
      </div>

      {/* ── Stats grid ──────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <TrendingUp size={15} strokeWidth={2.2} />
          </div>
          <span className={styles.statValue}>{formatDistance(totalDistance)}</span>
          <span className={styles.statLabel}>Distance</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Clock size={15} strokeWidth={2.2} />
          </div>
          <span className={styles.statValue}>{formatDuration(totalDuration)}</span>
          <span className={styles.statLabel}>Total Time</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <MapPin size={15} strokeWidth={2.2} />
          </div>
          <span className={styles.statValue}>{runCount}</span>
          <span className={styles.statLabel}>Territories</span>
        </div>
      </div>

      {/* ── Territory list ───────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Your Territories</span>
          {runCount > 0 && (
            <span className={styles.sectionBadge}>{runCount}</span>
          )}
        </div>

        {runCount === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIconWrap}>
              <ActivityIcon size={28} strokeWidth={1.5} />
            </div>
            <p className={styles.emptyTitle}>No territories yet</p>
            <p className={styles.emptyText}>
              Head to the Map tab, tap Start Run and walk a loop to claim your first territory.
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

