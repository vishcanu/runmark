import { useMemo, useState, useEffect } from "react";
import {
  Building2, Trophy, Map, TrendingUp, Clock, Check, LogOut, Mail,
  Flame, Zap, Wind, Droplets, Star, Activity, Bike, Footprints, Heart, Target, Pencil,
} from "lucide-react";
import { useTerritoryStore } from "../../features/territory/hooks/useTerritoryStore";
import { useUserProfile, saveUserProfile, syncProfileFromRemote } from "../../hooks/useUserProfile";
import { useSiegeCharges } from "../../hooks/useSiegeCharges";
import { formatDistance, formatDuration } from "../../features/map/utils/geo";
import {
  calcCaloriesBurned, calcBMR, calcTDEE, idealWeightRange,
  getBMILabel, maxHeartRate, getActivityMultiplier,
} from "../../features/activity/utils/health";
import { computeDailyStreak } from "../../features/territory/utils/territoryTier";
import { supabase } from "../../lib/supabase";
import type { ActivityType } from "../../types";
import { SIEGE_MAX } from "../../types";
import styles from "./Profile.module.css";

// ── Achievements config ───────────────────────────────────────
const ACHIEVEMENTS: {
  label: string;
  desc: string;
  icon: React.ReactNode;
  key: "territories" | "buildings" | "distance" | "points" | "streak";
  target: number;
}[] = [
  { label: "First Steps",   desc: "Complete your first run",    icon: <Footprints size={15} strokeWidth={2} />, key: "territories", target: 1     },
  { label: "Land Grabber",  desc: "Own 5 territories",          icon: <Map        size={15} strokeWidth={2} />, key: "territories", target: 5     },
  { label: "Architect",     desc: "Place 50 buildings",         icon: <Building2  size={15} strokeWidth={2} />, key: "buildings",   target: 50    },
  { label: "Marathoner",    desc: "Cover 10 km total",          icon: <TrendingUp size={15} strokeWidth={2} />, key: "distance",    target: 10000 },
  { label: "Point Hoarder", desc: "Earn 10,000 points",         icon: <Trophy     size={15} strokeWidth={2} />, key: "points",      target: 10000 },
  { label: "Daily Grind",   desc: "Maintain a 7-day streak",    icon: <Flame      size={15} strokeWidth={2} />, key: "streak",      target: 7     },
];

// ── Siege powers config ───────────────────────────────────────
const SIEGE_POWERS: {
  key: keyof typeof SIEGE_MAX;
  label: string;
  icon: React.ReactNode;
  color: string;
  hint: string;
}[] = [
  { key: "inferno", label: "Inferno", icon: <Flame    size={14} strokeWidth={2} />, color: "#ef4444", hint: "Earned per km covered"        },
  { key: "cyclone", label: "Cyclone", icon: <Wind     size={14} strokeWidth={2} />, color: "#8b5cf6", hint: "Earned per session"            },
  { key: "tremor",  label: "Tremor",  icon: <Zap      size={14} strokeWidth={2} />, color: "#f59e0b", hint: "Earned revisiting territories"  },
  { key: "deluge",  label: "Deluge",  icon: <Droplets size={14} strokeWidth={2} />, color: "#0ea5e9", hint: "Earned by daily streak"         },
  { key: "vortex",  label: "Vortex",  icon: <Star     size={14} strokeWidth={2} />, color: "#6366f1", hint: "Earned at every 5 territories"  },
];

function formatAchieveProgress(
  key: string,
  val: number,
  target: number,
  fmtDist: typeof formatDistance,
): string {
  if (key === "distance") return `${fmtDist(Math.min(val, target))} / ${fmtDist(target)}`;
  if (key === "points")   return `${Math.min(val, target).toLocaleString()} / ${target.toLocaleString()}`;
  if (key === "streak")   return `${Math.min(val, target)} / ${target} days`;
  return `${Math.min(val, target)} / ${target}`;
}

export function Profile() {
  const store  = useTerritoryStore();
  const user   = useUserProfile();
  const { charges, loaded: chargesLoaded } = useSiegeCharges();

  // ── Local mutable health state (supports in-page weight/age updates) ──
  const [localHealth, setLocalHealth] = useState(() => user.health);
  const [editOpen,    setEditOpen]    = useState(false);
  const [editWeight,  setEditWeight]  = useState('');
  const [editAge,     setEditAge]     = useState('');

  // Backfill from Supabase if localStorage was empty (e.g. new device / cleared storage)
  useEffect(() => {
    const { weightKg, heightCm, age } = localHealth;
    if (weightKg && heightCm && age) return;
    syncProfileFromRemote().then((remote) => {
      if (remote) setLocalHealth((prev) => ({ ...prev, ...remote }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backfill from Supabase if localStorage was empty (e.g. new device / cleared storage)
  useEffect(() => {
    const { weightKg, heightCm, age } = localHealth;
    if (weightKg && heightCm && age) return;
    syncProfileFromRemote().then((remote) => {
      if (remote) setLocalHealth((prev) => ({ ...prev, ...remote }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Aggregate totals ──────────────────────────────────────
  const totalDistance  = store.territories.reduce((s, t) => s + t.distance, 0);
  const totalDuration  = store.territories.reduce((s, t) => s + t.duration, 0);
  const totalBuildings = store.territories.reduce((s, t) => s + t.buildings.length, 0);
  const totalPoints    = store.territories.reduce((s, t) => s + (t.points ?? 0), 0);
  const totalRuns      = store.territories.reduce((s, t) => s + (t.runs  || 0), 0);

  // ── Level ────────────────────────────────────────────────
  const level          = Math.floor(totalDistance / 1000) + 1;
  const progressToNext = (totalDistance % 1000) / 10; // 0–100 %

  // ── Global streak ────────────────────────────────────────
  const globalStreak = useMemo(() => {
    const allDays: number[] = [];
    store.territories.forEach((t) =>
      (t.visitDays ?? [t.createdAt]).forEach((d) => allDays.push(d)),
    );
    return allDays.length > 0 ? computeDailyStreak(allDays) : 0;
  }, [store.territories]);

  // ── Calories ────────────────────────────────────────────
  const totalCalories = useMemo(() => {
    return store.territories.reduce((sum, t) => {
      if (t.runLog && t.runLog.length > 0) {
        return sum + t.runLog.reduce(
          (s, r) => s + calcCaloriesBurned(r.dist, r.dur, r.type, localHealth.weightKg),
          0,
        );
      }
      return sum + calcCaloriesBurned(t.distance, t.duration, t.activityType ?? "walk", localHealth.weightKg);
    }, 0);
  }, [store.territories, localHealth.weightKg]);

  // ── Activity breakdown ───────────────────────────────────
  const activityBreakdown = useMemo(() => {
    const bd = {
      run:   { count: 0, dist: 0 },
      walk:  { count: 0, dist: 0 },
      cycle: { count: 0, dist: 0 },
    };
    store.territories.forEach((t) => {
      if (t.runLog && t.runLog.length > 0) {
        t.runLog.forEach((r) => {
          const type = (r.type ?? "walk") as ActivityType;
          bd[type].count++;
          bd[type].dist += r.dist;
        });
      } else {
        const type = (t.activityType ?? "walk") as ActivityType;
        bd[type].count += t.runs || 1;
        bd[type].dist  += t.distance;
      }
    });
    return bd;
  }, [store.territories]);

  const totalActivityDist =
    activityBreakdown.run.dist + activityBreakdown.walk.dist + activityBreakdown.cycle.dist;

  // ── BMI ─────────────────────────────────────────────────
  const bmi = useMemo(() => {
    const { weightKg, heightCm } = localHealth;
    if (!weightKg || !heightCm) return null;
    const h = heightCm / 100;
    return Math.round((weightKg / (h * h)) * 10) / 10;
  }, [localHealth]);

  const bmiInfo  = bmi != null ? getBMILabel(bmi) : null;
  const bmiLabel = bmiInfo?.label ?? null;
  const bmiColor = bmiInfo?.color ?? 'var(--color-accent-primary)';

  // ── Derived health metrics ───────────────────────────────
  const bmr = useMemo(() => {
    const { weightKg, heightCm, age, gender } = localHealth;
    if (!weightKg || !heightCm || !age) return null;
    return calcBMR(weightKg, heightCm, age, gender ?? 'other');
  }, [localHealth]);

  // ── Sessions per week → dynamic activity level for TDEE ───────────
  const sessionsPerWeek = useMemo(() => {
    if (totalRuns === 0) return 0;
    const allTs: number[] = [];
    store.territories.forEach((t) => {
      if (t.runLog && t.runLog.length > 0) t.runLog.forEach((r) => allTs.push(r.ts));
      else allTs.push(t.createdAt);
    });
    if (allTs.length === 0) return 0;
    const earliest    = Math.min(...allTs);
    const weeksSince  = Math.max(1, (Date.now() - earliest) / (7 * 24 * 60 * 60 * 1000));
    return totalRuns / weeksSince;
  }, [store.territories, totalRuns]);

  const activityInfo = getActivityMultiplier(sessionsPerWeek);
  const tdee         = bmr != null ? calcTDEE(bmr, activityInfo.multiplier) : null;
  const idealRange   = localHealth.heightCm ? idealWeightRange(localHealth.heightCm) : null;
  const maxHR        = localHealth.age ? maxHeartRate(localHealth.age) : null;

  // ── Calorie goal chips — driven by BMI category ─────────
  const calorieGoalConfig = useMemo(() => {
    if (tdee == null) return null;
    const chip = (label: string, delta: number, highlight = false) =>
      ({ label, kcal: tdee + delta, highlight });
    // No BMI data
    if (bmi == null) return {
      iconBg: '#dcfce7', iconColor: '#22c55e',
      desc: `${activityInfo.label} · pick your goal below`,
      warning: null as string | null,
      chips: [chip('Lose weight', -400), chip('Maintain', 0, true), chip('Build muscle', +250)],
    };
    // Critically underweight
    if (bmi < 16) return {
      iconBg: '#fef3c7', iconColor: '#f59e0b',
      desc: `${activityInfo.label} · you need to gain weight`,
      warning: 'BMI is critically low — consult a doctor first' as string | null,
      chips: [chip('Gain weight', +500, true), chip('Slow gain', +250), chip('Maintain', 0)],
    };
    // Underweight
    if (bmi < 18.5) return {
      iconBg: '#fef3c7', iconColor: '#f59e0b',
      desc: `${activityInfo.label} · focus on gaining weight`,
      warning: null as string | null,
      chips: [chip('Gain weight', +400, true), chip('Slow gain', +200), chip('Maintain', 0)],
    };
    // Normal
    if (bmi < 25) return {
      iconBg: '#dcfce7', iconColor: '#22c55e',
      desc: `${activityInfo.label} · healthy weight, pick your goal`,
      warning: null as string | null,
      chips: [chip('Lose fat', -300), chip('Maintain', 0, true), chip('Build muscle', +250)],
    };
    // Overweight
    if (bmi < 30) return {
      iconBg: '#fff7ed', iconColor: '#f97316',
      desc: `${activityInfo.label} · aim to lose weight gradually`,
      warning: null as string | null,
      chips: [chip('Lose weight', -400, true), chip('Gentle loss', -200), chip('Maintain', 0)],
    };
    // Obese class I
    if (bmi < 35) return {
      iconBg: '#fee2e2', iconColor: '#ef4444',
      desc: `${activityInfo.label} · weight loss recommended`,
      warning: null as string | null,
      chips: [chip('Lose weight', -500, true), chip('Gentle loss', -300), chip('Maintain', 0)],
    };
    // Obese class II+
    return {
      iconBg: '#fee2e2', iconColor: '#ef4444',
      desc: `${activityInfo.label} · weight loss strongly recommended`,
      warning: 'High BMI — consult a doctor before making diet changes' as string | null,
      chips: [chip('Lose weight', -500, true), chip('Gentle loss', -300), chip('Maintain', 0)],
    };
  }, [bmi, tdee, activityInfo]);

  // ── Achievement values ───────────────────────────────────
  const achieveValues = {
    territories: store.territories.length,
    buildings:   totalBuildings,
    distance:    totalDistance,
    points:      totalPoints,
    streak:      globalStreak,
  };

  const hasHealth = !!(localHealth.age || localHealth.weightKg || localHealth.heightCm);

  function handleSaveHealth() {
    const w = parseFloat(editWeight);
    const a = parseInt(editAge, 10);
    const updated = { ...localHealth };
    if (!isNaN(w) && w > 0) updated.weightKg = w;
    if (!isNaN(a) && a > 0) updated.age = a;
    setLocalHealth(updated);
    saveUserProfile(user.name, user.color, updated);
    setEditOpen(false);
  }

  return (
    <div className={styles.page}>

      {/* ── Hero ──────────────────────────────────────────── */}
      <div
        className={styles.hero}
        style={{
          backgroundImage: `linear-gradient(180deg, ${user.color}12 0%, transparent 60%)`,
        } as React.CSSProperties}
      >
        <div className={styles.avatarRing} style={{ background: user.color }}>
          <div className={styles.avatar} style={{ background: user.color }}>
            <span className={styles.avatarInitial}>{user.initial}</span>
          </div>
        </div>
        <h1 className={styles.heroName}>{user.name}</h1>
        {user.email && (
          <div className={styles.heroEmail}>
            <Mail size={11} strokeWidth={2} />
            {user.email}
          </div>
        )}
        <div className={styles.levelRow}>
          <div className={styles.levelBadge}>
            <Trophy size={10} strokeWidth={2.5} />
            Level {level}
          </div>
          <span className={styles.levelDot}>·</span>
          <span className={styles.xpChip}>{totalPoints.toLocaleString()} pts</span>
        </div>

        {/* XP bar lives inside the hero — no repeated level text */}
        <div className={styles.heroXp}>
          <div className={styles.xpRow}>
            <span className={styles.xpText}>Progress to level {level + 1}</span>
            <span className={styles.xpPct}>{Math.round(progressToNext)}%</span>
          </div>
          <div className={styles.xpTrack}>
            <div
              className={styles.xpFill}
              style={{ width: `${Math.min(progressToNext, 100)}%` }}
            />
          </div>
          <span className={styles.xpHint}>
            {formatDistance(Math.max(0, 1000 - (totalDistance % 1000)))} to next level
          </span>
        </div>
      </div>

      {/* ── Health profile (top) ──────────────────────────── */}
      {hasHealth && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Health Profile</div>
          <div className={styles.healthCard}>

            {/* ── Enhanced BMI with gauge ── */}
            {bmi != null && (
              <div className={styles.bmiSection}>
                <div className={styles.bmiTopRow}>
                  <div className={styles.bmiLeft}>
                    <span className={styles.bmiValue} style={{ color: bmiColor }}>{bmi}</span>
                    <div className={styles.bmiLabels}>
                      <span className={styles.bmiStatus} style={{ color: bmiColor }}>{bmiLabel}</span>
                      <span className={styles.bmiSubtitle}>Body Mass Index</span>
                    </div>
                  </div>
                  {idealRange && (
                    <div className={styles.bmiIdealBlock}>
                      <span className={styles.bmiIdealVal}>{idealRange.min}–{idealRange.max} kg</span>
                      <span className={styles.bmiIdealLabel}>Ideal weight</span>
                    </div>
                  )}
                </div>
                <div className={styles.bmiGaugeWrap}>
                  <div className={styles.bmiGaugeBar}>
                    <div
                      className={styles.bmiGaugePin}
                      style={{ left: `${Math.min(97, Math.max(3, ((bmi - 15) / 25) * 100))}%` }}
                    />
                  </div>
                  <div className={styles.bmiGaugeScale}>
                    <span>Under</span>
                    <span style={{ color: "#22c55e" }}>Healthy</span>
                    <span>Over</span>
                    <span>Obese</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Body stats grid ── */}
            <div className={styles.healthSubHeader}>
              <span className={styles.healthSubLabel}>Measurements</span>
              <button
                className={styles.editHealthBtn}
                onClick={() => {
                  setEditWeight(localHealth.weightKg ? String(localHealth.weightKg) : '');
                  setEditAge(localHealth.age ? String(localHealth.age) : '');
                  setEditOpen((o) => !o);
                }}
              >
                <Pencil size={11} strokeWidth={2} />
                {editOpen ? 'Cancel' : 'Update'}
              </button>
            </div>
            <div className={styles.healthGrid}>
              {localHealth.age && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal}>{localHealth.age}</span>
                  <span className={styles.healthItemLabel}>Age</span>
                </div>
              )}
              {localHealth.weightKg && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal}>{localHealth.weightKg}</span>
                  <span className={styles.healthItemLabel}>Weight kg</span>
                </div>
              )}
              {localHealth.heightCm && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal}>{localHealth.heightCm}</span>
                  <span className={styles.healthItemLabel}>Height cm</span>
                </div>
              )}
              {localHealth.gender && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal} style={{ textTransform: "capitalize" }}>
                    {localHealth.gender}
                  </span>
                  <span className={styles.healthItemLabel}>Gender</span>
                </div>
              )}
            </div>
            {editOpen && (
              <div className={styles.editHealthPanel}>
                <div className={styles.editHealthRow}>
                  <label className={styles.editHealthLabel}>Weight (kg)</label>
                  <input
                    className={styles.editHealthInput}
                    type="number"
                    value={editWeight}
                    onChange={e => setEditWeight(e.target.value)}
                    placeholder="kg"
                    min={20}
                    max={300}
                  />
                </div>
                <div className={styles.editHealthRow}>
                  <label className={styles.editHealthLabel}>Age (years)</label>
                  <input
                    className={styles.editHealthInput}
                    type="number"
                    value={editAge}
                    onChange={e => setEditAge(e.target.value)}
                    placeholder="years"
                    min={10}
                    max={120}
                  />
                </div>
                <div className={styles.editHealthActions}>
                  <button className={styles.editHealthSave} onClick={handleSaveHealth}>
                    Save changes
                  </button>
                </div>
              </div>
            )}

            {/* ── 3-col metric summary + TDEE row ── */}
            {(bmr != null || maxHR != null) && (
              <div className={styles.insightList}>

                {/* compact 3-column grid: at-rest cal | max HR | activity cal */}
                <div className={styles.metricGrid}>
                  {bmr != null && (
                    <div className={styles.metricCell}>
                      <div className={styles.metricIcon} style={{ background: "#fef3c7" }}>
                        <Flame size={14} strokeWidth={2} style={{ color: "#f59e0b" }} />
                      </div>
                      <span className={styles.metricNum}>{bmr.toLocaleString()}</span>
                      <span className={styles.metricUnit}>kcal/day</span>
                      <span className={styles.metricLabel}>Calories at rest</span>
                    </div>
                  )}
                  {maxHR != null && (
                    <div className={styles.metricCell}>
                      <div className={styles.metricIcon} style={{ background: "#fee2e2" }}>
                        <Heart size={14} strokeWidth={2} style={{ color: "#ef4444" }} />
                      </div>
                      <span className={styles.metricNum}>{maxHR}</span>
                      <span className={styles.metricUnit}>bpm</span>
                      <span className={styles.metricLabel}>Max heart rate</span>
                    </div>
                  )}
                  {totalCalories > 0 ? (
                    <div className={styles.metricCell}>
                      <div className={styles.metricIcon} style={{ background: "#fff7ed" }}>
                        <Zap size={14} strokeWidth={2} style={{ color: "#f97316" }} />
                      </div>
                      <span className={styles.metricNum}>
                        {totalCalories > 9999
                          ? `${(totalCalories / 1000).toFixed(1)}k`
                          : totalCalories.toLocaleString()}
                      </span>
                      <span className={styles.metricUnit}>kcal total</span>
                      <span className={styles.metricLabel}>Activity burn</span>
                    </div>
                  ) : (
                    <div className={styles.metricCell}>
                      <div className={styles.metricIcon} style={{ background: "var(--color-bg-primary)" }}>
                        <Zap size={14} strokeWidth={2} style={{ color: "var(--color-text-muted)" }} />
                      </div>
                      <span className={styles.metricNumEmpty}>—</span>
                      <span className={styles.metricUnit}>kcal total</span>
                      <span className={styles.metricLabel}>Activity burn</span>
                      <span className={styles.metricHint}>Start a run!</span>
                    </div>
                  )}
                </div>

                {/* TDEE full-width row with BMI-aware calorie goal chips */}
                {calorieGoalConfig != null && (
                  <div className={[styles.insightRow, styles.insightRowExpanded].join(' ')}>
                    <div className={styles.insightIcon} style={{ background: calorieGoalConfig.iconBg }}>
                      <Target size={14} strokeWidth={2} style={{ color: calorieGoalConfig.iconColor }} />
                    </div>
                    <div className={styles.insightBody}>
                      <div className={styles.insightTitleRow}>
                        <span className={styles.insightTitle}>Daily calorie need</span>
                        <span className={styles.insightNumInline}>{tdee!.toLocaleString()} kcal</span>
                      </div>
                      <span className={styles.insightDesc}>{calorieGoalConfig.desc}</span>
                      {calorieGoalConfig.warning && (
                        <span className={styles.calorieWarning}>{calorieGoalConfig.warning}</span>
                      )}
                      <div className={styles.calorieGoals}>
                        {calorieGoalConfig.chips.map((c) => (
                          <div
                            key={c.label}
                            className={[styles.calorieGoalChip, c.highlight ? styles.calorieGoalMaintain : ''].filter(Boolean).join(' ')}
                          >
                            <span className={styles.calorieGoalLabel}>{c.label}</span>
                            <span className={styles.calorieGoalVal}>{c.kcal.toLocaleString()}</span>
                            <span className={styles.calorieGoalUnit}>kcal/day</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Stats</div>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <Map      size={15} strokeWidth={1.75} style={{ color: "var(--color-accent-primary)" }} />
            <span className={styles.statValue}>{store.territories.length}</span>
            <span className={styles.statLabel}>Territories</span>
          </div>
          <div className={styles.statCard}>
            <TrendingUp size={15} strokeWidth={1.75} style={{ color: "var(--color-accent-primary)" }} />
            <span className={styles.statValue}>{formatDistance(totalDistance)}</span>
            <span className={styles.statLabel}>Distance</span>
          </div>
          <div className={styles.statCard}>
            <Clock    size={15} strokeWidth={1.75} style={{ color: "var(--color-accent-primary)" }} />
            <span className={styles.statValue}>{formatDuration(totalDuration)}</span>
            <span className={styles.statLabel}>Time</span>
          </div>
          <div className={styles.statCard}>
            <Trophy   size={15} strokeWidth={1.75} style={{ color: "#f59e0b" }} />
            <span className={styles.statValue}>
              {totalPoints > 9999
                ? `${(totalPoints / 1000).toFixed(1)}k`
                : totalPoints.toLocaleString()}
            </span>
            <span className={styles.statLabel}>Points</span>
          </div>
          <div className={styles.statCard}>
            <Activity size={15} strokeWidth={1.75} style={{ color: "var(--color-accent-primary)" }} />
            <span className={styles.statValue}>{totalRuns}</span>
            <span className={styles.statLabel}>Runs</span>
          </div>
          <div className={styles.statCard}>
            <Flame    size={15} strokeWidth={1.75} style={{ color: "#ef4444" }} />
            <span className={styles.statValue}>
              {totalCalories > 9999
                ? `${(totalCalories / 1000).toFixed(1)}k`
                : totalCalories}
            </span>
            <span className={styles.statLabel}>Calories</span>
          </div>
        </div>
      </div>

      {/* ── Streak & Activity breakdown ────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Activity</div>
        <div className={styles.streakCard}>
          <div className={styles.streakLeft}>
            <Flame size={20} strokeWidth={1.75} className={styles.streakFlame} />
            <span className={styles.streakNum}>{globalStreak}</span>
            <span className={styles.streakLabel}>day streak</span>
          </div>
          <div className={styles.streakDivider} />
          <div className={styles.breakdownCol}>
            {(["run", "walk", "cycle"] as ActivityType[]).map((type) => {
              const data  = activityBreakdown[type];
              const pct   = totalActivityDist > 0 ? (data.dist / totalActivityDist) * 100 : 0;
              const Icon  = type === "run" ? Activity : type === "walk" ? Footprints : Bike;
              const color = type === "run" ? "#ef4444" : type === "walk" ? "#22c55e" : "#f59e0b";
              const label = type === "run" ? "Run" : type === "walk" ? "Walk" : "Cycle";
              return (
                <div key={type} className={styles.breakdownRow}>
                  <Icon size={12} strokeWidth={2} style={{ color, flexShrink: 0 }} />
                  <span className={styles.breakdownLabel}>{label}</span>
                  <div className={styles.breakdownBarWrap}>
                    <div
                      className={styles.breakdownBar}
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <span className={styles.breakdownDist}>{formatDistance(data.dist)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Siege Powers ──────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Siege Powers</div>
        <div className={styles.siegeCard}>
          {SIEGE_POWERS.map(({ key, label, icon, color, hint }) => {
            const current = chargesLoaded ? charges[key] : 0;
            const max     = SIEGE_MAX[key];
            return (
              <div key={key} className={styles.siegeRow}>
                <div className={styles.siegeIconWrap} style={{ background: `${color}18` }}>
                  <span style={{ color }}>{icon}</span>
                </div>
                <div className={styles.siegeInfo}>
                  <span className={styles.siegeName}>{label}</span>
                  <span className={styles.siegeHint}>{hint}</span>
                </div>
                <div className={styles.siegeDots}>
                  {Array.from({ length: max }, (_, i) => (
                    <div
                      key={i}
                      className={[styles.siegeDot, i < current ? styles.siegeDotFilled : ""].filter(Boolean).join(" ")}
                      style={i < current ? { background: color } : undefined}
                    />
                  ))}
                </div>
                <span className={styles.siegeCount} style={{ color }}>
                  {current}/{max}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Achievements ──────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Achievements</div>
        <div className={styles.achievementList}>
          {ACHIEVEMENTS.map((a) => {
            const val  = achieveValues[a.key];
            const done = val >= a.target;
            const pct  = Math.min((val / a.target) * 100, 100);
            return (
              <div
                key={a.label}
                className={[styles.achievement, done ? styles.achievementDone : ""].filter(Boolean).join(" ")}
              >
                <div className={styles.achievementIcon}>{a.icon}</div>
                <div className={styles.achievementBody}>
                  <div className={styles.achievementLabel}>{a.label}</div>
                  <div className={styles.achievementDesc}>{a.desc}</div>
                  {!done && (
                    <div className={styles.achieveProgressWrap}>
                      <div className={styles.achieveProgressTrack}>
                        <div className={styles.achieveProgressFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.achieveProgressText}>
                        {formatAchieveProgress(a.key, val, a.target, formatDistance)}
                      </span>
                    </div>
                  )}
                </div>
                {done && <Check size={15} strokeWidth={2.5} className={styles.achievementCheck} />}
              </div>
            );
          })}
        </div>
      </div>



      {/* ── Sign out ──────────────────────────────────────── */}
      <div className={styles.signOutSection}>
        <button
          className={styles.signOut}
          onClick={() => {
            ["rg_user_id", "rg_user_name", "rg_user_color", "rg_user_age",
              "rg_user_weight", "rg_user_height", "rg_user_gender"]
              .forEach((k) => localStorage.removeItem(k));
            supabase?.auth.signOut();
            window.dispatchEvent(new CustomEvent("app-logout"));
          }}
        >
          <LogOut size={14} strokeWidth={2} />
          Sign Out
        </button>
      </div>

    </div>
  );
}
