import React, { useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Ruler, Clock, Repeat2, Check, X, Trash2, AlertTriangle, Share2,
  Shield, Zap, Star, Crown, Flag, Target, Flame, Trophy, Gem, Anchor, Mountain, Crosshair,
  HardHat,
} from 'lucide-react';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import { getTierInfo, nextTierAt } from '../utils/territoryTier';
import { getConstructionLevel, nextConstructionLevel, BUILDING_DEFS, availableBuildings } from '../../building/buildingCatalog';
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

// ── Canvas share-card composition helpers ─────────────────────
// Bypasses html-to-image / DOM capture entirely — works 100% reliably
const _CARD_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

function _rRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _gradColors(grad: string): [string, string] {
  const m = grad.match(/#[0-9a-fA-F]{6}/g);
  return m && m.length >= 2 ? [m[0], m[1]] : ['#2563eb', '#1d4ed8'];
}

function _dist(m: number): string {
  if (!m || isNaN(m)) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

function _steps(m: number): string {
  if (!m || isNaN(m)) return '—';
  const s = Math.round(m / 0.78); // avg stride ≈ 78 cm
  return s >= 1000 ? `${(s / 1000).toFixed(1)}k` : `${s}`;
}

// ── Share-card: offscreen MapLibre approach ──────────────────
// Strategy: spin up a hidden 720×1280 MapLibre map with a pure
// CARTO raster style (no sprites, no glyphs).  MapLibre loads
// tiles with crossOrigin='anonymous'; CARTO returns
// Access-Control-Allow-Origin:*.  Result: the WebGL canvas is
// NOT origin-dirty → drawImage(glCanvas) on a 2D canvas also
// does NOT taint it → toDataURL() works on every device.
//
// The territory polygon is added as a native GeoJSON layer so it
// renders together with the tiles in one GL pass.
// Then we composite the text panel on top via Canvas 2D.

async function buildShareCard(
  territory: Territory,
  themeGrad: string,
): Promise<string> {
  const W = 720, H = 1280;
  const PANEL_H = 370;
  const [c1, c2] = _gradColors(themeGrad);
  const tier = getTierInfo(territory.runs ?? 1);
  const isCorridor = territory.shape === 'corridor';
  const coords = territory.coordinates as [number, number][];
  const lngs = coords.map(c => c[0]);
  const lats  = coords.map(c => c[1]);

  // Destination canvas
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Step 1: render real map + territory in an offscreen GL map ──
  const mapOk = await new Promise<boolean>((resolve) => {
    const container = document.createElement('div');
    // NOTE: do NOT use visibility:hidden — it kills WebGL rendering on
    // Safari/WebKit. Use opacity:0 + off-screen left instead.
    container.style.cssText = [
      'position:fixed',
      `left:-${W + 50}px`,
      'top:0',
      `width:${W}px`,
      `height:${H}px`,
      'overflow:hidden',
      'pointer-events:none',
      'opacity:0',
    ].join(';');
    document.body.appendChild(container);

    let cleaned = false;
    // eslint-disable-next-line prefer-const
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timeoutId);
      try { map.remove(); } catch { /* ignore */ }
      try { document.body.removeChild(container); } catch { /* ignore */ }
    };

    timeoutId = setTimeout(() => { cleanup(); resolve(false); }, 14000);

    const map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      canvasContextAttributes: { preserveDrawingBuffer: true },
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,   // no fade-in — tiles appear immediately
    });

    map.once('load', () => {
      // Territory polygon fill + stroke as native GL layers
      map.addSource('t', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {},
        },
      });
      map.addLayer({
        id: 't-fill',
        type: 'fill',
        source: 't',
        paint: { 'fill-color': c1, 'fill-opacity': 0.42 },
      });
      map.addLayer({
        id: 't-stroke',
        type: 'line',
        source: 't',
        paint: { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.92 },
      });

      // Corridor centre-line dash
      if (isCorridor && territory.rawPath && (territory.rawPath as [number, number][]).length >= 2) {
        map.addSource('rp', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: territory.rawPath as [number, number][] },
            properties: {},
          },
        });
        map.addLayer({
          id: 'rp-dash',
          type: 'line',
          source: 'rp',
          paint: {
            'line-color': '#ffffff',
            'line-width': 2.5,
            'line-opacity': 0.75,
            'line-dasharray': [3, 4],
          },
        });
      }

      // Fit bounds — leave bottom PANEL_H + gutter for the info panel
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 80, bottom: PANEL_H + 100, left: 70, right: 70 }, animate: false },
      );

      // 'idle' fires once all tiles are loaded and the GL frame is rendered.
      // We then wait one rAF to guarantee the frame is committed to the
      // WebGL drawing buffer before we read it back.
      map.once('idle', () => {
        requestAnimationFrame(() => {
          try {
            // canvas→canvas: untainted GL canvas → untainted 2D canvas → toDataURL works
            ctx.drawImage(map.getCanvas(), 0, 0, W, H);
            cleanup();
            resolve(true);
          } catch {
            cleanup();
            resolve(false);
          }
        });
      });
    });

    map.on('error', () => { cleanup(); resolve(false); });
  });

  // ── Step 2: fallback if map failed ───────────────────────────
  if (!mapOk) {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, c1 + '55');
    bgGrad.addColorStop(1, c2 + '33');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    // Draw territory as plain polygon
    if (coords.length >= 3) {
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const lngSpan = maxLng - minLng || 0.001;
      const latSpan = maxLat - minLat || 0.001;
      const scale = Math.min(520 / lngSpan, (isCorridor ? 280 : 460) / latSpan) * 0.8;
      const ox = W / 2 - (lngSpan * scale) / 2;
      const oy = (H - PANEL_H) / 2 - (latSpan * scale) / 2;
      const toX = (lng: number) => ox + (lng - minLng) * scale;
      const toY = (lat: number) => oy + (maxLat - lat) * scale;
      ctx.beginPath();
      coords.forEach(([lng, lat], i) => {
        if (i === 0) ctx.moveTo(toX(lng), toY(lat));
        else         ctx.lineTo(toX(lng), toY(lat));
      });
      ctx.closePath();
      const fg = ctx.createLinearGradient(0, 0, W, H);
      fg.addColorStop(0, c1 + '88'); fg.addColorStop(1, c2 + '66');
      ctx.fillStyle = fg; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.9; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else {
    // Light darkening tint so text panel reads well against the map
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, W, H);
  }

  // ── Step 3: scrim over bottom panel area ─────────────────────
  const scrimTop = H - PANEL_H - 80;
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, H);
  scrim.addColorStop(0,    'rgba(0,0,0,0)');
  scrim.addColorStop(0.25, 'rgba(0,0,0,0.60)');
  scrim.addColorStop(1,    'rgba(0,0,0,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);

  // ── Step 4: info panel ────────────────────────────────────────
  const panelY = H - PANEL_H;
  ctx.save();
  _rRect(ctx, 24, panelY - 4, W - 48, PANEL_H - 8, 28);
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Territory name
  ctx.font = `800 58px ${_CARD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  let zoneName = territory.name;
  while (ctx.measureText(zoneName).width > W - 100 && zoneName.length > 1)
    zoneName = zoneName.slice(0, -1);
  if (zoneName !== territory.name) zoneName += '\u2026';
  ctx.fillText(zoneName, W / 2, panelY + 60);
  ctx.shadowBlur = 0;

  // Tier + corridor badges
  ctx.font = `700 19px ${_CARD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const badges: Array<{ text: string; color: string }> = [
    { text: tier.name, color: tier.uiColor },
    ...(isCorridor ? [{ text: '⟶ ROAD CLAIM', color: '#fbbf24' }] : []),
  ];
  const totalBadgeW = badges.reduce((sum, b, i) => {
    ctx.font = `700 19px ${_CARD_FONT}`;
    return sum + ctx.measureText(b.text).width + 36 + (i < badges.length - 1 ? 10 : 0);
  }, 0);
  let bx = W / 2 - totalBadgeW / 2;
  const badgeY = panelY + 82;
  for (const b of badges) {
    ctx.font = `700 19px ${_CARD_FONT}`;
    const bw = ctx.measureText(b.text).width + 36;
    ctx.save();
    _rRect(ctx, bx, badgeY, bw, 28, 14);
    ctx.fillStyle = b.color + '28';
    ctx.fill();
    ctx.strokeStyle = b.color + '80';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, bx + bw / 2, badgeY + 14);
    bx += bw + 10;
  }

  // Tagline (optional)
  if (territory.tagline) {
    ctx.font = `italic 25px ${_CARD_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let tl = `"${territory.tagline}"`;
    while (ctx.measureText(tl).width > W - 120 && tl.length > 3)
      tl = tl.slice(0, -2) + '"';
    ctx.fillText(tl, W / 2, panelY + 130);
  }

  // Stats row
  const statsY = territory.tagline ? panelY + 152 : panelY + 132;
  const stats = [
    { val: _steps(territory.distance), key: 'STEPS'    },
    { val: `${territory.runs ?? 1}×`,  key: 'GRINDS'   },
    { val: _dist(territory.distance),  key: 'DISTANCE' },
  ];
  const colW = (W - 48) / 3;
  stats.forEach((s, i) => {
    const cx = 24 + colW * i + colW / 2;
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(24 + colW * i - 1, statsY, 2, 96);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let vSize = 42;
    ctx.font = `800 ${vSize}px ${_CARD_FONT}`;
    while (ctx.measureText(s.val).width > colW - 14 && vSize > 22) {
      vSize -= 2;
      ctx.font = `800 ${vSize}px ${_CARD_FONT}`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.val, cx, statsY + 50);
    ctx.font = `600 17px ${_CARD_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.48)';
    ctx.fillText(s.key, cx, statsY + 76);
  });

  // Brand watermark
  ctx.font = `700 19px ${_CARD_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('RUNMARK', W / 2, panelY + PANEL_H - 18);

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────

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

  async function handleShare() {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const dataUrl = await buildShareCard(territory, theme.grad);

      // Share or download
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
          title: `${territory.name} \u2014 RunMark`,
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
      // user cancelled or share unsupported \u2014 silently ignore
    } finally {
      setIsSharing(false);
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

  // Imprint tier
  const tier     = getTierInfo(territory.runs ?? 1);
  const nextAt   = nextTierAt(territory.runs ?? 1);
  const runsLeft = nextAt !== null ? nextAt - (territory.runs ?? 1) : null;

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

      {/* ── IMPRINT tier badge ── */}
      <div className={styles.tierRow}>
        <span className={styles.tierBadge} style={{ color: tier.uiColor, borderColor: `${tier.uiColor}55`, background: `${tier.uiColor}18` }}>
          {tier.name}
        </span>
        {territory.shape === 'corridor' && (
          <span className={styles.corridorBadge}>⟶ ROAD CLAIM</span>
        )}
        {territory.shape !== 'corridor' && (runsLeft !== null ? (
          <span className={styles.tierHint}>{runsLeft} more grind{runsLeft !== 1 ? 's' : ''} to unlock next tier</span>
        ) : (
          <span className={styles.tierHint} style={{ color: tier.uiColor }}>Max tier unlocked ★</span>
        ))}
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

      {/* ── Construction panel ── */}
      {!editing && (() => {
        const runs     = territory.runs ?? 1;
        const level    = getConstructionLevel(runs);
        const nextLvl  = nextConstructionLevel(runs);
        const runsLeft = nextLvl ? nextLvl.minRuns - runs : 0;
        const unlocked = availableBuildings(runs);
        const chosen   = territory.buildingType;
        const chosenDef = chosen ? BUILDING_DEFS[chosen] : null;

        return (
          <div className={styles.constructionSection}>
            {/* Level header */}
            <div className={styles.constructionHeader}>
              <HardHat size={14} strokeWidth={2} style={{ color: territory.color }} />
              <span className={styles.constructionTitle}>Construction</span>
              <span className={styles.constructionLevelBadge} style={{ borderColor: territory.color + '60', color: territory.color }}>
                {level.emoji} {level.name}
              </span>
            </div>

            <p className={styles.constructionDesc}>{level.description}</p>

            {/* Progress bar to next level */}
            {nextLvl && (
              <div className={styles.constructionProgress}>
                <div
                  className={styles.constructionBar}
                  style={{
                    width: `${Math.round(((runs - level.minRuns) / (nextLvl.minRuns - level.minRuns)) * 100)}%`,
                    background: territory.color,
                  }}
                />
                <span className={styles.constructionProgressLabel}>
                  {runsLeft} run{runsLeft !== 1 ? 's' : ''} to {nextLvl.emoji} {nextLvl.name}
                </span>
              </div>
            )}

            {/* Building type — show picker if unlocked but not chosen */}
            {unlocked.length > 0 && !chosen && (
              <div className={styles.buildPickerSection}>
                <p className={styles.buildPickerPrompt}>🏗 Choose what to build on your land:</p>
                <div className={styles.buildPicker}>
                  {unlocked.map((type) => {
                    const def = BUILDING_DEFS[type];
                    return (
                      <button
                        key={type}
                        className={styles.buildOption}
                        style={{ borderColor: def.color + '55' }}
                        onClick={() => onUpdate(territory.id, { buildingType: type })}
                      >
                        <span className={styles.buildIcon}>{def.icon}</span>
                        <span className={styles.buildName} style={{ color: def.color }}>{def.name}</span>
                        <span className={styles.buildEffect}>{def.effect}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chosen building — show what's built */}
            {chosenDef && (
              <div className={styles.builtBuilding} style={{ borderColor: chosenDef.color + '50', background: chosenDef.color + '10' }}>
                <span className={styles.builtIcon}>{chosenDef.icon}</span>
                <div className={styles.builtInfo}>
                  <span className={styles.builtName} style={{ color: chosenDef.color }}>{chosenDef.name}</span>
                  <span className={styles.builtTagline}>{chosenDef.tagline}</span>
                  <span className={styles.builtEffect}>{chosenDef.effect}</span>
                </div>
                <button
                  className={styles.builtChange}
                  onClick={() => onUpdate(territory.id, { buildingType: undefined })}
                  title="Change building"
                >
                  ↩
                </button>
              </div>
            )}

            {/* Runs < 2: encourage another run */}
            {runs < 2 && (
              <p className={styles.constructionNudge}>Run this territory again to lay your foundation.</p>
            )}
          </div>
        );
      })()}

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

    </div>
  );
}
