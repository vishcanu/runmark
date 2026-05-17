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

// ── Sky + weather scene ────────────────────────────────────────
function WeatherScene({ hour, weather }: { hour: number; weather: WeatherData | null }) {
  // Arc: centre (140,72) radius 54 — sun travels left horizon → top → right horizon
  const h = Math.max(5, Math.min(19, hour));
  const angle = Math.PI * (1 - (h - 5) / 14); // π→0 from 5 am to 7 pm
  const CX = 140, CY = 72, R = 54;
  const bx = CX + R * Math.cos(angle);
  const by = CY - R * Math.sin(angle);
  const bodyVisible = by < 67;

  const isNight   = hour < 5 || hour >= 20;
  const isEvening = hour >= 17 && hour < 20;
  const isMorning = hour >= 5  && hour < 9;
  const cloudy    = !!(weather?.isCloudy);
  const isRain    = weather?.isRain    ?? false;
  const isSnow    = weather?.isSnow    ?? false;
  const isThunder = weather?.isThunder ?? false;
  const sunColor  = isEvening ? '#fb923c' : isMorning ? '#fcd34d' : '#fbbf24';

  return (
    <svg viewBox="0 0 280 72" className={styles.weatherScene} aria-hidden="true">
      {/* arc guide */}
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 5" />

      {/* ── NIGHT ── */}
      {isNight && <>
        <circle cx="155" cy="26" r="14" fill="rgba(240,240,220,0.93)" />
        <circle cx="165" cy="18" r="11" fill="rgba(20,20,55,0.92)" />
        {[[35,14],[55,6],[82,21],[108,9],[200,13],[226,5],[250,20],[263,31]].map(([sx,sy],i) => (
          <circle key={i} cx={sx} cy={sy} r={i%3===0?1.8:1.1} fill="rgba(255,255,255,0.75)" opacity={0.55+0.45*(i%2)} />
        ))}
      </>}

      {/* ── SUN ── */}
      {!isNight && bodyVisible && <>
        {!cloudy && <circle cx={bx} cy={by} r="20" fill={sunColor} opacity="0.16" />}
        {!cloudy && Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <line key={i}
            x1={bx + 16 * Math.cos(a)} y1={by + 16 * Math.sin(a)}
            x2={bx + 24 * Math.cos(a)} y2={by + 24 * Math.sin(a)}
            stroke={sunColor} strokeWidth="2" strokeLinecap="round" opacity="0.85" />;
        })}
        <circle cx={bx} cy={by} r="11" fill={sunColor} opacity={cloudy ? 0.4 : 1} />
      </>}

      {/* ── CLOUDS ── */}
      {cloudy && <>
        <ellipse cx="148" cy="26" rx="29" ry="14" fill="rgba(255,255,255,0.88)" />
        <ellipse cx="171" cy="31" rx="22" ry="12" fill="rgba(255,255,255,0.82)" />
        <ellipse cx="129" cy="32" rx="17" ry="10" fill="rgba(255,255,255,0.76)" />
      </>}
      {!cloudy && !isNight && <>
        <ellipse cx="228" cy="13" rx="16" ry="6" fill="rgba(255,255,255,0.26)" />
        <ellipse cx="50"  cy="18" rx="12" ry="5" fill="rgba(255,255,255,0.20)" />
      </>}

      {/* ── RAIN ── */}
      {isRain && Array.from({ length: 11 }, (_, i) => (
        <line key={i}
          x1={92 + i * 18} y1={44 + (i % 4) * 5}
          x2={89 + i * 18} y2={60 + (i % 4) * 5}
          stroke="rgba(255,255,255,0.60)" strokeWidth="1.5" strokeLinecap="round" />
      ))}

      {/* ── SNOW ── */}
      {isSnow && Array.from({ length: 9 }, (_, i) => (
        <g key={i} transform={`translate(${100 + i * 21},${46 + (i % 3) * 8})`}>
          <line x1="-3" y1="0" x2="3" y2="0" stroke="rgba(255,255,255,0.80)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(255,255,255,0.80)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="-2" y1="-2" x2="2" y2="2" stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeLinecap="round" />
          <line x1="2" y1="-2" x2="-2" y2="2" stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}

      {/* ── THUNDER ── */}
      {isThunder && (
        <polyline points="165,32 158,47 163,47 155,64"
          fill="none" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* ── HORIZON ── */}
      <line x1="0" y1="68" x2="280" y2="68" stroke="rgba(255,255,255,0.20)" strokeWidth="1" />

      {/* ── TEMP + CONDITION ── */}
      {weather ? <>
        <text x="16" y="51" fontSize="8.5" fontWeight="600" fill="rgba(255,255,255,0.60)"
          style={{ fontFamily: 'system-ui,sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {weather.condition}
        </text>
        <text x="16" y="65" fontSize="21" fontWeight="800" fill="rgba(255,255,255,0.95)"
          style={{ fontFamily: 'system-ui,sans-serif', letterSpacing: '-0.03em' }}>
          {weather.temp}°C
        </text>
      </> : (
        <text x="16" y="61" fontSize="11" fill="rgba(255,255,255,0.30)"
          style={{ fontFamily: 'system-ui,sans-serif' }}>—</text>
      )}
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
          <div>
            <p className={styles.todGreeting}>{todCfg.greeting}</p>
            <h1 className={styles.headerName}>{user.name.split(' ')[0]}</h1>
            <p className={styles.headerDate}>{todayStr}</p>
          </div>
          <div className={styles.headerAvatar} style={{ background: user.color }}>{user.initial}</div>
        </div>
        <WeatherScene hour={hour} weather={weather} />
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
          <p className={styles.todayTitle}>Today</p>
          <div className={styles.todayMetric}>
            <Flame size={13} strokeWidth={2.5} style={{ color: '#f59e0b' }} />
            <div className={styles.tmText}><span className={styles.tmVal}>{todayCals>0?todayCals.toLocaleString():'—'}</span><span className={styles.tmLbl}>Calories</span></div>
          </div>
          <div className={styles.todayMetric}>
            <TrendingUp size={13} strokeWidth={2.5} style={{ color: '#0284c7' }} />
            <div className={styles.tmText}><span className={styles.tmVal}>{formatDistance(todayDist)}</span><span className={styles.tmLbl}>Distance</span></div>
          </div>
          <div className={styles.todayMetric}>
            <Clock size={13} strokeWidth={2.5} style={{ color: '#7c3aed' }} />
            <div className={styles.tmText}><span className={styles.tmVal}>{todayDuration>0?formatDuration(todayDuration):'—'}</span><span className={styles.tmLbl}>Active</span></div>
          </div>
          <div className={styles.todayMetric}>
            <MapPin size={13} strokeWidth={2.5} style={{ color: '#10b981' }} />
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
                style={{ '--act-accent': cfg.accent } as React.CSSProperties}>
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
