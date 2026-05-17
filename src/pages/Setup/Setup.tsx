import { useState, useRef } from 'react';
import { ArrowRight, Check, ChevronLeft, Activity } from 'lucide-react';
import { saveUserProfile } from '../../hooks/useUserProfile';
import type { HealthProfile } from '../../hooks/useUserProfile';
import styles from './Setup.module.css';

const COLORS = [
  { value: '#0284c7', label: 'Sky'    },
  { value: '#0369a1', label: 'Ocean'  },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#dc2626', label: 'Fire'   },
  { value: '#d97706', label: 'Amber'  },
  { value: '#db2777', label: 'Rose'   },
] as const;

type Gender = 'male' | 'female' | 'other';
type Step = 1 | 2 | 3;

interface MetricCardProps {
  label: string;
  unit: string;
  value: number | '';
  onChange: (v: number | '') => void;
  inputMode?: 'numeric' | 'decimal';
  min: number;
  max: number;
  step?: number;
  accent: string;
  full?: boolean;
}

function MetricCard({ label, unit, value, onChange, inputMode = 'numeric', min, max, step = 1, accent, full }: MetricCardProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label
      className={[styles.metricCard, full ? styles.metricCardFull : ''].join(' ')}
      style={{ '--mc-accent': accent } as React.CSSProperties}
    >
      <span className={styles.metricCardLabel}>{label}</span>
      <input
        ref={ref}
        className={styles.metricInput}
        type="number"
        inputMode={inputMode}
        placeholder="—"
        min={min}
        max={max}
        step={step}
        value={value === '' ? '' : String(value)}
        onChange={(e) => {
          if (e.target.value === '') { onChange(''); return; }
          const n = inputMode === 'decimal' ? parseFloat(e.target.value) : parseInt(e.target.value);
          if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)) as number);
        }}
        onFocus={(e) => e.target.select()}
      />
      <span className={styles.metricCardUnit}>{unit}</span>
    </label>
  );
}

interface SetupProps {
  onComplete: () => void;
}

export function Setup({ onComplete }: SetupProps) {
  const existingName = localStorage.getItem('rg_user_name') ?? 'Runner';

  const [step, setStep]               = useState<Step>(1);
  const [name, setName]               = useState(existingName);
  const [selectedColor, setSelectedColor] = useState('#0284c7');
  const [age, setAge]                 = useState<number | ''>('');
  const [weight, setWeight]           = useState<number | ''>('');
  const [height, setHeight]           = useState<number | ''>('');
  const [gender, setGender]           = useState<Gender | ''>('');

  const initial = (name.trim() || existingName).charAt(0).toUpperCase();
  const displayName = name.trim() || existingName;

  const handleComplete = () => {
    const health: HealthProfile = {
      age:      age      !== '' ? Number(age)      : undefined,
      weightKg: weight   !== '' ? Number(weight)   : undefined,
      heightCm: height   !== '' ? Number(height)   : undefined,
      gender:   (gender as Gender) || undefined,
    };
    localStorage.setItem('rg_user_name', displayName);
    saveUserProfile(displayName, selectedColor, health);
    onComplete();
  };

  return (
    <div className={styles.page} style={{ '--setup-color': selectedColor } as React.CSSProperties}>

      {/* Coloured hero area */}
      <div className={styles.hero}>
        <div className={styles.heroNav}>
          {step > 1
            ? <button className={styles.heroBack} onClick={() => setStep((step - 1) as Step)}><ChevronLeft size={20} /></button>
            : <span className={styles.heroBackSpacer} />}
          <span className={styles.heroCount}>{step} / 3</span>
        </div>

        {step === 1 && (
          <div className={styles.heroAvatarWrap}>
            <div className={styles.avatar} style={{ background: selectedColor }}>
              <span className={styles.avatarInitial}>{initial}</span>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className={styles.heroBadge}>
            <Activity size={40} strokeWidth={1.5} color="rgba(255,255,255,0.92)" />
          </div>
        )}
        {step === 3 && (
          <div className={styles.heroBadge}>
            <Check size={42} strokeWidth={2} color="rgba(255,255,255,0.95)" />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <div className={styles.content}>

        {/* ── STEP 1: Identity ─────────────────────────────── */}
        {step === 1 && (
          <div className={styles.stepWrap}>
            <div className={styles.textBlock}>
              <h1 className={styles.heading}>Create your profile</h1>
              <p className={styles.subtext}>How other runners see you on the map</p>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Your name</label>
              <input
                className={styles.nameInput}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Runner"
                maxLength={30}
                autoComplete="name"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Territory colour</label>
              <div className={styles.swatches}>
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={[styles.swatch, selectedColor === c.value ? styles.swatchActive : ''].join(' ')}
                    style={{ background: c.value }}
                    onClick={() => setSelectedColor(c.value)}
                    aria-label={c.label}
                  >
                    {selectedColor === c.value && <Check size={14} strokeWidth={3} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              className={styles.cta}
              style={{ background: selectedColor }}
              onClick={() => setStep(2)}
            >
              Continue <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* ── STEP 2: Body metrics ─────────────────────────── */}
        {step === 2 && (
          <div className={styles.stepWrap}>
            <div className={styles.textBlock}>
              <h1 className={styles.heading}>Body metrics</h1>
              <p className={styles.subtext}>Tap a field and type your number. Used for calorie burn &amp; heart rate zones only.</p>
            </div>

            <div className={styles.metricGrid}>
              <MetricCard label="Age" unit="years" value={age} onChange={setAge} min={10} max={100} accent={selectedColor} />
              <MetricCard label="Weight" unit="kg" value={weight} onChange={setWeight} inputMode="decimal" step={0.1} min={30} max={250} accent={selectedColor} />
              <MetricCard label="Height" unit="cm" value={height} onChange={setHeight} min={100} max={250} accent={selectedColor} full />
            </div>

            <div className={styles.genderSection}>
              <span className={styles.genderSectionLabel}>I identify as <span className={styles.genderOptional}>(optional)</span></span>
              <div className={styles.genderOptions}>
                {(['male', 'female', 'other'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    className={[styles.genderOption, gender === g ? styles.genderOptionActive : ''].join(' ')}
                    style={gender === g ? { borderColor: selectedColor, color: selectedColor, background: selectedColor + '12' } : undefined}
                    onClick={() => setGender((prev) => (prev === g ? '' : g))}
                  >
                    <span className={styles.genderIcon}>{g === 'male' ? '♂' : g === 'female' ? '♀' : '⚧'}</span>
                    <span className={styles.genderLabel}>{g.charAt(0).toUpperCase() + g.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className={styles.cta}
              style={{ background: selectedColor }}
              onClick={() => setStep(3)}
            >
              Continue <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* ── STEP 3: Ready ────────────────────────────────── */}
        {step === 3 && (
          <div className={styles.stepWrap}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryAvatar} style={{ background: selectedColor }}>
                <span className={styles.summaryInitial}>{initial}</span>
              </div>
              <div className={styles.summaryName}>{displayName}</div>
              <div className={styles.summaryStats}>
                {age      !== '' && <div className={styles.statChip}>{age} yrs</div>}
                {weight   !== '' && <div className={styles.statChip}>{weight} kg</div>}
                {height   !== '' && <div className={styles.statChip}>{height} cm</div>}
                {gender        && <div className={styles.statChip} style={{ textTransform: 'capitalize' }}>{gender}</div>}
              </div>
            </div>

            <div className={styles.textBlock}>
              <h1 className={styles.heading}>You're all set, {displayName.split(' ')[0]}!</h1>
              <p className={styles.subtext}>Claim territories, track health, and earn rewards.</p>
            </div>

            <div className={styles.checkList}>
              {['Territory claiming enabled', 'Health metrics personalised', 'Stats saved to cloud'].map((item) => (
                <div key={item} className={styles.checkItem}>
                  <div className={styles.checkCircle} style={{ background: selectedColor }}>
                    <Check size={12} strokeWidth={3} color="#fff" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button
              className={styles.ctaGlow}
              style={{ '--cta-color': selectedColor } as React.CSSProperties}
              onClick={handleComplete}
            >
              Start Running <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
