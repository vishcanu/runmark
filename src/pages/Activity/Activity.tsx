import { useState, useMemo } from 'react';
import { Flame, TrendingUp, Clock, MapPin, Activity as ActivityIcon, Zap, Bike, Footprints } from 'lucide-react';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { TerritoryCard } from '../../features/territory/components/TerritoryCard';
import { Modal } from '../../components/Modal/Modal';
import { TerritoryDetails } from '../../features/territory/components/TerritoryDetails';
import { formatDistance, formatDuration } from '../../features/map/utils/geo';
import { useUserProfile } from '../../hooks/useUserProfile';
import { calcCaloriesBurned, estimateSteps } from '../../features/activity/utils/health';
import { useWeather, type WeatherData } from '../../features/activity/hooks/useWeather';
import type { ActivityType } from '../../types';
import styles from './Activity.module.css';

const DAILY_STEP_GOAL = 8_000;
const DAILY_DIST_GOAL_KM = 10;
const CHART_W = 280;
const CHART_BASELINE = 68;
const MAX_BAR_H = 54;

// ── Premium sky + weather widget ─────────────────────────────
const UID = 'ws'; // stable SVG gradient/filter ID prefix

function WeatherScene({ hour, weather }: { hour: number; weather: WeatherData | null }) {
  const h = Math.max(5, Math.min(19, hour));
  const angle = Math.PI * (1 - (h - 5) / 14);
  const CX = 60, CY = 72, R = 46;
  const bx = CX + R * Math.cos(angle);
  const by = CY - R * Math.sin(angle);
  const bodyVisible = by < 68;

  const isNight   = hour < 5 || hour >= 20;
  const isEvening = hour >= 17 && hour < 20;
  const isMorning = hour >= 5  && hour < 9;
  const cloudy    = !!(weather?.isCloudy);
  const isRain    = weather?.isRain    ?? false;
  const isSnow    = weather?.isSnow    ?? false;
  const isThunder = weather?.isThunder ?? false;
  const sunColor  = isEvening ? '#fb923c' : isMorning ? '#fcd34d' : '#fbbf24';
  const sunGlow   = isEvening ? 'rgba(251,146,60,0.35)' : 'rgba(251,191,36,0.28)';

  // ── Cloud appearance — varies by time of day + weather severity ──────────
  const isStorm = isRain || isThunder || isSnow;
  // Night clouds: grey-blue + semi-transparent so moon/stars show through
  // Day storm clouds: dark grey  |  Day fair clouds: bright white
  const cloudFill1 = isNight
    ? (isStorm ? 'rgba(48,62,92,0.88)' : 'rgba(98,118,152,0.80)')
    : isStorm ? 'rgba(148,160,180,0.94)' : `url(#${UID}-cg1)`;
  const cloudFill2 = isNight
    ? (isStorm ? 'rgba(40,54,82,0.76)' : 'rgba(82,102,136,0.66)')
    : isStorm ? 'rgba(132,146,168,0.82)' : `url(#${UID}-cg2)`;
  // Opacity: night = semi-transparent to reveal sky behind; storm = heavier
  const cloudOp   = isNight ? (isStorm ? 0.82 : 0.58) : 1;
  const bgCloudOp = isNight ? (isStorm ? 0.70 : 0.44) : 0.88;

  return (
    <svg viewBox="0 0 150 72" className={styles.weatherScene} aria-hidden="true">
      <defs>
        <filter id={`${UID}-cs`} x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="rgba(0,30,60,0.20)" />
        </filter>
        <filter id={`${UID}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${UID}-bolt`} x="-60%" y="-40%" width="220%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Clip crescent mask to moon body boundary */}
        <clipPath id={`${UID}-mc`}>
          <circle cx="80" cy="20" r="9.4" />
        </clipPath>
        <linearGradient id={`${UID}-cg1`} x1="10%" y1="0%" x2="20%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="rgba(232,244,255,0.97)" />
          <stop offset="100%" stopColor="rgba(200,222,248,0.92)" />
        </linearGradient>
        <linearGradient id={`${UID}-cg2`} x1="10%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="rgba(235,245,255,0.88)" />
          <stop offset="100%" stopColor="rgba(195,218,245,0.72)" />
        </linearGradient>
        <radialGradient id={`${UID}-sg`} cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#fffde7" />
          <stop offset="100%" stopColor={sunColor} />
        </radialGradient>
        <radialGradient id={`${UID}-mg`} cx="38%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#fffff4" />
          <stop offset="100%" stopColor="#e5ddb8" />
        </radialGradient>
        <linearGradient id={`${UID}-rg`} x1="5%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(185,215,255,0.90)" />
          <stop offset="100%" stopColor="rgba(185,215,255,0.05)" />
        </linearGradient>
      </defs>

      {/* Dashed arc guide */}
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="0.8" strokeDasharray="3 5" />

      {/* ── NIGHT ── */}
      {isNight && <>
        {([
          [5,6,0.65,0.7],[13,3,0.9,0.9],[21,13,0.55,0.6],[29,5,1.0,0.8],[37,19,0.6,0.7],
          [46,8,0.8,0.9],[54,4,0.55,0.6],[57,15,0.75,0.8],[62,28,0.5,0.5],
          [97,7,0.8,0.9],[105,3,0.65,0.7],[111,14,1.0,0.8],[118,8,0.5,0.6],
          [125,5,0.75,0.8],[133,12,0.55,0.6],[140,4,0.85,0.9],[146,18,0.6,0.7],[149,9,0.70,0.8],
          [9,38,0.6,0.5],[24,43,0.5,0.6],[41,34,0.7,0.7],[63,48,0.5,0.5],
          [82,42,0.65,0.6],[101,37,0.7,0.7],[116,46,0.55,0.5],
          [128,38,0.5,0.5],[136,44,0.6,0.6],[143,34,0.55,0.7],[148,47,0.5,0.5],
        ] as [number,number,number,number][]).map(([sx,sy,r,op],i) => (
          <circle key={i} cx={sx} cy={sy} r={r} fill="#ffffff"
            opacity={cloudy ? op * 0.18 : op}
            className={i%4===0 ? styles.starTwinkle : i%4===1 ? styles.starTwinkle2 : undefined} />
        ))}
        {/* Moon glow halos — dimmed when cloudy */}
        <circle cx="80" cy="20" r="16" fill="rgba(255,250,210,0.09)" opacity={cloudy ? 0.28 : 1} />
        <circle cx="80" cy="20" r="12" fill="rgba(255,250,210,0.15)" opacity={cloudy ? 0.38 : 1} />
        {/* Moon body */}
        <circle cx="80" cy="20" r="9.5" fill={`url(#${UID}-mg)`}
          filter={`url(#${UID}-glow)`} opacity={cloudy ? 0.50 : 1} />
        {/* Crescent mask — clipped to moon boundary so it never bleeds outside */}
        <circle cx="87.5" cy="15.5" r="7.8" fill="rgba(8,8,36,1)"
          clipPath={`url(#${UID}-mc)`} opacity={cloudy ? 0.50 : 1} />
      </>}

      {/* ── SUN ── */}
      {!isNight && bodyVisible && <>
        {!cloudy && <>
          <circle cx={bx} cy={by} r="21" fill={sunGlow} opacity="0.30" />
          <circle cx={bx} cy={by} r="14" fill={sunGlow} opacity="0.46" />
        </>}
        {!cloudy && Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return <line key={i}
            x1={bx + 10 * Math.cos(a)} y1={by + 10 * Math.sin(a)}
            x2={bx + 16 * Math.cos(a)} y2={by + 16 * Math.sin(a)}
            stroke={sunColor} strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />;
        })}
        <circle cx={bx} cy={by} r="7.5"
          fill={`url(#${UID}-sg)`} opacity={cloudy ? 0.30 : 1}
          filter={cloudy ? undefined : `url(#${UID}-glow)`} />
      </>}

      {/* ── CLOUDS — overcast ── */}
      {cloudy && <>
        {/* Far-right third cloud — fills new viewBox space */}
        <g className={styles.cloudMain} filter={`url(#${UID}-cs)`} opacity={bgCloudOp * 0.72}>
          <circle cx="126" cy="38" r="4.5" fill={cloudFill2} />
          <circle cx="134" cy="34" r="5.5" fill={cloudFill2} />
          <circle cx="142" cy="36" r="4.5" fill={cloudFill2} />
          <rect x="122" y="38" width="24" height="5.5" rx="2.8" fill={cloudFill2} />
        </g>
        {/* Background cloud — top-right, compact icon size */}
        <g className={styles.cloudBg} filter={`url(#${UID}-cs)`} opacity={bgCloudOp}>
          <circle cx="88"  cy="28" r="4.5" fill={cloudFill2} />
          <circle cx="96"  cy="25" r="6"   fill={cloudFill2} />
          <circle cx="104" cy="27" r="5"   fill={cloudFill2} />
          <rect x="84" y="29" width="25" height="6" rx="3" fill={cloudFill2} />
          {!isNight && <>
            <circle cx="94"  cy="22" r="2.8" fill="rgba(255,255,255,0.60)" />
            <circle cx="102" cy="21" r="3"   fill="rgba(255,255,255,0.55)" />
          </>}
        </g>
        {/* Main foreground cloud — icon-sized, 4 puffs */}
        <g className={styles.cloudMain} filter={`url(#${UID}-cs)`} opacity={cloudOp}>
          <circle cx="40"  cy="44" r="6"   fill={cloudFill1} />
          <circle cx="49"  cy="40" r="7.5" fill={cloudFill1} />
          <circle cx="58"  cy="38" r="8"   fill={cloudFill1} />
          <circle cx="67"  cy="41" r="6.5" fill={cloudFill1} />
          <circle cx="74"  cy="44" r="5.5" fill={cloudFill1} />
          <rect x="36" y="44" width="43" height="7" rx="3.5" fill={cloudFill1} />
          {!isNight && <>
            <circle cx="47" cy="37" r="3.5" fill="rgba(255,255,255,0.60)" />
            <circle cx="57" cy="34" r="4"   fill="rgba(255,255,255,0.52)" />
          </>}
        </g>
      </>}

      {/* ── FAIR-WEATHER WISPS ── */}
      {!cloudy && !isNight && <>
        <g className={styles.cloudBg} opacity="0.52">
          <circle cx="102" cy="11" r="4"   fill="rgba(255,255,255,0.90)" />
          <circle cx="109" cy="10" r="4.5" fill="rgba(255,255,255,0.90)" />
          <circle cx="115" cy="12" r="3.5" fill="rgba(255,255,255,0.90)" />
          <rect x="99" y="12" width="19" height="5" rx="2.5" fill="rgba(255,255,255,0.88)" />
        </g>
        <g className={styles.cloudMain} opacity="0.32">
          <circle cx="8"   cy="18" r="3"   fill="rgba(255,255,255,0.90)" />
          <circle cx="15"  cy="16" r="4.5" fill="rgba(255,255,255,0.90)" />
          <circle cx="22"  cy="18" r="3.5" fill="rgba(255,255,255,0.90)" />
          <rect x="6" y="18" width="19" height="5" rx="2.5" fill="rgba(255,255,255,0.88)" />
        </g>
        {/* Right-side wisp cloud in extended space */}
        <g className={styles.cloudBg} opacity="0.40">
          <circle cx="126" cy="9"  r="3.5" fill="rgba(255,255,255,0.90)" />
          <circle cx="132" cy="8"  r="4"   fill="rgba(255,255,255,0.90)" />
          <circle cx="139" cy="10" r="3"   fill="rgba(255,255,255,0.90)" />
          <rect x="123" y="10" width="19" height="4.5" rx="2.2" fill="rgba(255,255,255,0.88)" />
        </g>
      </>}

      {/* ── BIRDS — visible right-side extended space, day only ── */}
      {!isNight && (
        <g opacity={cloudy ? 0.28 : 0.62}>
          <path d="M122,22 Q125.5,18.5 129,22" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M133,13 Q136.5,9.5 140,13" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M141,25 Q144,22.5 147,25" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="1.0" strokeLinecap="round" />
          <path d="M126,30 Q128.5,28 131,30" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      )}

      {/* ── RAIN ── */}
      {isRain && Array.from({ length: 9 }, (_, i) => (
        <g key={i} className={i%3===0 ? styles.rainDrop : i%3===1 ? styles.rainDrop2 : styles.rainDrop3}>
          <line
            x1={12 + i * 11} y1={48 + (i % 3) * 4}
            x2={9  + i * 11} y2={64 + (i % 3) * 4}
            stroke={`url(#${UID}-rg)`}
            strokeWidth={i % 3 === 0 ? "1.8" : "1.4"}
            strokeLinecap="round" />
        </g>
      ))}

      {/* ── SNOW ── */}
      {isSnow && Array.from({ length: 7 }, (_, i) => (
        <g key={i} className={i%2===0 ? styles.snowFlake : styles.snowFlake2}
           transform={`translate(${11 + i * 16},${47 + (i % 2) * 8})`}>
          <circle r="2.4" fill="rgba(220,236,255,0.95)" />
          <line x1="-4" y1="0" x2="4" y2="0" stroke="rgba(255,255,255,0.82)" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="rgba(255,255,255,0.82)" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="-2.8" y1="-2.8" x2="2.8" y2="2.8" stroke="rgba(255,255,255,0.52)" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="2.8" y1="-2.8" x2="-2.8" y2="2.8" stroke="rgba(255,255,255,0.52)" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      ))}

      {/* ── THUNDER ── */}
      {isThunder && <>
        {/* Outer glow */}
        <polyline points="70,30 63,45 69,45 61,62"
          fill="none" stroke="rgba(253,224,71,0.40)" strokeWidth="7"
          strokeLinecap="round" strokeLinejoin="round" filter={`url(#${UID}-bolt)`} />
        {/* Main bolt */}
        <polyline points="70,30 63,45 69,45 61,62"
          fill="none" stroke="#fde047" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Bright core */}
        <polyline points="70,30 63,45 69,45 61,62"
          fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="0.9"
          strokeLinecap="round" strokeLinejoin="round" />
      </>}

      {/* Horizon line */}
      <line x1="0" y1="68" x2="150" y2="68" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
    </svg>
  );
}

type Period = 'daily' | 'weekly' | 'monthly';
type ActivityFilter = 'all' | ActivityType;

export function Activity() {
  const store = useTerritoryStore();
  const user = useUserProfile();
  const weather = useWeather();
  const [period, setPeriod] = useState<Period>('daily');
  const [actFilter, setActFilter] = useState<ActivityFilter>('all');
  const selectedTerritory = store.selectedId ? store.getTerritory(store.selectedId) : null;
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = new Date().getHours();
  const timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' =
    hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 21 ? 'evening' : 'night';
  const todCfg = {
    morning:   { greeting: 'Good Morning',   emoji: '☀️',  bg: 'linear-gradient(150deg,#fbbf24 0%,#ea580c 100%)' },
    afternoon: { greeting: 'Good Afternoon', emoji: '⛅',  bg: 'linear-gradient(150deg,#38bdf8 0%,#0284c7 100%)' },
    evening:   { greeting: 'Good Evening',   emoji: '🌇',  bg: 'linear-gradient(150deg,#a855f7 0%,#6366f1 100%)' },
    night:     { greeting: 'Good Night',     emoji: '🌙',  bg: 'linear-gradient(150deg,#312e81 0%,#1e1b4b 100%)' },
  }[timeOfDay];

  const dayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const now = Date.now();

  const weeklyActive = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dStart = dayStart - (6 - i) * 86_400_000;
      return store.territories.some(t => t.createdAt >= dStart && t.createdAt < dStart + 86_400_000);
    }), [store.territories, dayStart]);
  const activeDaysCount = weeklyActive.filter(Boolean).length;

  const filtered = useMemo(() =>
    actFilter === 'all' ? store.territories : store.territories.filter(t => t.activityType === actFilter),
    [store.territories, actFilter]);

  const isCycle = actFilter === 'cycle';
  const chartMode = isCycle ? 'distance' : 'steps';
  const chartGoal = isCycle ? DAILY_DIST_GOAL_KM : DAILY_STEP_GOAL;

  // Health profile values (fall back to average adult if not set)
  const weightKg = user.health.weightKg ?? 70;
  const heightCm = user.health.heightCm ?? 170;

  const todayTs = useMemo(() => filtered.filter(t => t.createdAt >= dayStart), [filtered, dayStart]);
  const todaySteps = useMemo(() => todayTs.reduce((s,t) => s + estimateSteps(t.distance, t.activityType ?? 'walk', heightCm), 0), [todayTs, heightCm]);
  const todayCals  = useMemo(() => todayTs.reduce((s,t) => s + calcCaloriesBurned(t.distance, t.duration, t.activityType ?? 'walk', weightKg), 0), [todayTs, weightKg]);
  const todayDist     = useMemo(() => todayTs.reduce((s,t) => s + t.distance, 0), [todayTs]);
  const todayDuration = useMemo(() => todayTs.reduce((s,t) => s + t.duration, 0), [todayTs]);

  const periodStart = useMemo(() => {
    if (period === 'daily') return dayStart;
    if (period === 'weekly') return now - 7 * 86_400_000;
    return now - 30 * 86_400_000;
  }, [period, dayStart, now]);
  const periodTs    = useMemo(() => filtered.filter(t => t.createdAt >= periodStart), [filtered, periodStart]);
  const periodSteps = useMemo(() => periodTs.reduce((s,t) => s + estimateSteps(t.distance, t.activityType ?? 'walk', heightCm), 0), [periodTs, heightCm]);
  const periodCals = useMemo(() => periodTs.reduce((s,t) => s + calcCaloriesBurned(t.distance, t.duration, t.activityType ?? 'walk', weightKg), 0), [periodTs, weightKg]);
  const periodDist = useMemo(() => periodTs.reduce((s,t) => s + t.distance, 0), [periodTs]);
  const periodDuration = useMemo(() => periodTs.reduce((s,t) => s + t.duration, 0), [periodTs]);

  const WEEK_DAYS    = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const calendarDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dStart = dayStart - (6 - i) * 86_400_000;
      const d = new Date(dStart);
      const dow = d.getDay();
      return { dayLabel: WEEK_DAYS[dow === 0 ? 6 : dow - 1], dateNum: d.getDate(), active: weeklyActive[i], isToday: i === 6 };
    }), [dayStart, weeklyActive]);

  const barData = useMemo(() => {
    function bv(ts: typeof filtered): number {
      if (chartMode === 'distance') return parseFloat((ts.reduce((s,t) => s+t.distance,0)/1000).toFixed(2));
      return ts.reduce((s,t) => s + estimateSteps(t.distance, t.activityType ?? 'walk', heightCm), 0);
    }
    if (period === 'daily') return Array.from({ length: 7 }, (_, i) => {
      const dStart = dayStart - (6-i)*86_400_000;
      const ts = filtered.filter(t => t.createdAt >= dStart && t.createdAt < dStart+86_400_000);
      const dow = new Date(dStart).getDay();
      return { label: WEEK_DAYS[dow===0?6:dow-1], value: bv(ts), isToday: i===6 };
    });
    if (period === 'weekly') return Array.from({ length: 4 }, (_, i) => {
      const wStart = dayStart - (3-i)*7*86_400_000;
      const ts = filtered.filter(t => t.createdAt >= wStart && t.createdAt < wStart+7*86_400_000);
      return { label: `Wk ${i+1}`, value: bv(ts), isToday: i===3 };
    });
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-(5-i)); d.setHours(0,0,0,0);
      const mStart = d.getTime(); const mEnd = new Date(d.getFullYear(), d.getMonth()+1, 1).getTime();
      const ts = filtered.filter(t => t.createdAt >= mStart && t.createdAt < mEnd);
      return { label: MONTHS_SHORT[d.getMonth()], value: bv(ts), isToday: i===5 };
    });
  }, [period, filtered, dayStart, chartMode, heightCm]);

  const activityBreakdown = useMemo(() =>
    (['run','walk','cycle'] as ActivityType[]).map(type => {
      const ts = store.territories.filter(t => t.activityType === type);
      const dist = ts.reduce((s,t) => s+t.distance, 0);
      const dur  = ts.reduce((s,t) => s+t.duration, 0);
      return { type, count: ts.length, dist, dur,
        steps: ts.reduce((s,t) => s + estimateSteps(t.distance, type, heightCm), 0),
        cals:  ts.reduce((s,t) => s + calcCaloriesBurned(t.distance, t.duration, type, weightKg), 0) };
    }), [store.territories, heightCm, weightKg]);

  const R = 50; const circumference = 2*Math.PI*R;
  const ringValue = isCycle ? todayDist/1000 : todaySteps;
  const ringGoal = isCycle ? DAILY_DIST_GOAL_KM : DAILY_STEP_GOAL;
  const ringProgress = Math.min(1, ringGoal>0 ? ringValue/ringGoal : 0);
  const ringMainLabel = isCycle ? `${(todayDist/1000).toFixed(1)}` : (todaySteps>0 ? todaySteps.toLocaleString() : '0');
  const ringUnit = isCycle ? 'km today' : 'steps today';
  const ringGoalText = isCycle ? `goal: ${DAILY_DIST_GOAL_KM} km` : `goal: ${DAILY_STEP_GOAL.toLocaleString()}`;
  const ringColor = actFilter==='run'?'#ef4444':actFilter==='walk'?'#10b981':actFilter==='cycle'?'#0ea5e9':'#0284c7';
  const ringTrack = actFilter==='run'?'#fee2e2':actFilter==='walk'?'#dcfce7':actFilter==='cycle'?'#e0f2fe':'#dbeafe';

  const maxBar = Math.max(...barData.map(d=>d.value), 1);
  const barCount = barData.length;
  const barW = Math.floor((CHART_W-(barCount+1)*6)/barCount);
  const gap = (CHART_W-barCount*barW)/(barCount+1);
  const goalLineY = period==='daily' ? CHART_BASELINE-(chartGoal/Math.max(maxBar,chartGoal))*MAX_BAR_H : null;
  const chartLabel = period==='daily'?(isCycle?'km per day':'steps per day'):period==='weekly'?(isCycle?'km per week':'steps per week'):(isCycle?'km per month':'steps per month');

  const FILTER_CFG = [{key:'all',label:'All'},{key:'run',label:'Run'},{key:'walk',label:'Walk'},{key:'cycle',label:'Cycle'}] as const;
  const PERIOD_CFG = [{key:'daily',label:'Daily'},{key:'weekly',label:'Weekly'},{key:'monthly',label:'Monthly'}] as const;
  const ACT_CARD_CFG = [
    {type:'run'   as ActivityType, label:'Run',   accent:'#ef4444', bg:'#fff1f2', hasSteps:true,  Icon: Zap       },
    {type:'walk'  as ActivityType, label:'Walk',  accent:'#10b981', bg:'#f0fdf4', hasSteps:true,  Icon: Footprints},
    {type:'cycle' as ActivityType, label:'Cycle', accent:'#0ea5e9', bg:'#f0f9ff', hasSteps:false, Icon: Bike      },
  ];

  return (
    <div className={styles.page}>

      {/* 1. HEADER + WEEKLY CALENDAR */}
      <div className={styles.header} style={{ background: todCfg.bg }}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <p className={styles.todGreeting}>{todCfg.greeting}</p>
            <h1 className={styles.headerName}>{user.name.split(' ')[0]}</h1>
            <p className={styles.headerDate}>{todayStr}</p>
          </div>
          <div className={styles.weatherWidget}>
            <WeatherScene hour={hour} weather={weather} />
            <div className={styles.weatherInfo}>
              {weather
                ? <>
                    <span className={styles.weatherTemp}>{weather.temp}°</span>
                    <span className={styles.weatherCond}>{weather.condition}</span>
                  </>
                : <span className={styles.weatherTemp} style={{ opacity: 0.3 }}>—</span>
              }
            </div>
          </div>
        </div>
        <div className={styles.weekStrip}>
          {calendarDays.map((day, i) => (
            <div key={i} className={styles.weekDay}>
              <span className={styles.weekLabel}>{day.dayLabel}</span>
              <div className={[styles.weekDateCircle, day.isToday ? styles.weekDateToday : ''].join(' ')}>
                <span className={styles.weekDateNum}>{day.dateNum}</span>
              </div>
              <div className={day.active ? styles.weekDotActive : styles.weekDot} />
            </div>
          ))}
          <div className={styles.weekSummary}>
            <span className={styles.weekSummaryNum}>{activeDaysCount}</span>
            <span className={styles.weekSummaryLbl}>active</span>
          </div>
        </div>
      </div>

      {/* 2. ACTIVITY FILTER */}
      <div className={styles.filterWrap}>
        <div className={styles.filterRow}>
          {FILTER_CFG.map(({ key, label }) => (
            <button key={key}
              className={actFilter===key ? styles.filterTabActive : styles.filterTab}
              style={actFilter===key ? { background: ringColor, boxShadow: `0 1px 6px ${ringColor}66` } : undefined}
              onClick={() => setActFilter(key as ActivityFilter)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. RING + TODAY METRICS */}
      <div className={styles.ringSection}>
        <div className={styles.ringWrap}>
          <svg viewBox="0 0 120 120" className={styles.ringSvg}>
            <circle cx="60" cy="60" r={R} fill="none" stroke={ringTrack} strokeWidth="11" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={ringColor} strokeWidth="11"
              strokeLinecap="round" strokeDasharray={circumference}
              strokeDashoffset={circumference*(1-ringProgress)} transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }} />
            <text x="60" y="53" textAnchor="middle" dominantBaseline="auto"
              fontSize="20" fontWeight="800" fill={ringColor} letterSpacing="-1"
              style={{ transition: 'fill 0.3s ease', fontFamily: 'inherit' }}>
              {ringMainLabel}
            </text>
            <text x="60" y="63" textAnchor="middle" dominantBaseline="auto"
              fontSize="7" fontWeight="600" fill="#a1a1aa"
              style={{ fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {ringUnit.toUpperCase()}
            </text>
            <text x="60" y="76" textAnchor="middle" dominantBaseline="auto"
              fontSize="12" fontWeight="700" fill={ringColor}
              style={{ transition: 'fill 0.3s ease', fontFamily: 'inherit' }}>
              {Math.round(ringProgress*100)}%
            </text>
            <text x="60" y="85" textAnchor="middle" dominantBaseline="auto"
              fontSize="7" fontWeight="500" fill="#a1a1aa"
              style={{ fontFamily: 'inherit' }}>
              {ringGoalText}
            </text>
          </svg>
        </div>
        <div className={styles.todayMetrics}>
          <div className={styles.todayMetric}>
            <Flame size={16} strokeWidth={2.5} style={{ color: '#f59e0b' }} />
            <div className={styles.tmText}><span className={styles.tmVal}>{todayCals>0?todayCals.toLocaleString():'—'}</span><span className={styles.tmLbl}>Calories</span></div>
          </div>
          <div className={styles.todayMetric}>
            <TrendingUp size={16} strokeWidth={2.5} style={{ color: '#0284c7' }} />
            <div className={styles.tmText}><span className={styles.tmVal}>{formatDistance(todayDist)}</span><span className={styles.tmLbl}>Distance</span></div>
          </div>
          <div className={styles.todayMetric}>
            <Clock size={16} strokeWidth={2.5} style={{ color: '#7c3aed' }} />
            <div className={styles.tmText}><span className={styles.tmVal}>{todayDuration>0?formatDuration(todayDuration):'—'}</span><span className={styles.tmLbl}>Active</span></div>
          </div>
          <div className={styles.todayMetric}>
            <MapPin size={16} strokeWidth={2.5} style={{ color: '#10b981' }} />
            <div className={styles.tmText}><span className={styles.tmVal}>{todayTs.length}</span><span className={styles.tmLbl}>Zones</span></div>
          </div>
        </div>
      </div>

      {/* 4. ACTIVITY BREAKDOWN CARDS */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>By Activity</p>
        <div className={styles.actList}>
          {ACT_CARD_CFG.map(cfg => {
            const bd = activityBreakdown.find(b => b.type===cfg.type)!;
            const totalCount = activityBreakdown.reduce((s, b) => s + b.count, 0);
            const pct = totalCount > 0 ? Math.round((bd.count / totalCount) * 100) : 0;
            return (
              <div key={cfg.type} className={styles.actCard}
                style={{ '--act-accent': cfg.accent, background: cfg.bg } as React.CSSProperties}>
                <div className={styles.actCardTop}>
                  <div className={styles.actCardIconWrap} style={{ background: cfg.accent + '18' }}>
                    <cfg.Icon size={22} strokeWidth={2} color={cfg.accent} />
                  </div>
                  <div className={styles.actCardMeta}>
                    <span className={styles.actCardLabel}>{cfg.label}</span>
                    <span className={styles.actCardCount}>{bd.count}<span className={styles.actCardCountLbl}> sessions</span></span>
                  </div>
                  <div className={styles.actCardDistCol}>
                    <span className={styles.actCardDistVal}>{formatDistance(bd.dist)}</span>
                    <span className={styles.actCardDistLbl}>distance</span>
                  </div>
                </div>
                <div className={styles.actCardStatsRow}>
                  <div className={styles.actStatChip}>
                    <span className={styles.actStatVal}>{bd.cals > 0 ? bd.cals.toLocaleString() : '—'}</span>
                    <span className={styles.actStatLbl}>kcal</span>
                  </div>
                  {cfg.hasSteps && (
                    <div className={styles.actStatChip}>
                      <span className={styles.actStatVal}>{bd.steps > 0 ? (bd.steps >= 1000 ? `${(bd.steps/1000).toFixed(1)}k` : bd.steps) : '—'}</span>
                      <span className={styles.actStatLbl}>steps</span>
                    </div>
                  )}
                  <div className={styles.actStatChip}>
                    <span className={styles.actStatVal}>{bd.dur > 0 ? formatDuration(bd.dur) : '—'}</span>
                    <span className={styles.actStatLbl}>active</span>
                  </div>
                  <div className={styles.actStatPct} style={{ background: cfg.accent + '18' }}>
                    <span className={styles.actStatVal} style={{ color: cfg.accent }}>{pct}%</span>
                    <span className={styles.actStatLbl} style={{ color: cfg.accent + 'bb' }}>of total</span>
                  </div>
                </div>
                <div className={styles.actProgress}>
                  <div className={styles.actProgressFill} style={{ width: `${pct}%`, background: cfg.accent }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. DAILY/WEEKLY/MONTHLY + BAR CHART */}
      <div className={styles.section}>
        <div className={styles.periodTabsRow}>
          {PERIOD_CFG.map(({ key, label }) => (
            <button key={key}
              className={period===key ? styles.periodTabActive : styles.periodTab}
              style={period===key ? { background: ringColor, boxShadow: `0 1px 6px ${ringColor}66` } : undefined}
              onClick={() => setPeriod(key as Period)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.chartCard}>
          <div className={styles.periodStats}>
            <div className={styles.pStat}>
              {isCycle ? (<><span className={styles.pStatVal}>{periodTs.length}</span><span className={styles.pStatLbl}>Sessions</span></>) : (<><span className={styles.pStatVal}>{periodSteps>0?periodSteps.toLocaleString():'—'}</span><span className={styles.pStatLbl}>Steps</span></>)}
            </div>
            <div className={styles.pStat}><span className={styles.pStatVal}>{periodCals>0?periodCals.toLocaleString():'—'}</span><span className={styles.pStatLbl}>Calories</span></div>
            <div className={styles.pStat}><span className={styles.pStatVal}>{formatDistance(periodDist)}</span><span className={styles.pStatLbl}>Distance</span></div>
            <div className={styles.pStat}><span className={styles.pStatVal}>{periodDuration>0?formatDuration(periodDuration):'—'}</span><span className={styles.pStatLbl}>Active</span></div>
          </div>
          <div className={styles.barChartWrap}>
            <p className={styles.chartMetricLabel}>{chartLabel}</p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_BASELINE+6}`} className={styles.barSvg} preserveAspectRatio="xMidYMax meet">
              {goalLineY !== null && goalLineY > 4 && (
                <line x1="0" y1={goalLineY} x2={CHART_W} y2={goalLineY} stroke={ringColor} strokeWidth="1" strokeDasharray="5 4" opacity="0.5" />
              )}
              {barData.map((bar, i) => {
                const h = maxBar>0 ? Math.max(4,(bar.value/maxBar)*MAX_BAR_H) : 4;
                const x = gap+i*(barW+gap); const y = CHART_BASELINE-h;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={barW} height={h} rx="4" fill={ringColor} opacity={bar.isToday?1:bar.value>0?0.5:0.12} />
                    {bar.value>0 && (
                      <text x={x+barW/2} y={y-3} textAnchor="middle" fontSize="7" fill={ringColor} opacity={bar.isToday?1:0.75} fontWeight="700">
                        {chartMode==='distance' ? bar.value.toFixed(1) : bar.value>=1000?`${(bar.value/1000).toFixed(1)}k`:bar.value}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className={styles.barLabels}>
              {barData.map((bar, i) => (
                <span key={i} className={bar.isToday?styles.barLabelActive:styles.barLabel} style={bar.isToday?{color:ringColor}:undefined}>{bar.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6. TERRITORIES */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Territories</span>
          {store.territories.length>0 && <span className={styles.sectionBadge}>{store.territories.length}</span>}
        </div>
        {store.territories.length===0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIconWrap}><ActivityIcon size={28} strokeWidth={1.5} /></div>
            <p className={styles.emptyTitle}>No territories yet</p>
            <p className={styles.emptyText}>Head to the Map tab, tap Start Run and walk a loop to claim your first territory.</p>
          </div>
        ) : (
          store.territories.map(t => <TerritoryCard key={t.id} territory={t} onClick={store.selectTerritory} />)
        )}
      </div>

      {selectedTerritory && (
        <Modal open={!!store.selectedId} onClose={() => store.selectTerritory(null)} title={selectedTerritory.name}>
          <TerritoryDetails territory={selectedTerritory}
            onDelete={(id) => { store.removeTerritory(id); store.selectTerritory(null); }}
            onUpdate={store.updateTerritory} />
        </Modal>
      )}
    </div>
  );
}
