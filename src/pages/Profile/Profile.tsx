import { Building2, Trophy, Map, TrendingUp, Clock, Check, LogOut } from "lucide-react";
import { useTerritoryStore } from "../../features/territory/hooks/useTerritoryStore";
import { useUserProfile } from "../../hooks/useUserProfile";
import { formatDistance, formatDuration } from "../../features/map/utils/geo";
import { supabase } from "../../lib/supabase";
import styles from "./Profile.module.css";

const ACHIEVEMENTS = [
  { label: "First Steps",  desc: "Complete your first run",  test: (v: number) => v >= 1,     key: "territories" as const },
  { label: "Land Grabber", desc: "Own 5 territories",        test: (v: number) => v >= 5,     key: "territories" as const },
  { label: "Architect",    desc: "Generate 50 buildings",    test: (v: number) => v >= 50,    key: "buildings"   as const },
  { label: "Marathoner",   desc: "Walk 10 km total",         test: (v: number) => v >= 10000, key: "distance"    as const },
];

export function Profile() {
  const store = useTerritoryStore();
  const user  = useUserProfile();

  const totalDistance  = store.territories.reduce((s, t) => s + t.distance, 0);
  const totalDuration  = store.territories.reduce((s, t) => s + t.duration, 0);
  const totalBuildings = store.territories.reduce((s, t) => s + t.buildings.length, 0);

  const level          = Math.floor(totalDistance / 1000) + 1;
  const progressToNext = (totalDistance % 1000) / 10;

  const achieveValues = {
    territories: store.territories.length,
    buildings:   totalBuildings,
    distance:    totalDistance,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.avatar} style={{ background: user.color }}>
          <span className={styles.avatarInitial}>{user.initial}</span>
        </div>
        <h1 className={styles.username}>{user.name}</h1>
        <div className={styles.levelBadge}>
          <Trophy size={11} strokeWidth={2.5} />
          Level {level}
        </div>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Progress to Level {level + 1}</span>
          <span className={styles.progressPct}>{Math.round(progressToNext)}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.min(progressToNext, 100)}%` }} />
        </div>
        <span className={styles.progressHint}>
          {formatDistance(Math.max(0, 1000 - (totalDistance % 1000)))} to next level
        </span>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <Map size={18} strokeWidth={1.75} className={styles.statCardIcon} />
          <span className={styles.statCardValue}>{store.territories.length}</span>
          <span className={styles.statCardLabel}>Territories</span>
        </div>
        <div className={styles.statCard}>
          <Building2 size={18} strokeWidth={1.75} className={styles.statCardIcon} />
          <span className={styles.statCardValue}>{totalBuildings}</span>
          <span className={styles.statCardLabel}>Buildings</span>
        </div>
        <div className={[styles.statCard, styles.wideCard].join(" ")}>
          <div className={styles.wideStatRow}>
            <div>
              <TrendingUp size={18} strokeWidth={1.75} className={styles.statCardIcon} />
              <span className={styles.statCardValue}>{formatDistance(totalDistance)}</span>
              <span className={styles.statCardLabel}>Total distance</span>
            </div>
            <div className={styles.wideDivider} />
            <div>
              <Clock size={18} strokeWidth={1.75} className={styles.statCardIcon} />
              <span className={styles.statCardValue}>{formatDuration(totalDuration)}</span>
              <span className={styles.statCardLabel}>Total time</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Achievements</h2>
        <div className={styles.achievementList}>
          {ACHIEVEMENTS.map((a) => {
            const done = a.test(achieveValues[a.key]);
            return (
              <div key={a.label} className={[styles.achievement, done ? styles.achievementDone : ""].filter(Boolean).join(" ")}>
                <div className={styles.achievementIcon}>
                  <Trophy size={15} strokeWidth={2} />
                </div>
                <div className={styles.achievementText}>
                  <div className={styles.achievementLabel}>{a.label}</div>
                  <div className={styles.achievementDesc}>{a.desc}</div>
                </div>
                {done && <Check size={16} strokeWidth={2.5} className={styles.achievementCheck} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.signOutSection}>
        <button
          className={styles.signOut}
          onClick={() => {
            // Clear immediately for instant UI response
            ['rg_user_id','rg_user_name','rg_user_color','rg_user_age','rg_user_weight','rg_user_height','rg_user_gender']
              .forEach((k) => localStorage.removeItem(k));
            // Fire Supabase sign-out in background (no await)
            supabase?.auth.signOut();
            // Instant screen transition
            window.dispatchEvent(new CustomEvent('app-logout'));
          }}
        >
          <LogOut size={15} strokeWidth={2} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
