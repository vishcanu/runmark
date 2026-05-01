import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { saveUserProfile } from '../../hooks/useUserProfile';
import styles from './Login.module.css';

const COLORS = [
  { value: '#0284c7', label: 'Sky' },
  { value: '#0284c7', label: 'Ocean' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#dc2626', label: 'Fire' },
  { value: '#d97706', label: 'Amber' },
  { value: '#db2777', label: 'Rose' },
] as const;

interface LoginProps {
  onBack: () => void;
  onLogin: (name: string, color: string) => void;
}

export function Login({ onBack, onLogin }: LoginProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0].value);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveUserProfile(trimmed, selectedColor);
    onLogin(trimmed, selectedColor);
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={onBack} aria-label="Go back">
        <ArrowLeft size={20} strokeWidth={2} />
      </button>

      <div className={styles.content}>
        {/* Avatar preview */}
        <div className={styles.avatarWrap}>
          <div className={styles.avatar} style={{ background: selectedColor }}>
            <span className={styles.avatarInitial}>
              {name.trim().charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        </div>

        <div className={styles.headingGroup}>
          <h1 className={styles.heading}>Create your{'\n'}profile</h1>
          <p className={styles.subtext}>Choose a name and colour for your territory</p>
        </div>

        <div className={styles.fields}>
          {/* Name input */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="player-name">Your name</label>
            <input
              id="player-name"
              type="text"
              className={styles.input}
              placeholder="e.g. Alex, Priya…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              maxLength={24}
              autoFocus
              autoComplete="off"
            />
          </div>

          {/* Color picker */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Territory colour</label>
            <div className={styles.swatches}>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  className={[styles.swatch, selectedColor === c.value ? styles.swatchActive : ''].join(' ')}
                  style={{ background: c.value }}
                  onClick={() => setSelectedColor(c.value)}
                  aria-label={`Color: ${c.label}`}
                  title={c.label}
                >
                  {selectedColor === c.value && (
                    <Check size={15} strokeWidth={3} className={styles.swatchCheck} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className={styles.cta}
          onClick={handleSubmit}
          disabled={!name.trim()}
        >
          Let's go
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
