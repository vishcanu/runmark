import { useState, useEffect } from 'react';
import { Flame, Wind, Mountain, Waves, Zap } from 'lucide-react';
import type { SiegeCharges } from '../../types';
import { SIEGE_MAX } from '../../types';
import styles from './SiegeHUD.module.css';

// ── Per-power config ─────────────────────────────────────────
const POWERS = [
  { key: 'inferno' as const, label: 'Inferno', Icon: Flame,    color: '#ef4444' },
  { key: 'cyclone' as const, label: 'Cyclone', Icon: Wind,     color: '#0ea5e9' },
  { key: 'tremor'  as const, label: 'Tremor',  Icon: Mountain, color: '#f59e0b' },
  { key: 'deluge'  as const, label: 'Deluge',  Icon: Waves,    color: '#06b6d4' },
  { key: 'vortex'  as const, label: 'Vortex',  Icon: Zap,      color: '#8b5cf6' },
] as const;

// ── Earned-charges toast ─────────────────────────────────────
interface ToastItem {
  key: keyof SiegeCharges;
  color: string;
  Icon: typeof Flame;
  amount: number;
}

interface Props {
  charges:      SiegeCharges;
  /** When truthy, flash an "earned" toast showing what was just gained. */
  justEarned?: Partial<SiegeCharges> | null;
}

export function SiegeHUD({ charges, justEarned }: Props) {
  const [toast, setToast] = useState<ToastItem[] | null>(null);

  // Show toast for ~3 s whenever justEarned changes
  useEffect(() => {
    if (!justEarned) return;
    const items: ToastItem[] = [];
    for (const p of POWERS) {
      const amt = justEarned[p.key] ?? 0;
      if (amt > 0) items.push({ key: p.key, color: p.color, Icon: p.Icon, amount: amt });
    }
    if (!items.length) return;
    setToast(items);
    const tid = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(tid);
  }, [justEarned]);

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Earned toast ── */}
      {toast && (
        <div className={styles.earnedToast}>
          <div className={styles.earnedBubble}>
            {toast.map(t => (
              <span key={t.key} className={styles.earnedItem} style={{ color: t.color }}>
                <t.Icon size={12} strokeWidth={2.5} />
                +{t.amount}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── HUD bar ── */}
      <div className={styles.hud}>
        {POWERS.map((p, i) => {
          const count  = charges[p.key];
          const max    = SIEGE_MAX[p.key];
          const active = count > 0;
          return (
            <>
              {i > 0 && <span key={`sep-${p.key}`} className={styles.sep} />}
              <div
                key={p.key}
                className={`${styles.pill} ${active ? styles.active : styles.empty}`}
                title={`${p.label}: ${count}/${max}`}
              >
                <span className={styles.icon}>
                  <p.Icon
                    size={13}
                    strokeWidth={2.5}
                    style={{ color: active ? p.color : 'rgba(255,255,255,0.35)' }}
                  />
                </span>
                <span
                  className={styles.count}
                  style={active ? { color: p.color } : undefined}
                >
                  {count}
                </span>
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}
