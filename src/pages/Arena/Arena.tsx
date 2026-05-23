import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Shield, Zap, Flag, Crown, Star, Award, Eye, Target, TrendingUp, Navigation, CheckCircle2 } from 'lucide-react';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { supabase } from '../../lib/supabase';
import { useUserProfile } from '../../hooks/useUserProfile';
import { formatDistance } from '../../features/map/utils/geo';
import styles from './Arena.module.css';

// ── Leaderboard entry type ──────────────────────────────────
interface LeaderEntry {
  id:          string;
  name:        string;
  color:       string;
  territories: number;
  distanceM:   number;
  score:       number;
  isMe:        boolean;
}

// ── Rank system ─────────────────────────────────────────────
type Rank = { title: string; color: string; min: number; max: number; Icon: LucideIcon };
const RANKS: Rank[] = [
  { title: 'Scout',     color: '#64748b', min: 0,  max: 2,  Icon: Eye        },
  { title: 'Raider',    color: '#0284c7', min: 3,  max: 5,  Icon: Zap        },
  { title: 'Warlord',   color: '#7c3aed', min: 6,  max: 10, Icon: Flag       },
  { title: 'Commander', color: '#ea580c', min: 11, max: 20, Icon: Star       },
  { title: 'Overlord',  color: '#dc2626', min: 21, max: Infinity, Icon: Crown },
];
function getRank(territories: number): Rank {
  return RANKS.find(r => territories >= r.min && territories <= r.max) ?? RANKS[0];
}
function siegeScore(territories: number, distanceM: number) {
  return territories * 300 + Math.round(distanceM / 10);
}

// ── Daily challenges (rotate by day of year) ────────────────
type Challenge = { title: string; desc: string; Icon: LucideIcon; goalKm?: number; goalZones?: number };
const CHALLENGES: Challenge[] = [
  { title: 'Speed Demon',     desc: 'Run at least 0.5 km today',   Icon: Zap,        goalKm: 0.5   },
  { title: 'Territory Day',   desc: 'Claim 1 new territory today', Icon: Flag,       goalZones: 1  },
  { title: 'Distance King',   desc: 'Cover 1 km of ground today',  Icon: Crown,      goalKm: 1     },
  { title: 'Zone Rusher',     desc: 'Claim 2 territories today',   Icon: Target,     goalZones: 2  },
  { title: 'City Marathoner', desc: 'Rack up 2 km today',          Icon: TrendingUp, goalKm: 2     },
  { title: 'Iron Siege',      desc: 'Claim 3 territories today',   Icon: Shield,     goalZones: 3  },
  { title: 'Urban Explorer',  desc: 'Cover 1.5 km of new ground',  Icon: Navigation, goalKm: 1.5  },
];

function LeaderRankBadge({ pos }: { pos: number }) {
  if (pos === 0) return <Award size={15} strokeWidth={2} style={{ color: '#f59e0b' }} />;
  if (pos === 1) return <Award size={15} strokeWidth={2} style={{ color: '#9ca3af' }} />;
  if (pos === 2) return <Award size={15} strokeWidth={2} style={{ color: '#b45309' }} />;
  return <span className={styles.leaderRankNum}>{pos + 1}</span>;
}

export function Arena() {
  const store = useTerritoryStore();
  const user = useUserProfile();

  const totalDistance = store.territories.reduce((s, t) => s + t.distance, 0);
  const myTerritories = store.territories.length;
  const myScore = siegeScore(myTerritories, totalDistance);
  const rank = getRank(myTerritories);
  const nextRank = RANKS[RANKS.findIndex(r => r.title === rank.title) + 1];
  const rankProgress = nextRank
    ? (myTerritories - rank.min) / (nextRank.min - rank.min)
    : 1;

  // Today's challenge
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  const challenge = CHALLENGES[dayOfYear % CHALLENGES.length];

  // Today's activity
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayTerritories = store.territories.filter(t => t.createdAt >= todayStart.getTime());
  const todayDistanceM = todayTerritories.reduce((s, t) => s + t.distance, 0);

  const challengeProgress = useMemo(() => {
    if ('goalKm' in challenge && challenge.goalKm !== undefined) {
      return Math.min(todayDistanceM / (challenge.goalKm * 1000), 1);
    }
    if ('goalZones' in challenge && challenge.goalZones !== undefined) {
      return Math.min(todayTerritories.length / challenge.goalZones, 1);
    }
    return 0;
  }, [challenge, todayDistanceM, todayTerritories.length]);

  const challengeDone = challengeProgress >= 1;

  // ── Live leaderboard from Supabase ────────────────────────
  const [leaderEntries, setLeaderEntries] = useState<LeaderEntry[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) { setLeaderLoading(false); return; }
      const [{ data: profiles }, { data: territories }] = await Promise.all([
        supabase.from('profiles').select('id, name, color'),
        supabase.from('territories').select('user_id, distance'),
      ]);
      if (cancelled) return;

      const distByUser:  Record<string, number> = {};
      const countByUser: Record<string, number> = {};
      for (const t of territories ?? []) {
        distByUser[t.user_id]  = (distByUser[t.user_id]  ?? 0) + Number(t.distance);
        countByUser[t.user_id] = (countByUser[t.user_id] ?? 0) + 1;
      }

      const entries: LeaderEntry[] = (profiles ?? []).map(p => ({
        id:          p.id,
        name:        p.name,
        color:       p.color ?? '#0284c7',
        territories: countByUser[p.id] ?? 0,
        distanceM:   distByUser[p.id]  ?? 0,
        score:       siegeScore(countByUser[p.id] ?? 0, distByUser[p.id] ?? 0),
        isMe:        p.id === user.id,
      }));

      setLeaderEntries(entries.sort((a, b) => b.score - a.score));
      setLeaderLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [user.id]);

  const leaderboard = leaderEntries;
  const myRank = leaderboard.findIndex(e => e.isMe) + 1;

  const RankIcon = rank.Icon;
  const ChallengeIcon = challenge.Icon;

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <p className={styles.headerEyebrow}>City Siege</p>
            <h1 className={styles.headerTitle}>The Arena</h1>
          </div>
          <div className={styles.headerIcon}>
            <Shield size={22} strokeWidth={1.75} />
          </div>
        </div>
      </div>

      <div className={styles.body}>

        {/* ── Rank card ─────────────────────────────────────── */}
        <div className={styles.rankCard} style={{ '--rank-color': rank.color } as React.CSSProperties}>
          <div className={styles.rankTop}>
            <div className={styles.rankIconWrap} style={{ background: rank.color + '18', color: rank.color }}>
              <RankIcon size={20} strokeWidth={1.75} />
            </div>
            <div>
              <p className={styles.rankEyebrow}>Your Rank</p>
              <p className={styles.rankTitle} style={{ color: rank.color }}>{rank.title}</p>
            </div>
            <div className={styles.rankScore}>
              <span className={styles.rankScoreValue}>{myScore.toLocaleString()}</span>
              <span className={styles.rankScoreLabel}>pts</span>
            </div>
          </div>
          {nextRank && (
            <div className={styles.rankProgress}>
              <div className={styles.rankProgressTrack}>
                <div
                  className={styles.rankProgressFill}
                  style={{ width: `${rankProgress * 100}%`, background: rank.color }}
                />
              </div>
              <p className={styles.rankProgressHint}>
                {nextRank.min - myTerritories > 0
                  ? `${nextRank.min - myTerritories} more ${nextRank.min - myTerritories === 1 ? 'territory' : 'territories'} to reach ${nextRank.title}`
                  : `Almost there!`}
              </p>
            </div>
          )}
          {!nextRank && (
            <p className={styles.rankProgressHint}>Maximum rank — you rule the city.</p>
          )}
        </div>

        {/* ── Daily challenge ───────────────────────────────── */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Today's Siege</p>
          <div className={challengeDone ? styles.challengeCardDone : styles.challengeCard}>
            <div className={styles.challengeTop}>
              <div className={styles.challengeIconWrap}>
                <ChallengeIcon size={18} strokeWidth={1.75} />
              </div>
              <div className={styles.challengeInfo}>
                <p className={styles.challengeTitle}>{challenge.title}</p>
                <p className={styles.challengeDesc}>{challenge.desc}</p>
              </div>
              {challengeDone && (
                <div className={styles.challengeDoneBadge}>
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                  Done
                </div>
              )}
            </div>
            <div className={styles.challengeBar}>
              <div
                className={styles.challengeBarFill}
                style={{ width: `${challengeProgress * 100}%` }}
              />
            </div>
            <p className={styles.challengeBarLabel}>
              {challengeDone
                ? 'Challenge complete — great work!'
                : (() => {
                    if ('goalKm' in challenge) {
                      return `${formatDistance(todayDistanceM)} / ${challenge.goalKm} km`;
                    }
                    return `${todayTerritories.length} / ${(challenge as { goalZones: number }).goalZones} zones`;
                  })()}
            </p>
          </div>
        </div>

        {/* ── Leaderboard ───────────────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionLabel}>Leaderboard</p>
            {leaderLoading
              ? <span className={styles.sectionSub}>Loading…</span>
              : <span className={styles.sectionSub}>{myRank > 0 ? `#${myRank} of ${leaderboard.length}` : `${leaderboard.length} players`}</span>
            }
          </div>
          {leaderLoading ? (
            <div className={styles.leaderboard}>
              {[0,1,2].map(i => (
                <div key={i} className={styles.leaderRow} style={{ opacity: 0.35 }}>
                  <span className={styles.leaderRank}><span className={styles.leaderRankNum}>{i+1}</span></span>
                  <div className={styles.leaderAvatar} style={{ background: '#cbd5e1' }} />
                  <div className={styles.leaderInfo}>
                    <p className={styles.leaderName} style={{ width: 80, background: '#e2e8f0', borderRadius: 4, color: 'transparent' }}>—</p>
                    <p className={styles.leaderMeta} style={{ width: 120, background: '#f1f5f9', borderRadius: 4, color: 'transparent' }}>—</p>
                  </div>
                  <span className={styles.leaderScore} style={{ background: '#f1f5f9', borderRadius: 4, color: 'transparent' }}>—</span>
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className={styles.emptyFeed}>
              <Award size={24} strokeWidth={1.5} className={styles.emptyFeedIcon} />
              <p className={styles.emptyFeedText}>No players yet — be the first to claim a territory!</p>
            </div>
          ) : (
          <div className={styles.leaderboard}>
            {leaderboard.map((entry, i) => (
              <div
                key={entry.id}
                className={entry.isMe ? styles.leaderRowMe : styles.leaderRow}
              >
                <span className={styles.leaderRank}>
                  <LeaderRankBadge pos={i} />
                </span>
                <div className={styles.leaderAvatar} style={{ background: entry.color }}>
                  {entry.name[0]}
                </div>
                <div className={styles.leaderInfo}>
                  <p className={styles.leaderName}>
                    {entry.name}
                    {entry.isMe && <span className={styles.youTag}>you</span>}
                  </p>
                  <p className={styles.leaderMeta}>
                    {entry.territories} zones · {formatDistance(entry.distanceM)}
                  </p>
                </div>
                <span className={styles.leaderScore}>{entry.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* ── Claims feed ───────────────────────────────────── */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Your Claims</p>
          {store.territories.length === 0 ? (
            <div className={styles.emptyFeed}>
              <Flag size={24} strokeWidth={1.5} className={styles.emptyFeedIcon} />
              <p className={styles.emptyFeedText}>No territories claimed yet — head to the Map tab to start conquering.</p>
            </div>
          ) : (
            <div className={styles.feed}>
              {store.territories.slice(0, 10).map((t) => {
                const ago = Date.now() - t.createdAt;
                const agoLabel = ago < 60_000 ? 'just now'
                  : ago < 3_600_000 ? `${Math.round(ago / 60_000)}m ago`
                  : ago < 86_400_000 ? `${Math.round(ago / 3_600_000)}h ago`
                  : `${Math.round(ago / 86_400_000)}d ago`;
                const kcal = Math.round((t.distance / 1000) * 60);
                return (
                  <div key={t.id} className={styles.feedRow}>
                    <div className={styles.feedDot} style={{ background: t.color }} />
                    <div className={styles.feedInfo}>
                      <p className={styles.feedName}>{t.name}</p>
                      <p className={styles.feedMeta}>
                        {formatDistance(t.distance)} · {kcal} kcal · {t.buildings.length} bldg
                      </p>
                    </div>
                    <span className={styles.feedTime}>{agoLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
