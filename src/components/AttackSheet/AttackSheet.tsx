import { useState, useRef } from 'react';
import { Flame, Wind, Mountain, Waves, Zap, X, Shield, Swords } from 'lucide-react';
import type { SiegeCharges, WorldTerritory, AttackType } from '../../types';
import { ATTACK_COSTS } from '../../types';
import { getTierInfo } from '../../features/territory/utils/territoryTier';
import styles from './AttackSheet.module.css';

// ── Per-power config ─────────────────────────────────────────
const POWERS: {
  key: AttackType;
  label: string;
  Icon: typeof Flame;
  color: string;
  effect: string;
  durationLabel: string;
}[] = [
  { key: 'inferno', label: 'Inferno', Icon: Flame,    color: '#ef4444',
    effect: 'Walls shrink 60% for a day',    durationLabel: '24h' },
  { key: 'cyclone', label: 'Cyclone', Icon: Wind,     color: '#0ea5e9',
    effect: 'Owner locked out of territory', durationLabel: '12h' },
  { key: 'tremor',  label: 'Tremor',  Icon: Mountain, color: '#f59e0b',
    effect: 'Collapses zone back to Tier 1', durationLabel: 'Permanent' },
  { key: 'deluge',  label: 'Deluge',  Icon: Waves,    color: '#06b6d4',
    effect: 'Decay rate tripled',            durationLabel: '48h' },
  { key: 'vortex',  label: 'Vortex',  Icon: Zap,      color: '#8b5cf6',
    effect: 'Full unclaim — anyone can take it', durationLabel: '2h' },
];

interface Props {
  territory: WorldTerritory;
  charges:   SiegeCharges;
  onAttack:  (type: AttackType) => Promise<void>;
  onClose:   () => void;
}

export function AttackSheet({ territory, charges, onAttack, onClose }: Props) {
  const [pending, setPending]     = useState<AttackType | null>(null);
  const [executing, setExecuting] = useState(false);
  const confirmTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart                 = useRef<number | null>(null);

  const tier = getTierInfo(territory.runs ?? 1);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart.current !== null) {
      if (e.changedTouches[0].clientY - dragStart.current > 80) onClose();
      dragStart.current = null;
    }
  };

  // First tap → arm the attack (2-tap confirm pattern)
  const handleArm = (type: AttackType) => {
    if (executing) return;
    if (pending === type) return; // already armed — handled by confirm button
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setPending(type);
    // Auto-disarm after 4 seconds
    confirmTimer.current = setTimeout(() => setPending(null), 4000);
  };

  // Second tap → execute
  const handleConfirm = async () => {
    if (!pending || executing) return;
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setExecuting(true);
    try {
      await onAttack(pending);
    } finally {
      setExecuting(false);
      setPending(null);
      onClose();
    }
  };

  const pendingPower = POWERS.find(p => p.key === pending);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.handle} />

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <Swords size={16} strokeWidth={2} />
          </div>
          <h2 className={styles.title}>Attack Territory</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Target card ── */}
        <div className={styles.targetCard}>
          <div className={styles.targetLeft}>
            <div className={styles.ownerDot} style={{ background: territory.ownerColor }} />
            <div>
              <p className={styles.targetName}>{territory.name}</p>
              <p className={styles.targetMeta}>
                {territory.ownerName}
                <span className={styles.tierBadge} style={{ background: `${tier.crownColor}22`, color: tier.crownColor }}>
                  {tier.name}
                </span>
              </p>
            </div>
          </div>
          <Shield size={20} style={{ color: territory.ownerColor, opacity: 0.5, flexShrink: 0 }} />
        </div>

        {/* ── Attack rows ── */}
        <div className={styles.list}>
          {POWERS.map(p => {
            const cost       = ATTACK_COSTS[p.key];
            const have       = charges[p.key];
            const canAfford  = have >= cost;
            const armed      = pending === p.key;
            return (
              <button
                key={p.key}
                className={[
                  styles.row,
                  armed         ? styles.rowArmed   : '',
                  !canAfford    ? styles.rowDisabled : '',
                ].filter(Boolean).join(' ')}
                style={armed ? { borderColor: `${p.color}60`, background: `${p.color}0a` } : undefined}
                disabled={!canAfford || executing}
                onClick={() => handleArm(p.key)}
              >
                {/* Icon */}
                <div className={styles.rowIcon}
                  style={{ background: `${p.color}18`, borderColor: `${p.color}35` }}>
                  <p.Icon size={18} strokeWidth={2}
                    style={{ color: canAfford ? p.color : 'var(--color-text-tertiary, #94a3b8)' }} />
                </div>

                {/* Body */}
                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    <span className={styles.rowName}
                      style={canAfford ? { color: p.color } : undefined}>
                      {p.label}
                    </span>
                    <span className={styles.duration}>{p.durationLabel}</span>
                  </div>
                  <span className={styles.effect}>{p.effect}</span>
                </div>

                {/* Cost */}
                <div className={[styles.costBadge, !canAfford ? styles.costBadgeLow : ''].join(' ')}
                  style={canAfford ? { background: `${p.color}20`, color: p.color } : undefined}>
                  ×{cost}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Confirm bar — appears when armed ── */}
        <div className={[styles.confirmBar, pending ? styles.confirmBarVisible : ''].join(' ')}>
          {pendingPower && (
            <>
              <span className={styles.confirmHint}>
                <pendingPower.Icon size={14} strokeWidth={2.5}
                  style={{ color: pendingPower.color }} />
                Launch {pendingPower.label} on "{territory.name}"?
              </span>
              <button
                className={[styles.confirmBtn, executing ? styles.confirmBtnLaunching : ''].filter(Boolean).join(' ')}
                style={{ background: pendingPower.color }}
                onClick={handleConfirm}
                disabled={executing}
              >
                {executing ? 'Launching…' : 'Confirm Attack'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
