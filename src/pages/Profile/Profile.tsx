import { useMemo } from "react";
import {
  Building2, Trophy, Map, TrendingUp, Clock, Check, LogOut, Mail,
  Flame, Zap, Wind, Droplets, Star, Activity, Bike, Footprints, Shield,
} from "lucide-react";
import { useTerritoryStore } from "../../features/territory/hooks/useTerritoryStore";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useSiegeCharges } from "../../hooks/useSiegeCharges";
import { formatDistance, formatDuration } from "../../features/map/utils/geo";
import { calcCaloriesBurned } from "../../features/activity/utils/health";
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
          (s, r) => s + calcCaloriesBurned(r.dist, r.dur, r.type, user.health.weightKg),
          0,
        );
      }
      return sum + calcCaloriesBurned(t.distance, t.duration, t.activityType ?? "walk", user.health.weightKg);
    }, 0);
  }, [store.territories, user.health.weightKg]);

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
    const { weightKg, heightCm } = user.health;
    if (!weightKg || !heightCm) return null;
    const h = heightCm / 100;
    return Math.round((weightKg / (h * h)) * 10) / 10;
  }, [user.health]);

  const bmiLabel =
    bmi == null      ? null
    : bmi < 18.5     ? "Underweight"
    : bmi < 25       ? "Healthy"
    : bmi < 30       ? "Overweight"
    :                  "Obese";

  // ── Achievement values ───────────────────────────────────
  const achieveValues = {
    territories: store.territories.length,
    buildings:   totalBuildings,
    distance:    totalDistance,
    points:      totalPoints,
    streak:      globalStreak,
  };

  const hasHealth = !!(user.health.age || user.health.weightKg || user.health.heightCm);

  return (
    <div className={styles.page}>

      {/* ── Hero ──────────────────────────────────────────── */}
      <div
        className={styles.hero}
        style={{ "--user-color": user.color } as React.CSSProperties}
      >
        <div className={styles.heroBg} />
        <div className={styles.avatarRing}>
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
            {bmi != null && (
              <div className={styles.healthBmiRow}>
                <Shield size={14} strokeWidth={2} style={{ color: "var(--color-accent-primary)" }} />
                <div className={styles.healthBmiInner}>
                  <span className={styles.healthBmiValue}>{bmi}</span>
                  <span className={styles.healthBmiLabel}>BMI · {bmiLabel}</span>
                </div>
              </div>
            )}
            <div className={styles.healthGrid}>
              {user.health.age && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal}>{user.health.age}</span>
                  <span className={styles.healthItemLabel}>Age</span>
                </div>
              )}
              {user.health.weightKg && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal}>{user.health.weightKg}</span>
                  <span className={styles.healthItemLabel}>Weight kg</span>
                </div>
              )}
              {user.health.heightCm && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal}>{user.health.heightCm}</span>
                  <span className={styles.healthItemLabel}>Height cm</span>
                </div>
              )}
              {user.health.gender && (
                <div className={styles.healthItem}>
                  <span className={styles.healthItemVal} style={{ textTransform: "capitalize" }}>
                    {user.health.gender}
                  </span>
                  <span className={styles.healthItemLabel}>Gender</span>
                </div>
              )}
            </div>
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
