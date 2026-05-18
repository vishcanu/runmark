import { useEffect, useState, useRef } from 'react';
import {
  Shield, Crown, Zap, Star, Flame, Trophy, Target, Flag,
  Gem, Anchor, Mountain, Crosshair, Footprints, Bike, Activity,
} from 'lucide-react';
import type { ActivityType } from '../../types';
import styles from './TerritoryVictory.module.css';

// ── Types ─────────────────────────────────────────────────────
export interface VictoryData {
  isNew:         boolean;
  tierChanged:   boolean;
  tierName:      string;
  territoryName: string;
  color:         string;
  themeGrad:     string;
  emblem:        string;
  runDist:       number;       // metres this run
  runDur:        number;       // seconds this run
  earnedPoints:  number;
  totalRuns:     number;
  activityType:  ActivityType;
}

interface Props {
  data: VictoryData;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────
const EMBLEMS: Record<string, React.ElementType> = {
  shield: Shield, crown: Crown, zap: Zap, star: Star, flame: Flame,
  trophy: Trophy, target: Target, flag: Flag, gem: Gem, anchor: Anchor,
  mountain: Mountain, crosshair: Crosshair,
};
const ACT_ICONS: Record<ActivityType, React.ElementType> = {
  walk: Footprints, run: Activity, cycle: Bike,
};

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
function fmtSteps(m: number, type: ActivityType) {
  if (type === 'cycle') return null;
  const stride = type === 'run' ? 0.95 : 0.78;
  const s = Math.round(m / stride);
  return s >= 1000 ? `${(s / 1000).toFixed(1)}k` : `${s}`;
}

// ── Counting hook ─────────────────────────────────────────────
function useCountUp(target: number, duration = 900, delay = 200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const timer = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const p = Math.min(1, (Date.now() - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(target * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return val;
}

// ── Confetti ──────────────────────────────────────────────────
const CONFETTI_COUNT = 32;
function Confetti({ color }: { color: string }) {
  const pieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const hues = [color, '#ffffff', '#fbbf24', '#a5f3fc', color, '#fde68a', '#ffffff'];
    const c = hues[i % hues.length];
    const isCircle = i % 4 === 0;
    const size = 5 + (i % 5) * 2;
    const left = `${((i * 3.14 * 7 + 4) % 96) + 2}%`;
    const delay = `${((i * 0.09) % 1.8).toFixed(2)}s`;
    const dur   = `${(2.4 + (i % 5) * 0.28).toFixed(2)}s`;
    return (
      <span
        key={i}
        className={styles.confettiPiece}
        style={{
          left, width: size, height: isCircle ? size : size * 0.6,
          borderRadius: isCircle ? '50%' : '2px',
          background: c,
          animationDelay: delay,
          animationDuration: dur,
          transform: `rotate(${i * 37}deg)`,
        }}
      />
    );
  });
  return <div className={styles.confettiWrap}>{pieces}</div>;
}

// ── Main component ────────────────────────────────────────────
export function TerritoryVictory({ data, onClose }: Props) {
  const {
    isNew, tierChanged, tierName, territoryName,
    color, themeGrad, emblem, runDist, runDur,
    earnedPoints, totalRuns, activityType,
  } = data;

  const EmblemIcon = EMBLEMS[emblem] ?? Star;
  const ActIcon    = ACT_ICONS[activityType];

  const steps      = fmtSteps(runDist, activityType);
  const stepsNum   = steps ? parseInt(steps.replace('k', '')) * (steps.includes('k') ? 1000 : 1) : 0;

  const dispPoints = useCountUp(earnedPoints, 900, 400);
  const dispSteps  = useCountUp(stepsNum,     900, 600);

  // Auto-dismiss progress bar
  const AUTO_DISMISS = 7000;
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS) * 100);
      setProgress(pct);
      if (pct <= 0) { clearInterval(timerRef.current!); onClose(); }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [onClose]);

  const headline = isNew
    ? 'TERRITORY CLAIMED!'
    : tierChanged
      ? `TIER UP — ${tierName}!`
      : 'TERRITORY REINFORCED!';

  const subtitle = isNew
    ? 'You just carved your mark on the map 🏴'
    : tierChanged
      ? 'Your walls grow stronger with every grind ⚡'
      : `${totalRuns} grinds strong — keep it locked 💪`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Confetti color={color} />

      <div
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className={styles.header} style={{ background: themeGrad }}>
          <div className={styles.emblemRing} style={{ borderColor: `${color}60`, boxShadow: `0 0 20px ${color}55` }}>
            <EmblemIcon size={30} color="#ffffff" strokeWidth={1.8} />
          </div>
          <p className={styles.headline}>{headline}</p>
          <h2 className={styles.territoryName}>{territoryName}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statVal}>{fmtDist(runDist)}</span>
            <span className={styles.statLbl}>Distance</span>
          </div>
          {steps && (
            <div className={styles.statBox}>
              <span className={styles.statVal}>
                {dispSteps >= 1000 ? `${(dispSteps / 1000).toFixed(1)}k` : dispSteps}
              </span>
              <span className={styles.statLbl}>Steps</span>
            </div>
          )}
          <div className={styles.statBox} style={{ color }}>
            <span className={styles.statVal} style={{ color }}>
              +{dispPoints.toLocaleString()}
            </span>
            <span className={styles.statLbl}>XP</span>
          </div>
        </div>

        {/* Tier + run count */}
        <div className={styles.metaRow}>
          <span className={styles.tierPill} style={{ color, background: `${color}18`, borderColor: `${color}40` }}>
            {tierName}
          </span>
          <span className={styles.runCount}>
            <ActIcon size={12} strokeWidth={2.5} />
            {totalRuns} run{totalRuns !== 1 ? 's' : ''} total
          </span>
        </div>

        {/* Auto-dismiss bar + button */}
        <div className={styles.footer}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%`, background: color }} />
          </div>
          <button className={styles.closeBtn} style={{ background: themeGrad }} onClick={onClose}>
            Let's go! 🙌
          </button>
        </div>
      </div>
    </div>
  );
}
