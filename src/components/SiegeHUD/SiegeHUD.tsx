import { useRef } from 'react';
import { Flame, Wind, Mountain, Waves, Zap, X, Shield } from 'lucide-react';
import type { SiegeCharges } from '../../types';
import { SIEGE_MAX } from '../../types';
import styles from './SiegeHUD.module.css';

// ── Per-power config ─────────────────────────────────────────
const POWERS = [
  {
    key: 'inferno' as const,
    label: 'Blaze',
    Icon: Flame,
    color: '#ef4444',
    description: 'Cover distance',
    detail: '+1 per 500 m covered · Running ×1.5',
  },
  {
    key: 'cyclone' as const,
    label: 'Whirl',
    Icon: Wind,
    color: '#0ea5e9',
    description: 'Complete any activity',
    detail: '+1 per session · Cycling ×2',
  },
  {
    key: 'tremor' as const,
    label: 'Quake',
    Icon: Mountain,
    color: '#f59e0b',
    description: 'Revisit a zone you own',
    detail: '+1 per revisit · Walking ×2',
  },
  {
    key: 'deluge' as const,
    label: 'Seep',
    Icon: Waves,
    color: '#06b6d4',
    description: 'Stay active every day',
    detail: '+1 per consecutive active day',
  },
  {
    key: 'vortex' as const,
    label: 'Rift',
    Icon: Zap,
    color: '#8b5cf6',
    description: 'Hold 5+ territories',
    detail: '+1 each time you reach a multiple of 5',
  },
] as const;

// ── 5 dots — shown in MapHeader center as the trigger ────────
export function SiegeDots({ charges }: { charges: SiegeCharges }) {
  return (
    <div className={styles.dots}>
      {POWERS.map(p => {
        const active = charges[p.key] > 0;
        return (
          <span
            key={p.key}
            className={styles.dot}
            style={active ? { background: p.color, boxShadow: `0 0 5px ${p.color}70` } : undefined}
          />
        );
      })}
    </div>
  );
}

// ── Full slide-up Siege Panel ────────────────────────────────
interface PanelProps {
  charges: SiegeCharges;
  onClose: () => void;
}

export function SiegePanel({ charges, onClose }: PanelProps) {
  const dragStart = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart.current !== null) {
      const delta = e.changedTouches[0].clientY - dragStart.current;
      if (delta > 80) onClose();
      dragStart.current = null;
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.handle} />

        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <Shield size={16} strokeWidth={2} />
          </div>
          <h2 className={styles.title}>Siege Powers</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className={styles.list}>
          {POWERS.map(p => {
            const count  = charges[p.key];
            const max    = SIEGE_MAX[p.key];
            const active = count > 0;
            return (
              <div key={p.key} className={styles.row}>
                <div
                  className={styles.rowIcon}
                  style={active ? { background: `${p.color}18`, borderColor: `${p.color}40` } : undefined}
                >
                  <p.Icon
                    size={18}
                    strokeWidth={2}
                    style={{ color: active ? p.color : 'var(--color-text-tertiary, #94a3b8)' }}
                  />
                </div>

                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    <span
                      className={styles.rowName}
                      style={active ? { color: p.color } : undefined}
                    >
                      {p.label}
                    </span>
                    <span className={styles.rowCount}>
                      <span style={active ? { color: p.color, fontWeight: 800 } : undefined}>
                        {count}
                      </span>
                      <span className={styles.rowMax}>/{max}</span>
                    </span>
                  </div>

                  <div className={styles.bar}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(count / max) * 100}%`,
                        background: active ? p.color : undefined,
                      }}
                    />
                  </div>

                  <span className={styles.rowDesc}>{p.description}</span>
                  <span className={styles.rowDetail}>{p.detail}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className={styles.footer}>Powers fuel Siege attacks · coming soon</p>
      </div>
    </div>
  );
}
