import { useState } from 'react';
import { Ruler, Clock, Repeat2, Pencil, Check, X, Trash2 } from 'lucide-react';
import { Button } from '../../../components/Button/Button';
import { formatDistance, formatDuration } from '../../map/utils/geo';
import type { Territory } from '../../../types';
import styles from './TerritoryDetails.module.css';

const PALETTE = [
  '#0284c7', '#0891b2', '#16a34a', '#65a30d',
  '#d97706', '#ea580c', '#dc2626', '#7c3aed',
  '#db2777', '#0f172a',
];

interface TerritoryDetailsProps {
  territory: Territory;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Territory>) => void;
}

export function TerritoryDetails({ territory, onDelete, onUpdate }: TerritoryDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(territory.name);
  const [draftColor, setDraftColor] = useState(territory.color);

  function handleSave() {
    const name = draftName.trim() || territory.name;
    onUpdate(territory.id, { name, color: draftColor });
    setEditing(false);
  }

  function handleCancel() {
    setDraftName(territory.name);
    setDraftColor(territory.color);
    setEditing(false);
  }
  return (
    <div className={styles.container}>
      <div className={styles.colorAccent} style={{ background: editing ? draftColor : territory.color }} />

      {/* ── Name row ── */}
      {editing ? (
        <div className={styles.editRow}>
          <input
            className={styles.nameInput}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={40}
            autoFocus
          />
          <button className={styles.iconBtn} onClick={handleSave} aria-label="Save">
            <Check size={18} strokeWidth={2.5} />
          </button>
          <button className={styles.iconBtnMuted} onClick={handleCancel} aria-label="Cancel">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className={styles.nameRow}>
          <h2 className={styles.name}>{territory.name}</h2>
          <button className={styles.iconBtnMuted} onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      <span className={styles.date}>
        Claimed {new Date(territory.createdAt).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        })}
      </span>

      {/* ── Color picker (only in edit mode) ── */}
      {editing && (
        <div className={styles.colorSection}>
          <span className={styles.colorLabel}>Zone color</span>
          <div className={styles.swatches}>
            {PALETTE.map((c) => (
              <button
                key={c}
                className={[styles.swatch, c === draftColor ? styles.swatchActive : ''].join(' ')}
                style={{ background: c }}
                onClick={() => setDraftColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Ruler size={18} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <div>
            <span className={styles.statValue}>{formatDistance(territory.distance)}</span>
            <span className={styles.statLabel}>Distance</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Clock size={18} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <div>
            <span className={styles.statValue}>{formatDuration(territory.duration)}</span>
            <span className={styles.statLabel}>Duration</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon} style={{ background: `${territory.color}22` }}>
            <Repeat2 size={18} style={{ color: territory.color }} strokeWidth={2} />
          </div>
          <div>
            <span className={styles.statValue}>{territory.runs ?? 1}</span>
            <span className={styles.statLabel}>Runs</span>
          </div>
        </div>
      </div>

      <Button
        variant="danger"
        size="md"
        className={styles.deleteBtn}
        onClick={() => onDelete(territory.id)}
      >
        <Trash2 size={16} strokeWidth={2} />
        Delete Territory
      </Button>
    </div>
  );
}
