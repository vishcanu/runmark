import React, { useState } from 'react';
import {
  Ruler, Clock, Repeat2, Check, X, Trash2,
  Shield, Zap, Star, Crown, Flag, Target, Flame, Trophy, Gem, Anchor, Mountain, Crosshair,
} from 'lucide-react';
import { Button } from '../../../components/Button/Button';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import type { Territory } from '../../../types';
import styles from './TerritoryDetails.module.css';

// ── Themes — each has a gradient for swatches/UI and a solid color for the map ──
const THEMES = [
  { id: 'cobalt',   name: 'Cobalt',   grad: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#0284c7' },
  { id: 'ocean',    name: 'Ocean',    grad: 'linear-gradient(135deg,#22d3ee,#0e7490)', color: '#0891b2' },
  { id: 'forest',   name: 'Forest',   grad: 'linear-gradient(135deg,#34d399,#065f46)', color: '#059669' },
  { id: 'toxic',    name: 'Toxic',    grad: 'linear-gradient(135deg,#bef264,#4d7c0f)', color: '#65a30d' },
  { id: 'inferno',  name: 'Inferno',  grad: 'linear-gradient(135deg,#fb923c,#9f1239)', color: '#ea580c' },
  { id: 'crimson',  name: 'Crimson',  grad: 'linear-gradient(135deg,#f87171,#7f1d1d)', color: '#dc2626' },
  { id: 'gold',     name: 'Gold',     grad: 'linear-gradient(135deg,#fde68a,#b45309)', color: '#d97706' },
  { id: 'sakura',   name: 'Sakura',   grad: 'linear-gradient(135deg,#f9a8d4,#9d174d)', color: '#db2777' },
  { id: 'nebula',   name: 'Nebula',   grad: 'linear-gradient(135deg,#c4b5fd,#5b21b6)', color: '#7c3aed' },
  { id: 'void',     name: 'Void',     grad: 'linear-gradient(135deg,#818cf8,#1e1b4b)', color: '#6366f1' },
  { id: 'arctic',   name: 'Arctic',   grad: 'linear-gradient(135deg,#bae6fd,#075985)', color: '#0ea5e9' },
  { id: 'midnight', name: 'Midnight', grad: 'linear-gradient(135deg,#94a3b8,#0f172a)', color: '#334155' },
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

  const theme = getTheme(territory.theme);
  const { Icon: EmblemIcon } = getEmblem(territory.emblem);

  const draftThemeObj = getTheme(draftTheme);

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

      {/* ── Delete ── */}
      {!editing && (
        <Button
          variant="danger"
          size="md"
          className={styles.deleteBtn}
          onClick={() => onDelete(territory.id)}
        >
          <Trash2 size={16} strokeWidth={2} />
          Delete Territory
        </Button>
      )}
    </div>
  );
}
