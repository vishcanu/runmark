import { useRef } from 'react';
import { Flame, Wind, Mountain, Waves, Zap, Share2, X, Shield } from 'lucide-react';
import type { AttackType } from '../../types';
import styles from './AttackStrike.module.css';

const CFG: Record<AttackType, {
  Icon:    typeof Flame;
  label:   string;
  color:   string;
  accent:  string;
  tint:    string;
}> = {
  inferno: { Icon: Flame,    label: 'Inferno', color: '#ef4444', accent: '#dc2626', tint: '#fef2f2' },
  cyclone: { Icon: Wind,     label: 'Cyclone', color: '#8b5cf6', accent: '#7c3aed', tint: '#f5f3ff' },
  tremor:  { Icon: Mountain, label: 'Tremor',  color: '#d97706', accent: '#b45309', tint: '#fffbeb' },
  deluge:  { Icon: Waves,    label: 'Deluge',  color: '#0ea5e9', accent: '#0284c7', tint: '#f0f9ff' },
  vortex:  { Icon: Zap,      label: 'Vortex',  color: '#7c3aed', accent: '#6d28d9', tint: '#f5f3ff' },
};

interface Props {
  type:       AttackType;
  targetName: string;
  ownerName:  string;
  onClose:    () => void;
}

export function AttackStrike({ type, targetName, ownerName, onClose }: Props) {
  const cfg = CFG[type];
  const dragStart = useRef<number | null>(null);

  const handleShare = async () => {
    const text = `I just launched a ${cfg.label} siege on "${targetName}" (owned by ${ownerName}) in Turf Run! They have 24 hours to defend by running.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Siege Launched!', text }); } catch { /* cancelled */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  };

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
        <div
          className={styles.banner}
          style={{
            background:      `linear-gradient(160deg, ${cfg.tint} 0%, #ffffff 100%)`,
            borderBottomColor: `${cfg.color}20`,
          }}
        >
          <button className={styles.closeBtnTop} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.5} />
          </button>

          <div
            className={styles.iconWrap}
            style={{ background: `${cfg.color}12`, borderColor: `${cfg.color}28` }}
          >
            <cfg.Icon size={48} strokeWidth={1.75} style={{ color: cfg.color }} />
          </div>

          <span className={styles.siegeLabel}>SIEGE LAUNCHED</span>
          <h1 className={styles.attackName} style={{ color: cfg.accent }}>{cfg.label}</h1>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>
          <div className={styles.targetRow}>
            <div className={styles.targetIconWrap}>
              <Shield size={16} strokeWidth={2} style={{ color: cfg.color }} />
            </div>
            <div className={styles.targetText}>
              <p className={styles.targetName}>{targetName}</p>
              <p className={styles.ownerName}>owned by {ownerName}</p>
            </div>
          </div>

          <div className={styles.sep} style={{ background: `${cfg.color}18` }} />

          <div className={styles.defenseSection}>
            <div className={styles.defenseTrack}>
              <div className={styles.defenseBarFill} style={{ background: cfg.color }} />
            </div>
            <p className={styles.defenseHint}>24-hour defense window started</p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button
            className={styles.shareBtn}
            onClick={handleShare}
            style={{ color: cfg.accent, borderColor: `${cfg.color}30`, background: `${cfg.color}08` }}
          >
            <Share2 size={15} strokeWidth={2} />
            Share
          </button>
          <button className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
