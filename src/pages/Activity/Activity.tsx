import { useState, useMemo } from 'react';
import { Flame, TrendingUp, Clock, MapPin, Activity as ActivityIcon } from 'lucide-react';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { TerritoryCard } from '../../features/territory/components/TerritoryCard';
import { Modal } from '../../components/Modal/Modal';
import { TerritoryDetails } from '../../features/territory/components/TerritoryDetails';
import { formatDistance, formatDuration } from '../../features/map/utils/geo';
import { useUserProfile } from '../../hooks/useUserProfile';
import type { ActivityType } from '../../types';
import styles from './Activity.module.css';

const DAILY_STEP_GOAL = 8_000;
const DAILY_DIST_GOAL_KM = 10;
const CHART_W = 280;
const CHART_BASELINE = 68;
const MAX_BAR_H = 54;

type Period = 'daily' | 'weekly' | 'monthly';
type ActivityFilter = 'all' | ActivityType;

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function stepsFor(distanceM: number, type: ActivityType): number {
  if (type === 'cycle') return 0;
  return Math.round(distanceM / (type === 'run' ? 0.95 : 0.762));
}
function calsFor(distanceKm: number, type: ActivityType): number {
  return Math.round(distanceKm * (type === 'run' ? 75 : type === 'walk' ? 60 : 30));
}

export function Activity() {
  const store = useTerritoryStore();
  const user = useUserProfile();
  const [period, setPeriod] = useState<Period>('daily');
  const [actFilter, setActFilter] = useState<ActivityFilter>('all');
  const selectedTerritory = store.selectedId ? store.getTerritory(store.selectedId) : null;
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

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

  const todayTs = useMemo(() => filtered.filter(t => t.createdAt >= dayStart), [filtered, dayStart]);
  const todaySteps = useMemo(() => todayTs.reduce((s,t) => s + stepsFor(t.distance, t.activityType ?? 'walk'), 0), [todayTs]);
  const todayCals = useMemo(() => todayTs.reduce((s,t) => s + calsFor(t.distance/1000, t.activityType ?? 'walk'), 0), [todayTs]);
  const todayDist = useMemo(() => todayTs.reduce((s,t) => s + t.distance, 0), [todayTs]);
  const todayDuration = useMemo(() => todayTs.reduce((s,t) => s + t.duration, 0), [todayTs]);

  const periodStart = useMemo(() => {
    if (period === 'daily') return dayStart;
    if (period === 'weekly') return now - 7 * 86_400_000;
    return now - 30 * 86_400_000;
  }, [period, dayStart, now]);
  const periodTs = useMemo(() => filtered.filter(t => t.createdAt >= periodStart), [filtered, periodStart]);
  const periodSteps = useMemo(() => periodTs.reduce((s,t) => s + stepsFor(t.distance, t.activityType ?? 'walk'), 0), [periodTs]);
  const periodCals = useMemo(() => periodTs.reduce((s,t) => s + calsFor(t.distance/1000, t.activityType ?? 'walk'), 0), [periodTs]);
  const periodDist = useMemo(() => periodTs.reduce((s,t) => s + t.distance, 0), [periodTs]);
  const periodDuration = useMemo(() => periodTs.reduce((s,t) => s + t.duration, 0), [periodTs]);

  const barData = useMemo(() => {
    function bv(ts: typeof filtered): number {
      if (chartMode === 'distance') return parseFloat((ts.reduce((s,t) => s+t.distance,0)/1000).toFixed(2));
      return ts.reduce((s,t) => s + stepsFor(t.distance, t.activityType ?? 'walk'), 0);
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
  }, [period, filtered, dayStart, chartMode]);

  const activityBreakdown = useMemo(() =>
    (['run','walk','cycle'] as ActivityType[]).map(type => {
      const ts = store.territories.filter(t => t.activityType === type);
      const dist = ts.reduce((s,t) => s+t.distance, 0);
      return { type, count: ts.length, dist,
        steps: ts.reduce((s,t) => s+stepsFor(t.distance,type),0),
        cals: ts.reduce((s,t) => s+calsFor(t.distance/1000,type),0) };
    }), [store.territories]);

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
    {type:'run' as ActivityType,label:'Run',accent:'#ef4444',bg:'#fff1f2',hasSteps:true},
    {type:'walk' as ActivityType,label:'Walk',accent:'#10b981',bg:'#f0fdf4',hasSteps:true},
    {type:'cycle' as ActivityType,label:'Cycle',accent:'#0ea5e9',bg:'#f0f9ff',hasSteps:false},
  ];

  return (
    <div className={styles.page}>

      {/* 1. HEADER + WEEKLY CALENDAR */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.headerDate}>{todayStr}</p>
            <h1 className={styles.headerName}>Hey, {user.name}</h1>
          </div>
          <div className={styles.headerAvatar} style={{ background: user.color }}>{user.initial}</div>
        </div>
        <div className={styles.weekStrip}>
          {weeklyActive.map((active, i) => (
            <div key={i} className={styles.weekDay}>
              <div className={active ? styles.weekDotActive : styles.weekDot} />
              <span className={styles.weekLabel}>{WEEK_DAYS[i]}</span>
            </div>
          ))}
          <div className={styles.weekSummary}>
            <span className={styles.weekSummaryNum}>{activeDaysCount}</span>
            <span className={styles.weekSummaryLbl}>days</span>
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
        <div className={styles.actGrid}>
          {ACT_CARD_CFG.map(cfg => {
            const bd = activityBreakdown.find(b => b.type===cfg.type)!;
            return (
              <div key={cfg.type} className={styles.actCard}
                style={{ '--act-accent': cfg.accent, '--act-bg': cfg.bg } as React.CSSProperties}>
                <span className={styles.actCardLabel}>{cfg.label}</span>
                <span className={styles.actCardCount}>{bd.count}</span>
                <span className={styles.actCardCountLbl}>sessions</span>
                <div className={styles.actDivider} />
                <div className={styles.actCardStats}>
                  <div className={styles.actStat}><span className={styles.actStatVal}>{formatDistance(bd.dist)}</span><span className={styles.actStatLbl}>km</span></div>
                  <div className={styles.actStat}><span className={styles.actStatVal}>{bd.cals>0?bd.cals.toLocaleString():'—'}</span><span className={styles.actStatLbl}>kcal</span></div>
                  {cfg.hasSteps && (
                    <div className={styles.actStat}>
                      <span className={styles.actStatVal}>{bd.steps>0?(bd.steps>=1000?`${(bd.steps/1000).toFixed(1)}k`:bd.steps):'—'}</span>
                      <span className={styles.actStatLbl}>steps</span>
                    </div>
                  )}
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
