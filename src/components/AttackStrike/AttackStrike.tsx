import { useRef, useCallback, useState } from 'react';
import { Flame, Wind, Mountain, Waves, Zap, Share2, X, Shield, Clock, User, Swords } from 'lucide-react';
import type { AttackType } from '../../types';
import styles from './AttackStrike.module.css';

// ── Config per attack type ─────────────────────────────────────
const CFG: Record<AttackType, {
  Icon:     typeof Flame;
  label:    string;
  color:    string;
  accent:   string;
  tint:     string;
  effect:   string;
  duration: string;
  emoji:    string;   // used on canvas share card
}> = {
  inferno: { Icon: Flame,    label: 'Blaze', color: '#ef4444', accent: '#dc2626', tint: '#fef2f2', effect: 'Walls shrink 60%',        duration: '24 hours',  emoji: '🔥' },
  cyclone: { Icon: Wind,     label: 'Whirl', color: '#8b5cf6', accent: '#7c3aed', tint: '#f5f3ff', effect: 'Owner locked out',        duration: '12 hours',  emoji: '🌀' },
  tremor:  { Icon: Mountain, label: 'Quake', color: '#d97706', accent: '#b45309', tint: '#fffbeb', effect: 'Collapses to Tier 1',     duration: 'Permanent', emoji: '⛰️' },
  deluge:  { Icon: Waves,    label: 'Seep',  color: '#0ea5e9', accent: '#0284c7', tint: '#f0f9ff', effect: 'Decay rate ×3',           duration: '48 hours',  emoji: '🌊' },
  vortex:  { Icon: Zap,      label: 'Rift',  color: '#7c3aed', accent: '#6d28d9', tint: '#f5f3ff', effect: 'Full unclaim — open turf', duration: '2 hours',   emoji: '⚡' },
};

// ── Floating particle data (computed once) ─────────────────────
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  id:       i,
  left:     `${4 + ((i * 13.7 + 3) % 92)}%`,
  size:     2 + (i % 4),
  delay:    `${((i * 0.27) % 2.4).toFixed(2)}s`,
  duration: `${(2.2 + (i * 0.38) % 1.8).toFixed(2)}s`,
}));

// ── Canvas share card ──────────────────────────────────────────
function buildShareCanvas(
  type: AttackType,
  targetName: string,
  ownerName: string,
  attackerName: string,
): HTMLCanvasElement {
  const cfg = CFG[type];
  const W = 1080;
  const H = 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0b14'); bg.addColorStop(1, '#14101e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Attack-color radial glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.37, 0, W / 2, H * 0.37, 500);
  glow.addColorStop(0, cfg.color + '60');
  glow.addColorStop(0.5, cfg.color + '20');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // Dot grid texture
  ctx.fillStyle = 'rgba(255,255,255,0.022)';
  for (let x = 50; x < W; x += 50) {
    for (let y = 50; y < H; y += 50) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Top accent line + branding
  ctx.beginPath(); ctx.moveTo(W / 2 - 48, 58); ctx.lineTo(W / 2 + 48, 58);
  ctx.strokeStyle = cfg.color + 'cc'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font = '600 22px -apple-system,BlinkMacSystemFont,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('T U R F   R U N', W / 2, 90);

  // Icon circle
  const cx = W / 2, cy = H * 0.365, R = 148;

  // Outer diffuse halo
  ctx.beginPath(); ctx.arc(cx, cy, R + 56, 0, Math.PI * 2);
  ctx.strokeStyle = cfg.color + '20'; ctx.lineWidth = 28; ctx.stroke();

  // Mid ring
  ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
  ctx.strokeStyle = cfg.color + '45'; ctx.lineWidth = 2.5; ctx.stroke();

  // Circle fill
  const fill = ctx.createRadialGradient(cx - 35, cy - 45, 0, cx, cy, R);
  fill.addColorStop(0, cfg.color + '50'); fill.addColorStop(1, cfg.color + '18');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();

  // Circle border
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = cfg.color; ctx.lineWidth = 3; ctx.stroke();

  // Attack emoji
  ctx.font = '88px serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.emoji, cx, cy);

  // "SIEGE LAUNCHED"
  const labelY = cy + R + 54;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = '600 20px -apple-system,sans-serif';
  ctx.fillText('S I E G E   L A U N C H E D', cx, labelY);

  // Attack name (large)
  ctx.fillStyle = cfg.color;
  ctx.font = '900 92px -apple-system,sans-serif';
  ctx.fillText(cfg.label.toUpperCase(), cx, labelY + 98);

  // Divider
  const divY = labelY + 126;
  ctx.beginPath(); ctx.moveTo(cx - 72, divY); ctx.lineTo(cx + 72, divY);
  ctx.strokeStyle = cfg.color + '80'; ctx.lineWidth = 2; ctx.stroke();

  // Territory name (auto-fit)
  let nameFs = 54;
  ctx.font = `700 ${nameFs}px -apple-system,sans-serif`;
  while (ctx.measureText(targetName).width > W - 140 && nameFs > 30) {
    nameFs -= 4;
    ctx.font = `700 ${nameFs}px -apple-system,sans-serif`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(targetName, cx, divY + 76);

  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.font = '400 28px -apple-system,sans-serif';
  ctx.fillText(`owned by ${ownerName}`, cx, divY + 122);

  // Effect pill
  ctx.font = '500 22px -apple-system,sans-serif';
  const pillTxt = `${cfg.effect}  ·  ${cfg.duration}`;
  const pillW   = ctx.measureText(pillTxt).width + 56;
  const pillX   = cx - pillW / 2;
  const pillY   = divY + 158;
  ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, 46, 23);
  ctx.fillStyle = cfg.color + '22'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, 46, 23);
  ctx.strokeStyle = cfg.color + '55'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = cfg.color;
  ctx.textBaseline = 'middle';
  ctx.fillText(pillTxt, cx, pillY + 23);

  // Bottom strip
  const stripY = H - 90;
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, stripY, W, 90);
  ctx.beginPath(); ctx.moveTo(0, stripY); ctx.lineTo(W, stripY);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = '500 22px -apple-system,sans-serif';
  ctx.fillText(`Launched by ${attackerName}  ·  24h to defend  ·  ${now}`, cx, H - 32);

  // Defense bar
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, H - 10, W, 10);
  ctx.fillStyle = cfg.color; ctx.fillRect(0, H - 10, W * 0.97, 10);

  return c;
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  type:         AttackType;
  targetName:   string;
  ownerName:    string;
  attackerName: string;
  onClose:      () => void;
}

export function AttackStrike({ type, targetName, ownerName, attackerName, onClose }: Props) {
  const cfg                     = CFG[type];
  const dragStart               = useRef<number | null>(null);
  const [sharing, setSharing]   = useState(false);
  const [copied,  setCopied]    = useState(false);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const canvas = buildShareCanvas(type, targetName, ownerName, attackerName);
      const blob   = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 0.95));
      if (!blob) return;
      const file = new File([blob], 'siege-launched.png', { type: 'image/png' });

      // Prefer native share with image (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Siege Launched!',
          text:  `I launched a ${cfg.label} siege on "${targetName}" in Turf Run!`,
        });
      } else if (navigator.share) {
        // Share without image (some browsers)
        await navigator.share({
          title: 'Siege Launched!',
          text:  `I launched a ${cfg.label} siege on "${targetName}" owned by ${ownerName} in Turf Run! They have 24h to defend.`,
        });
      } else {
        // Desktop fallback: download image
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: 'siege.png' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* user cancelled or error */ }
    finally { setSharing(false); }
  }, [type, targetName, ownerName, attackerName, cfg.label, sharing]);

  const handleTouchStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientY; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
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
          style={{ background: `linear-gradient(160deg, ${cfg.tint} 0%, #ffffff 60%)` }}
        >
          {/* Floating particles */}
          {PARTICLES.map(p => (
            <span
              key={p.id}
              className={styles.particle}
              style={{
                left:              p.left,
                width:             p.size,
                height:            p.size,
                background:        cfg.color,
                animationDelay:    p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}

          <button className={styles.closeBtnTop} onClick={onClose} aria-label="Close">
            <X size={17} strokeWidth={2.5} />
          </button>

          <div
            className={styles.iconWrap}
            style={{
              background: `${cfg.color}12`,
              borderColor: `${cfg.color}28`,
              boxShadow: `0 0 0 8px ${cfg.color}0e, 0 0 48px ${cfg.color}28`,
            }}
          >
            <cfg.Icon size={52} strokeWidth={1.75} style={{ color: cfg.color }} />
          </div>

          <span className={styles.siegeLabel} style={{ color: cfg.accent }}>Siege Launched</span>
          <h1 className={styles.attackName} style={{ color: cfg.accent }}>{cfg.label}</h1>

          <span
            className={styles.effectPill}
            style={{ background: `${cfg.color}12`, borderColor: `${cfg.color}35`, color: cfg.accent }}
          >
            {cfg.effect}
          </span>
        </div>

        {/* ── Detail rows ── */}
        <div className={styles.body}>

          <div className={styles.detailRow} style={{ animationDelay: '0.50s' }}>
            <div className={styles.detailIcon} style={{ background: `${cfg.color}10` }}>
              <Shield size={14} strokeWidth={2} style={{ color: cfg.color }} />
            </div>
            <div className={styles.detailText}>
              <span className={styles.detailLabel}>Territory</span>
              <span className={styles.detailValue}>{targetName}</span>
            </div>
          </div>

          <div className={styles.rowDivider} />

          <div className={styles.detailRow} style={{ animationDelay: '0.60s' }}>
            <div className={styles.detailIcon} style={{ background: '#f4f4f5' }}>
              <User size={14} strokeWidth={2} style={{ color: '#71717a' }} />
            </div>
            <div className={styles.detailText}>
              <span className={styles.detailLabel}>Defending</span>
              <span className={styles.detailValue}>{ownerName}</span>
            </div>
          </div>

          <div className={styles.rowDivider} />

          <div className={styles.detailRow} style={{ animationDelay: '0.70s' }}>
            <div className={styles.detailIcon} style={{ background: `${cfg.color}10` }}>
              <Swords size={14} strokeWidth={2} style={{ color: cfg.color }} />
            </div>
            <div className={styles.detailText}>
              <span className={styles.detailLabel}>Attacker</span>
              <span className={styles.detailValue}>{attackerName}</span>
            </div>
          </div>

          <div className={styles.rowDivider} />

          <div className={styles.detailRow} style={{ animationDelay: '0.80s' }}>
            <div className={styles.detailIcon} style={{ background: '#f4f4f5' }}>
              <Clock size={14} strokeWidth={2} style={{ color: '#71717a' }} />
            </div>
            <div className={styles.detailText}>
              <span className={styles.detailLabel}>Effect Duration</span>
              <span className={styles.detailValue}>{cfg.duration}</span>
            </div>
          </div>

          {/* Defense window */}
          <div className={styles.defenseBox} style={{ animationDelay: '0.92s', borderColor: `${cfg.color}20`, background: `${cfg.color}06` }}>
            <div className={styles.defenseHeader}>
              <span className={styles.defenseTitle}>Defense Window</span>
              <span className={styles.defenseTimer} style={{ color: cfg.accent }}>24 hours</span>
            </div>
            <div className={styles.defenseTrack}>
              <div
                className={styles.defenseBarFill}
                style={{ background: `linear-gradient(90deg, ${cfg.color}aa, ${cfg.color})` }}
              />
            </div>
            <p className={styles.defenseHint}>
              {ownerName} can cancel this siege by completing a run within 24 hours
            </p>
          </div>

        </div>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button
            className={[styles.shareBtn, sharing ? styles.shareBtnBusy : ''].filter(Boolean).join(' ')}
            onClick={handleShare}
            disabled={sharing}
            style={{ color: cfg.accent, borderColor: `${cfg.color}35`, background: `${cfg.color}08` }}
          >
            <Share2 size={15} strokeWidth={2} />
            {sharing ? 'Saving…' : copied ? 'Saved' : 'Share'}
          </button>
          <button className={styles.doneBtn} onClick={onClose}>Done</button>
        </div>

      </div>
    </div>
  );
}
