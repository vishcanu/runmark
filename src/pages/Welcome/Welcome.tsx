import { Trees, Footprints, Building2, ArrowRight, ChevronRight } from 'lucide-react';
import { ClaimXLogo } from '../../components/ClaimXLogo/ClaimXLogo';
import styles from './Welcome.module.css';

interface WelcomeProps { onContinue: () => void; }

const FEATURES = [
  {
    icon: Trees,
    label: 'Parks & Lakes',
    desc: 'Discover nature spots near you',
    colorClass: 'park',
    stat: 'GPS-powered',
  },
  {
    icon: Footprints,
    label: 'Run & Claim',
    desc: 'Walk or run to own territory on the map',
    colorClass: 'accent',
    stat: 'Real-time',
  },
  {
    icon: Building2,
    label: 'Build Your City',
    desc: 'Earn buildings with every run',
    colorClass: 'lake',
    stat: 'Gamified',
  },
] as const;

export function Welcome({ onContinue }: WelcomeProps) {
  return (
    <div className={styles.page}>

      {/* ── Hero ──────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.meshOverlay} aria-hidden />

        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          Health · Territory · Victory
        </div>

        <div className={styles.logoWrap}>
          <div className={styles.logoRing} aria-hidden />
          <div className={styles.logoMark}>
            <ClaimXLogo size={34} />
          </div>
        </div>

        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>Claim<span className={styles.heroX}>'X'</span></h1>
          <p className={styles.heroSub}>
            Health as a Game.<br />Life as a Victory.
          </p>
        </div>
      </div>

      {/* ── Content sheet ─────────────────────────────────── */}
      <div className={styles.sheet}>
        <div className={styles.sheetHandle} aria-hidden />

        <div className={styles.sectionLabel}>What you get</div>

        <div className={styles.featureList}>
          {FEATURES.map(({ icon: Icon, label, desc, colorClass, stat }) => (
            <div key={label} className={[styles.feature, styles[`fb_${colorClass}`]].join(' ')}>
              <div className={[styles.featureIcon, styles[`fi_${colorClass}`]].join(' ')}>
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className={styles.featureText}>
                <div className={styles.featureTop}>
                  <span className={styles.featureLabel}>{label}</span>
                  <span className={[styles.featureBadge, styles[`badge_${colorClass}`]].join(' ')}>{stat}</span>
                </div>
                <span className={styles.featureDesc}>{desc}</span>
              </div>
              <ChevronRight size={14} strokeWidth={2} className={styles.featureArrow} />
            </div>
          ))}
        </div>

        <button className={styles.cta} onClick={onContinue}>
          <span>Get Started</span>
          <div className={styles.ctaArrow}>
            <ArrowRight size={16} strokeWidth={2.5} />
          </div>
        </button>

        <p className={styles.terms}>
          Free forever &nbsp;·&nbsp; No account required &nbsp;·&nbsp; Your data stays private
        </p>
      </div>
    </div>
  );
}
