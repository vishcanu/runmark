import React, { useState, useMemo, useRef } from 'react';
import {
  Ruler, Clock, Repeat2, Check, X, Trash2, AlertTriangle, Share2,
  Shield, Zap, Star, Crown, Flag, Target, Flame, Trophy, Gem, Anchor, Mountain, Crosshair,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TurfShareCard } from './TurfShareCard';
import { getMapInstance } from '../../map/mapSingleton';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import type { Territory } from '../../../types';
import styles from './TerritoryDetails.module.css';

// ── Themes — premium curated gradients ───────────────────────
// Paired by mood. Each solid `color` is the map wall tone.
const THEMES = [
  // Blues
  { id: 'azure',    name: 'Azure',    grad: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', color: '#2563eb' },
  { id: 'arctic',   name: 'Arctic',   grad: 'linear-gradient(135deg,#e0f2fe,#0369a1)', color: '#0284c7' },
  // Teals
  { id: 'lagoon',   name: 'Lagoon',   grad: 'linear-gradient(135deg,#2dd4bf,#0f766e)', color: '#0d9488' },
  { id: 'abyss',    name: 'Abyss',    grad: 'linear-gradient(135deg,#38bdf8,#164e63)', color: '#0891b2' },
  // Greens
  { id: 'emerald',  name: 'Emerald',  grad: 'linear-gradient(135deg,#34d399,#065f46)', color: '#059669' },
  { id: 'moss',     name: 'Moss',     grad: 'linear-gradient(135deg,#a3e635,#3f6212)', color: '#65a30d' },
  // Warm
  { id: 'ember',    name: 'Ember',    grad: 'linear-gradient(135deg,#fbbf24,#b45309)', color: '#d97706' },
  { id: 'inferno',  name: 'Inferno',  grad: 'linear-gradient(135deg,#f97316,#7f1d1d)', color: '#ea580c' },
  // Purples
  { id: 'nebula',   name: 'Nebula',   grad: 'linear-gradient(135deg,#a78bfa,#4c1d95)', color: '#7c3aed' },
  { id: 'aurora',   name: 'Aurora',   grad: 'linear-gradient(135deg,#f0abfc,#6b21a8)', color: '#a21caf' },
  // Pinks
  { id: 'sakura',   name: 'Sakura',   grad: 'linear-gradient(135deg,#fda4af,#9f1239)', color: '#e11d48' },
  { id: 'rose',     name: 'Rose',     grad: 'linear-gradient(135deg,#fb7185,#881337)', color: '#f43f5e' },
  // Prestige
  { id: 'onyx',     name: 'Onyx',     grad: 'linear-gradient(135deg,#475569,#0f172a)', color: '#334155' },
  { id: 'gold',     name: 'Gold',     grad: 'linear-gradient(135deg,#fde68a,#92400e)', color: '#b45309' },
  // Special
  { id: 'prism',    name: 'Prism',    grad: 'linear-gradient(135deg,#818cf8,#06b6d4)', color: '#6366f1' },
  { id: 'dusk',     name: 'Dusk',     grad: 'linear-gradient(135deg,#fb923c,#7c3aed)', color: '#9333ea' },
];

// ── Emblem icons ──────────────────────────────────────────────
const EMBLEMS: Array<{ id: string; Icon: React.ElementType }> = [
  { id: 'shield',    Icon: Shield    },
  { id: 'crown',     Icon: Crown     },
  { id: 'zap',       Icon: Zap       },
  { id: 'star',      Icon: Star      },
  { id: 'flame',     Icon: Flame     },
  { id: 'trophy',    Icon: Trophy    },
  { id: 'target',    Icon: Target    },
  { id: 'flag',      Icon: Flag      },
  { id: 'gem',       Icon: Gem       },
  { id: 'anchor',    Icon: Anchor    },
  { id: 'mountain',  Icon: Mountain  },
  { id: 'crosshair', Icon: Crosshair },
];

function getTheme(id?: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
function getEmblem(id?: string) {
  return EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];
}

// ── Territory decay helpers ───────────────────────────────────
const MS_PER_DAY = 86_400_000;

function daysSince(ts: number) {
  return (Date.now() - ts) / MS_PER_DAY;
}

function healthPct(lastRunAt: number): number {
  const days = daysSince(lastRunAt);
  return Math.max(0, Math.min(100, Math.round((1 - days * 0.082) * 100)));
}

function healthLabel(pct: number): { label: string; color: string; urgent: boolean } {
  if (pct >= 80) return { label: 'Fully powered',      color: '#22c55e', urgent: false };
  if (pct >= 60) return { label: 'Holding strong',     color: '#84cc16', urgent: false };
  if (pct >= 40) return { label: 'Walls weakening…',   color: '#f59e0b', urgent: false };
  if (pct >= 20) return { label: 'Critical — run now', color: '#ef4444', urgent: true  };
  return              { label: 'Almost lost!',          color: '#dc2626', urgent: true  };
}

function daysUntilLost(lastRunAt: number): number {
  const days = daysSince(lastRunAt);
  return Math.max(0, Math.ceil((1 - 0.35) / 0.082 - days));
}

interface TerritoryDetailsProps {
  territory: Territory;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Territory>) => void;
}

export function TerritoryDetails({ territory, onDelete, onUpdate }: TerritoryDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [draftName,    setDraftName]    = useState(territory.name);
  const [draftTagline, setDraftTagline] = useState(territory.tagline ?? '');
  const [draftTheme,   setDraftTheme]   = useState(territory.theme   ?? 'cobalt');
  const [draftEmblem,  setDraftEmblem]  = useState(territory.emblem  ?? 'shield');
  const [isSharing, setIsSharing] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  async function handleShare() {
    if (isSharing) return;
    setIsSharing(true);
    let snapshot: string | null = null;
    try {
      // ── Step 1: capture real 3D map if available ──────────────
      const map = getMapInstance();
      if (map) {
        const lngs = territory.coordinates.map((c) => c[0]);
        const lats  = territory.coordinates.map((c) => c[1]);
        const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
        const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
        const prevCenter  = map.getCenter();
        const prevZoom    = map.getZoom();
        const prevPitch   = map.getPitch();
        const prevBearing = map.getBearing();
        map.fitBounds([sw, ne], { padding: 70, pitch: 50, bearing: 0, animate: false, maxZoom: 18 });
        // Wait for tiles — 'idle' fires when all tiles loaded + no movement
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2500);
          map.once('idle', () => { clearTimeout(timeout); resolve(); });
        });
        try {
          snapshot = map.getCanvas().toDataURL('image/jpeg', 0.88);
        } catch { /* fallback to gradient */ }
        // Restore view
        map.jumpTo({ center: prevCenter, zoom: prevZoom, pitch: prevPitch, bearing: prevBearing });
      }

      // ── Step 2: render share card with snapshot ───────────────
      setMapSnapshot(snapshot);
      // Give React one frame to re-render TurfShareCard with new bg
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      if (!shareCardRef.current) return;
      const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 2, cacheBust: true });

      // ── Step 3: share or download ─────────────────────────────
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const safeName = territory.name.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const file = new File([blob], `${safeName}-turf.png`, { type: 'image/png' });
      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `${territory.name} — RunMark`,
          text: territory.tagline ?? 'Check out my turf on RunMark!',
          files: [file],
        });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${safeName}-turf.png`;
        a.click();
      }
    } catch (_err) {
      // user cancelled or share unsupported — silently ignore
    } finally {
      setIsSharing(false);
      setMapSnapshot(null);
    }
  }

  const theme = getTheme(territory.theme);
  const { Icon: EmblemIcon } = getEmblem(territory.emblem);
  const draftThemeObj = getTheme(draftTheme);

  // Health / decay
  const lastRun  = territory.lastRunAt ?? territory.createdAt;
  const hPct     = useMemo(() => healthPct(lastRun), [lastRun]);
  const hInfo    = useMemo(() => healthLabel(hPct),  [hPct]);
  const daysLeft = useMemo(() => daysUntilLost(lastRun), [lastRun]);

  function openEdit() {
    setDraftName(territory.name);
    setDraftTagline(territory.tagline ?? '');
    setDraftTheme(territory.theme ?? 'cobalt');
    setDraftEmblem(territory.emblem ?? 'shield');
    setEditing(true);
  }

  function handleSave() {
    const picked = getTheme(draftTheme);
    onUpdate(territory.id, {
      name:    draftName.trim() || territory.name,
      tagline: draftTagline.trim(),
      theme:   draftTheme,
      emblem:  draftEmblem,
      color:   picked.color,
    });
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  return (
    <div className={styles.container}>

      {/* ── Gradient header banner ── */}
      <div className={styles.banner} style={{ background: theme.grad }} />

      {/* ── Identity: emblem + name + tagline ── */}
      <div className={styles.identity}>
        <div className={styles.emblemBadge} style={{ background: theme.grad }}>
          <EmblemIcon size={26} strokeWidth={1.75} color="#ffffff" />
        </div>
        <div className={styles.identityText}>
          <h2 className={styles.name}>{territory.name}</h2>
          {territory.tagline && (
            <span className={styles.tagline}>"{territory.tagline}"</span>
          )}
          <span className={styles.date}>
            Claimed {new Date(territory.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
        {!editing && (
          <button className={styles.customizeBtn} onClick={openEdit}>
            Customize
          </button>
        )}
      </div>

      {/* ── Territory health meter ── */}
      <div className={styles.healthBlock}>
        <div className={styles.healthHeader}>
          <span className={styles.healthTitle}>Zone Strength</span>
          <span className={styles.healthPct} style={{ color: hInfo.color }}>{hPct}%</span>
        </div>
        <div className={styles.healthBarTrack}>
          <div
            className={styles.healthBarFill}
            style={{ width: `${hPct}%`, background: hInfo.color }}
          />
        </div>
        <div className={styles.healthFooter}>
          {hInfo.urgent && <AlertTriangle size={12} strokeWidth={2.5} style={{ color: hInfo.color, flexShrink: 0 }} />}
          <span className={styles.healthStatus} style={{ color: hInfo.color }}>{hInfo.label}</span>
          {daysLeft > 0 && !hInfo.urgent && (
            <span className={styles.healthDays}>Runs out in {daysLeft}d</span>
          )}
          {hInfo.urgent && daysLeft <= 2 && (
            <span className={styles.healthDays} style={{ color: hInfo.color }}>Only {daysLeft}d left!</span>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Ruler size={16} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <span className={styles.statValue}>{formatDistance(territory.distance)}</span>
          <span className={styles.statLabel}>Distance</span>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Clock size={16} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <span className={styles.statValue}>{formatDuration(territory.duration)}</span>
          <span className={styles.statLabel}>Duration</span>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Repeat2 size={16} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <span className={styles.statValue}>{territory.runs ?? 1}×</span>
          <span className={styles.statLabel}>Runs</span>
        </div>
      </div>

      {/* ── Edit panel ── */}
      {editing && (
        <div className={styles.editPanel}>

          {/* Name */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Zone Name</label>
            <input
              className={styles.textInput}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder="Name your territory"
            />
          </div>

          {/* Tagline */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              Tagline <span className={styles.optional}>— your zone motto</span>
            </label>
            <input
              className={styles.textInput}
              value={draftTagline}
              onChange={(e) => setDraftTagline(e.target.value)}
              maxLength={36}
              placeholder='e.g. "Speed zone. No entry."'
            />
          </div>

          {/* Theme swatches */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Zone Theme</label>
            <div className={styles.themeGrid}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={[styles.themeSwatch, draftTheme === t.id ? styles.themeActive : ''].join(' ')}
                  style={{ background: t.grad }}
                  onClick={() => setDraftTheme(t.id)}
                  title={t.name}
                >
                  <span className={styles.themeLabel}>{t.name}</span>
                  {draftTheme === t.id && (
                    <span className={styles.themeCheck}><Check size={11} strokeWidth={3} /></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Emblem picker */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Zone Emblem</label>
            <div className={styles.emblemGrid}>
              {EMBLEMS.map(({ id, Icon }) => (
                <button
                  key={id}
                  className={[styles.emblemBtn, draftEmblem === id ? styles.emblemActive : ''].join(' ')}
                  style={draftEmblem === id ? { background: draftThemeObj.grad, borderColor: 'transparent' } : {}}
                  onClick={() => setDraftEmblem(id)}
                  title={id}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.75}
                    color={draftEmblem === id ? '#ffffff' : undefined}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Live preview strip */}
          <div className={styles.previewStrip} style={{ background: draftThemeObj.grad }}>
            <div className={styles.previewEmblem}>
              {(() => { const { Icon: PI } = getEmblem(draftEmblem); return <PI size={18} strokeWidth={1.75} color="#fff" />; })()}
            </div>
            <span className={styles.previewName}>{draftName || 'Zone Name'}</span>
            {draftTagline && <span className={styles.previewTagline}>"{draftTagline}"</span>}
          </div>

          {/* Actions */}
          <div className={styles.editActions}>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              <X size={15} strokeWidth={2.5} />
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              style={{ background: draftThemeObj.grad }}
              onClick={handleSave}
            >
              <Check size={15} strokeWidth={2.5} />
              Save Zone
            </button>
          </div>
        </div>
      )}

      {/* ── Share + Delete ── */}
      {!editing && (
        <div className={styles.bottomActions}>
          <button
            className={styles.shareBtn}
            onClick={handleShare}
            disabled={isSharing}
            style={{ background: theme.grad }}
          >
            <Share2 size={15} strokeWidth={2.5} />
            {isSharing ? 'Generating…' : 'Share Turf'}
          </button>
          <button
            className={styles.deleteBtn}
            onClick={() => onDelete(territory.id)}
          >
            <Trash2 size={14} strokeWidth={2} />
            Delete Territory
          </button>
        </div>
      )}

      {/* Off-screen share card — always in DOM for instant capture */}
      <div style={{ position: 'fixed', top: 0, left: '-600px', pointerEvents: 'none', zIndex: -1 }}>
        <TurfShareCard ref={shareCardRef} territory={territory} mapSnapshot={mapSnapshot} />
      </div>
    </div>
  );
}
