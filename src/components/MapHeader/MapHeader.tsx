import { MapPin } from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';
import styles from './MapHeader.module.css';

interface MapHeaderProps {
  isActive?: boolean;
}

export function MapHeader({ isActive = false }: MapHeaderProps) {
  const user = useUserProfile();

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.locationRow}>
          <MapPin size={14} strokeWidth={2.5} className={styles.pinIcon} />
          <span className={styles.locationLabel}>
            {isActive ? 'Recording' : 'Near you'}
          </span>
          {isActive && <div className={styles.recordDot} />}
        </div>
      </div>

      <div className={styles.right}>
        <div
          className={styles.avatar}
          style={{ background: user.color }}
          aria-label={user.name}
        >
          {user.initial}
        </div>
      </div>
    </div>
  );
}

