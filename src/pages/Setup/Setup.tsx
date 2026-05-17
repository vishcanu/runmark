import { useState } from 'react';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
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

interface StepperProps {
  value: number | '';
  onChange: (v: number | '') => void;
  min: number;
  max: number;
  step?: number;
}

function Stepper({ value, onChange, min, max, step = 1 }: StepperProps) {
  const num = value === '' ? min : Number(value);
  return (
    <div className={styles.stepperWrap}>
      <button className={styles.stepperBtn} onClick={() => onChange(Math.max(min, +(num - step).toFixed(1)))}>−</button>
      <span className={styles.stepperValue}>{value === '' ? '–' : value}</span>
      <button className={styles.stepperBtn} onClick={() => {
        const next = +(num + step).toFixed(1);
        onChange(Math.min(max, next));
      }}>+</button>
    </div>
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
    <div className={styles.page}>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${(step / 3) * 100}%`, background: selectedColor }} />
      </div>

      {/* Step dots */}
      <div className={styles.stepDots}>
        {([1, 2, 3] as Step[]).map((s) => (
          <div
            key={s}
            className={[styles.stepDot, step >= s ? styles.stepDotActive : ''].join(' ')}
            style={step >= s ? { background: selectedColor } : undefined}
          />
        ))}
      </div>

      <div className={styles.content}>

        {/* ── STEP 1: Identity ─────────────────────────────── */}
        {step === 1 && (
          <div className={styles.stepWrap}>
            <div className={styles.avatarRing} style={{ '--ring-color': selectedColor } as React.CSSProperties}>
              <div className={styles.avatar} style={{ background: selectedColor }}>
                <span className={styles.avatarInitial}>{initial}</span>
              </div>
            </div>

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
            <div className={styles.iconBadge} style={{ background: selectedColor + '1a', color: selectedColor }}>
              <span className={styles.iconBadgeEmoji}>💪</span>
            </div>

            <div className={styles.textBlock}>
              <h1 className={styles.heading}>Body metrics</h1>
              <p className={styles.subtext}>Accurate calorie burn & heart rate zones. Never shared.</p>
            </div>

            <div className={styles.metricList}>
              <div className={styles.metricRow}>
                <div className={styles.metricInfo}>
                  <span className={styles.metricName}>Age</span>
                  <span className={styles.metricDesc}>years old</span>
                </div>
                <Stepper value={age} onChange={setAge} min={10} max={100} />
              </div>

              <div className={styles.metricRow}>
                <div className={styles.metricInfo}>
                  <span className={styles.metricName}>Weight</span>
                  <span className={styles.metricDesc}>kilograms</span>
                </div>
                <Stepper value={weight} onChange={setWeight} min={30} max={250} step={0.5} />
              </div>

              <div className={styles.metricRow}>
                <div className={styles.metricInfo}>
                  <span className={styles.metricName}>Height</span>
                  <span className={styles.metricDesc}>centimetres</span>
                </div>
                <Stepper value={height} onChange={setHeight} min={100} max={250} />
              </div>

              <div className={styles.metricRow}>
                <div className={styles.metricInfo}>
                  <span className={styles.metricName}>Gender</span>
                  <span className={styles.metricDesc}>optional</span>
                </div>
                <div className={styles.genderPills}>
                  {(['male', 'female', 'other'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      className={[styles.genderPill, gender === g ? styles.genderPillActive : ''].join(' ')}
                      style={gender === g ? { background: selectedColor, borderColor: selectedColor, color: '#fff' } : undefined}
                      onClick={() => setGender((prev) => (prev === g ? '' : g))}
                    >
                      {g === 'male' ? '♂' : g === 'female' ? '♀' : '○'} {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep(1)}>
                <ChevronLeft size={18} /> Back
              </button>
              <button
                className={styles.cta}
                style={{ background: selectedColor, flex: 1 }}
                onClick={() => setStep(3)}
              >
                Continue <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>
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

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep(2)}>
                <ChevronLeft size={18} /> Back
              </button>
              <button
                className={styles.ctaGlow}
                style={{ '--cta-color': selectedColor } as React.CSSProperties}
                onClick={handleComplete}
              >
                Start Running <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
