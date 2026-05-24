import { useRef } from 'react';
import { Shield, X } from 'lucide-react';
import styles from './DefenseSuccess.module.css';

interface Props {
  territories: string[];
  onClose:     () => void;
}

export function DefenseSuccess({ territories, onClose }: Props) {
  const dragStart = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart.current !== null) {
      if (e.changedTouches[0].clientY - dragStart.current > 80) onClose();
      dragStart.current = null;
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.handle} />

        {/* ── Banner ── */}
        <div className={styles.banner}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={17} strokeWidth={2.5} />
          </button>

          <div className={styles.iconWrap}>
            <Shield size={48} strokeWidth={1.5} />
          </div>

          <h2 className={styles.title}>
            {territories.length === 1 ? 'Territory Defended!' : `${territories.length} Territories Defended!`}
          </h2>
          <p className={styles.subtitle}>
            You ran through the siege and held your ground.
          </p>
        </div>

        {/* ── Defended territory list ── */}
        <div className={styles.body}>
          {territories.map((name, i) => (
            <div
              key={i}
              className={styles.item}
              style={{ animationDelay: `${0.25 + i * 0.08}s` }}
            >
              <div className={styles.itemIcon}>
                <Shield size={13} strokeWidth={2} />
              </div>
              <span className={styles.itemName}>{name}</span>
              <span className={styles.itemBadge}>Defended</span>
            </div>
          ))}
        </div>

        {/* ── Action ── */}
        <div className={styles.actions}>
          <button className={styles.doneBtn} onClick={onClose}>Excellent!</button>
        </div>
      </div>
    </div>
  );
}
