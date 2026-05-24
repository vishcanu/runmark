import { Flame, Wind, Mountain, Waves, Zap } from 'lucide-react';
import type { AttackType } from '../../types';
import styles from './AttackStrike.module.css';

const CFG: Record<AttackType, {
  Icon: typeof Flame;
  label: string;
  color: string;
  ringGlow: string;
}> = {
  inferno: { Icon: Flame,    label: 'INFERNO', color: '#ff4500', ringGlow: '#ff450070' },
  cyclone: { Icon: Wind,     label: 'CYCLONE', color: '#a855f7', ringGlow: '#a855f770' },
  tremor:  { Icon: Mountain, label: 'TREMOR',  color: '#d97706', ringGlow: '#d9770670' },
  deluge:  { Icon: Waves,    label: 'DELUGE',  color: '#0ea5e9', ringGlow: '#0ea5e970' },
  vortex:  { Icon: Zap,      label: 'VORTEX',  color: '#8b5cf6', ringGlow: '#8b5cf670' },
};

interface Props {
  type: AttackType;
  targetName: string;
  ownerName: string;
}

export function AttackStrike({ type, targetName, ownerName }: Props) {
  const cfg = CFG[type];
  return (
    <div className={styles.overlay}>
      {/* Radial background glow */}
      <div
        className={styles.bgGlow}
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 46%, ${cfg.ringGlow}, transparent 70%)` }}
      />
      {/* Expanding ripple rings */}
      <div className={styles.ripple1} style={{ borderColor: cfg.color }} />
      <div className={styles.ripple2} style={{ borderColor: cfg.color }} />
      <div className={styles.ripple3} style={{ borderColor: cfg.color }} />

      <div className={styles.content}>
        {/* Icon */}
        <div
          className={styles.iconRing}
          style={{
            borderColor: cfg.color,
            boxShadow: `0 0 0 10px ${cfg.ringGlow}, 0 0 80px ${cfg.ringGlow}`,
          }}
        >
          <cfg.Icon size={64} strokeWidth={1.5} style={{ color: cfg.color }} />
        </div>

        {/* Labels — each staggered */}
        <p className={styles.verb}>SIEGE LAUNCHED</p>

        <p className={styles.attackName} style={{ color: cfg.color, textShadow: `0 0 40px ${cfg.ringGlow}` }}>
          {cfg.label}
        </p>

        <div className={styles.divider} style={{ background: cfg.color }} />

        <p className={styles.targetName}>{targetName}</p>
        <p className={styles.ownerName}>owned by {ownerName}</p>

        {/* Defense window */}
        <div className={styles.defenseBarWrap}>
          <div className={styles.defenseBarFill} style={{ background: cfg.color }} />
        </div>
        <p className={styles.defenseHint}>Owner has 24h to defend by running</p>
      </div>
    </div>
  );
}
