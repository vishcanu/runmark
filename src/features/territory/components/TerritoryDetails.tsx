import React, { useState, useMemo } from 'react';
import {
  Ruler, Clock, Repeat2, Check, X, Trash2, AlertTriangle, Share2,
  Shield, Zap, Star, Crown, Flag, Target, Flame, Trophy, Gem, Anchor, Mountain, Crosshair,
} from 'lucide-react';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import { getTierInfo, nextTierAt } from '../utils/territoryTier';
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

// ── CARTO dark-matter tile stitching ─────────────────────────
// Uses fetch() → base64 data URL so the output canvas is NEVER tainted.
// (img.crossOrigin='anonymous' still taints mobile WebView canvases;
//  a data: URL is treated as same-origin and is guaranteed safe.)

function _lngToFracTile(lng: number, z: number): number {
  return (lng + 180) / 360 * (1 << z);
}
function _latToFracTile(lat: number, z: number): number {
  const rad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * (1 << z);
}

/** Fetch a single tile and return as a base64 data URL (same-origin → no taint) */
async function _fetchTileDataUrl(url: string): Promise<string | null> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res   = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf   = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // chunked btoa — avoids stack-overflow on large tiles
    const CHUNK = 8192;
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
      parts.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
    }
    return `data:image/png;base64,${btoa(parts.join(''))}`;
  } catch {
    return null;
  }
}

async function fetchTileBg(
  coords: [number, number][],
  W: number,
  H: number,
): Promise<string | null> {
  try {
    const lngs = coords.map(c => c[0]);
    const lats  = coords.map(c => c[1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const cLng = (minLng + maxLng) / 2;
    const cLat = (minLat + maxLat) / 2;

    const span = Math.max((maxLng - minLng), (maxLat - minLat), 0.001);

    const TILE = 256;
    const targetPx = W * 0.50;
    const idealZ = Math.log2(targetPx * 360 / (TILE * span));
    const z = Math.max(10, Math.min(17, Math.floor(idealZ)));

    const fcx = _lngToFracTile(cLng, z);
    const fcy = _latToFracTile(cLat, z);

    const halfTW = W / 2 / TILE + 1;
    const halfTH = H / 2 / TILE + 1;
    const txStart = Math.floor(fcx - halfTW);
    const txEnd   = Math.ceil (fcx + halfTW);
    const tyStart = Math.floor(fcy - halfTH);
    const tyEnd   = Math.ceil (fcy + halfTH);

    const cols = txEnd - txStart;
    const rows = tyEnd - tyStart;
    if (cols * rows > 64) return null;

    // Fetch all tiles concurrently as base64 data URLs
    type TileResult = { dataUrl: string; col: number; row: number } | null;
    const jobs: Promise<TileResult>[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tx  = txStart + col;
        const ty  = tyStart + row;
        const sub = ['a','b','c','d'][Math.abs(tx + ty) % 4];
        const url = `https://${sub}.basemaps.cartocdn.com/dark_all/${z}/${tx}/${ty}.png`;
        const c   = col, r = row;
        jobs.push(_fetchTileDataUrl(url).then(dataUrl => dataUrl ? { dataUrl, col: c, row: r } : null));
      }
    }
    const tiles = await Promise.all(jobs);

    // Count successful tiles — if fewer than half loaded, bail out
    const loaded = tiles.filter(Boolean).length;
    if (loaded < cols * rows / 2) return null;

    // Load each data-URL into an Image, then composite onto canvas
    const imgJobs = tiles.map((t) =>
      !t ? Promise.resolve(null) :
      new Promise<{ img: HTMLImageElement; col: number; row: number } | null>((resolve) => {
        const img = new Image();
        img.onload  = () => resolve({ img, col: t.col, row: t.row });
        img.onerror = () => resolve(null);
        img.src = t.dataUrl; // data: URL — same-origin, never taints canvas
      })
    );
    const imgTiles = await Promise.all(imgJobs);

    const out  = document.createElement('canvas');
    out.width  = W;
    out.height = H;
    const oct  = out.getContext('2d')!;

    const offsetX = (fcx - txStart) * TILE - W / 2;
    const offsetY = (fcy - tyStart) * TILE - H / 2;
    for (const t of imgTiles) {
      if (!t) continue;
      oct.drawImage(t.img, t.col * TILE - offsetX, t.row * TILE - offsetY, TILE, TILE);
    }

    const result = out.toDataURL('image/jpeg', 0.88);
    return result.length > 10_000 ? result : null;
  } catch {
    return null;
  }
}

async function buildShareCard(
  mapJpeg: string | null,
  territory: Territory,
  themeGrad: string,
): Promise<string> {
  const W = 720, H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const [c1, c2] = _gradColors(themeGrad);
  const tier = getTierInfo(territory.runs ?? 1);
  const isCorridor = territory.shape === 'corridor';

  // ── LAYER 1: Background ──────────────────────────────────────
  // Always paint a theme gradient as base — never pure black
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, c1 + 'cc');  // 80% opacity
  bgGrad.addColorStop(1, c2 + '99');  // 60% opacity
  // Dark base first
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, W, H);
  // Theme colour wash
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // If map tiles loaded, paint them over with a blend so they show through
  const mapValid = !!mapJpeg && mapJpeg.length > 10_000;
  if (mapValid) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Only paint if the image actually has content (not all-black)
        ctx.save();
        ctx.globalAlpha = 0.45;           // map shows as subtle texture
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
        resolve();
      };
      img.onerror = () => resolve();
      img.src = mapJpeg!;
    });
  }

  // Dark vignette scrim — heavier at bottom for text legibility
  const scrim = ctx.createLinearGradient(0, 0, 0, H);
  scrim.addColorStop(0,    'rgba(0,0,0,0.35)');
  scrim.addColorStop(0.42, 'rgba(0,0,0,0.22)');
  scrim.addColorStop(0.62, 'rgba(0,0,0,0.65)');
  scrim.addColorStop(1,    'rgba(0,0,0,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 40; y < H; y += 72) {
    for (let x = 40; x < W; x += 72) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── LAYER 2: Territory shape — ALWAYS prominent ───────────────
  const coords = territory.coordinates as [number, number][];
  if (coords.length >= 3) {
    const lngs    = coords.map(c => c[0]);
    const lats    = coords.map(c => c[1]);
    const minLng  = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat  = Math.min(...lats), maxLat = Math.max(...lats);
    const lngSpan = maxLng - minLng || 0.001;
    const latSpan = maxLat - minLat || 0.001;

    // Fit into upper ~45% of the card, leave room below for text
    const BOX_W   = 560, BOX_H = isCorridor ? 300 : 500;
    const scale   = Math.min(BOX_W / lngSpan, BOX_H / latSpan) * 0.80;
    const drawW   = lngSpan * scale;
    const drawH   = latSpan * scale;
    const shapeCX = W / 2;
    const shapeCY = H * 0.30;
    const ox = shapeCX - drawW / 2;
    const oy = shapeCY - drawH / 2;

    const toX = (lng: number) => ox + (lng - minLng) * scale;
    const toY = (lat: number) => oy + (maxLat - lat) * scale;

    const tracePoly = () => {
      ctx.beginPath();
      coords.forEach(([lng, lat], i) => {
        if (i === 0) ctx.moveTo(toX(lng), toY(lat));
        else ctx.lineTo(toX(lng), toY(lat));
      });
      ctx.closePath();
    };

    if (isCorridor) {
      // ── Corridor: road band ──────────────────────────────────
      // Wide coloured glow
      ctx.save();
      tracePoly();
      ctx.shadowColor = c1;
      ctx.shadowBlur = 48;
      ctx.strokeStyle = c1 + '88';
      ctx.lineWidth = 32;
      ctx.stroke();
      ctx.restore();
      // Filled band
      const roadFill = ctx.createLinearGradient(ox, oy, ox + drawW, oy + drawH);
      roadFill.addColorStop(0, c1 + 'bb');
      roadFill.addColorStop(1, c2 + 'bb');
      ctx.save();
      tracePoly();
      ctx.fillStyle = roadFill;
      ctx.fill();
      ctx.restore();
      // White edge
      ctx.save();
      tracePoly();
      ctx.strokeStyle = 'rgba(255,255,255,0.90)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      // Dashed centre stripe
      if (territory.rawPath && territory.rawPath.length >= 2) {
        ctx.save();
        ctx.setLineDash([14, 16]);
        ctx.beginPath();
        (territory.rawPath as [number,number][]).forEach(([lng, lat], i) => {
          const px = toX(lng), py = toY(lat);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    } else {
      // ── Zone: polygon ────────────────────────────────────────
      // 1. Outer glow halo
      ctx.save();
      tracePoly();
      ctx.shadowColor = c1;
      ctx.shadowBlur = 80;
      ctx.strokeStyle = c1 + '66';
      ctx.lineWidth = 28;
      ctx.stroke();
      ctx.restore();

      // 2. Gradient fill
      const fillGrad = ctx.createLinearGradient(ox, oy, ox + drawW, oy + drawH);
      fillGrad.addColorStop(0, c1 + 'aa');
      fillGrad.addColorStop(1, c2 + '77');
      ctx.save();
      tracePoly();
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.restore();

      // 3. Bright perimeter
      ctx.save();
      tracePoly();
      ctx.shadowColor = c1;
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.95;
      ctx.stroke();
      ctx.restore();

      // 4. Corner accent dots (max 8 to avoid clutter)
      const dotCoords = coords.slice(0, -1);
      const step = Math.max(1, Math.floor(dotCoords.length / 8));
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = c1;
      ctx.shadowBlur = 16;
      for (let i = 0; i < dotCoords.length; i += step) {
        const [lng, lat] = dotCoords[i];
        ctx.beginPath();
        ctx.arc(toX(lng), toY(lat), 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  }

  // ── LAYER 3: Bottom info panel ───────────────────────────────
  // Frosted dark panel behind all text
  const panelY = H - 490;
  ctx.save();
  _rRect(ctx, 30, panelY, W - 60, 390, 28);
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // ── Zone name ─────────────────────────────────────────────────
  ctx.font = `800 64px ${_CARD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  let zoneName = territory.name;
  while (ctx.measureText(zoneName).width > W - 100 && zoneName.length > 1)
    zoneName = zoneName.slice(0, -1);
  if (zoneName !== territory.name) zoneName += '\u2026';
  ctx.fillText(zoneName, W / 2, panelY + 72);
  ctx.shadowBlur = 0;

  // ── Tier + corridor badge ─────────────────────────────────────
  ctx.font = `700 20px ${_CARD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const badges: Array<{ text: string; color: string }> = [
    { text: tier.name, color: tier.uiColor },
    ...(isCorridor ? [{ text: '⟶ ROAD CLAIM', color: '#fbbf24' }] : []),
  ];
  let bx = W / 2 - badges.reduce((sum, b) => {
    ctx.font = `700 20px ${_CARD_FONT}`;
    return sum + ctx.measureText(b.text).width + 40 + 12;
  }, -12) / 2;
  const badgeY = panelY + 100;
  for (const b of badges) {
    ctx.font = `700 20px ${_CARD_FONT}`;
    const bw = ctx.measureText(b.text).width + 36;
    ctx.save();
    _rRect(ctx, bx, badgeY, bw, 30, 15);
    ctx.fillStyle = b.color + '28';
    ctx.fill();
    ctx.strokeStyle = b.color + '80';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, bx + bw / 2, badgeY + 15);
    bx += bw + 12;
  }

  // ── Tagline ───────────────────────────────────────────────────
  if (territory.tagline) {
    ctx.font = `italic 28px ${_CARD_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let tl = `"${territory.tagline}"`;
    while (ctx.measureText(tl).width > W - 120 && tl.length > 3)
      tl = tl.slice(0, -2) + '"';
    ctx.fillText(tl, W / 2, panelY + 152);
  }

  // ── Stats row ─────────────────────────────────────────────────
  const statsY = panelY + 200;
  const stats = [
    { val: _steps(territory.distance), key: 'STEPS'    },
    { val: `${territory.runs ?? 1}×`,  key: 'GRINDS'   },
    { val: _dist(territory.distance),  key: 'DISTANCE' },
  ];
  const colW = (W - 60) / 3;
  stats.forEach((s, i) => {
    const cx = 30 + colW * i + colW / 2;
    // Divider
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(30 + colW * i - 1, statsY, 2, 110);
    }
    // Auto-shrink value
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let vSize = 44;
    ctx.font = `800 ${vSize}px ${_CARD_FONT}`;
    while (ctx.measureText(s.val).width > colW - 16 && vSize > 22) {
      vSize -= 2;
      ctx.font = `800 ${vSize}px ${_CARD_FONT}`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.val, cx, statsY + 54);
    ctx.font = `600 18px ${_CARD_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.fillText(s.key, cx, statsY + 86);
  });

  // ── Brand ─────────────────────────────────────────────────────
  ctx.font = `700 22px ${_CARD_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('RUNMARK', W / 2, panelY + 368);

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
    // ── Step 1: fetch dark map background from CARTO tiles ────
      // (WebGL toDataURL is unreliable due to CORS sprite-sheet taint)
      const mapJpeg = await fetchTileBg(territory.coordinates as [number,number][], 720, 1280);

      // ── Step 2: compose card via Canvas 2D API ─────────────────
      const dataUrl = await buildShareCard(mapJpeg, territory, theme.grad);

      // ── Step 3: share or download ──────────────────────────────
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
