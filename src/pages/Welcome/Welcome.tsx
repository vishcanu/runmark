import { MapPin, Trees, Footprints, Building2, ArrowRight } from 'lucide-react';
import styles from './Welcome.module.css';

interface WelcomeProps { onContinue: () => void; }

const FEATURES = [
  { icon: Trees,      label: 'Parks & Lakes',   desc: 'Discover nature spots near you',           colorClass: 'park'   },
  { icon: Footprints, label: 'Run & Claim',     desc: 'Walk or run to own territory on the map',  colorClass: 'accent' },
  { icon: Building2,  label: 'Build Your City', desc: 'Earn buildings with every run',            colorClass: 'lake'   },
] as const;

export function Welcome({ onContinue }: WelcomeProps) {
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.logoMark}><MapPin size={28} strokeWidth={2} /></div>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>RunGame</h1>
          <p className={styles.heroSub}>Explore parks. Claim territory. Build your city.</p>
        </div>
      </div>
      <div className={styles.sheet}>
        <div className={styles.featureList}>
          {FEATURES.map(({ icon: Icon, label, desc, colorClass }) => (
            <div key={label} className={styles.feature}>
              <div className={[styles.featureIcon, styles[`fi_${colorClass}`]].join(' ')}>
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className={styles.featureText}>
                <span className={styles.featureLabel}>{label}</span>
                <span className={styles.featureDesc}>{desc}</span>
              </div>
            </div>
          ))}
        </div>
        <button className={styles.cta} onClick={onContinue}>
          Get Started
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
        <p className={styles.terms}>Free forever · No account required</p>
      </div>
    </div>
  );
}
