import { useCallback, useState, useMemo, useEffect } from 'react';
import { Trees, Waves, MapPin, X, Play, Navigation } from 'lucide-react';
import { useSiegeCharges, computeEarnedCharges } from '../../hooks/useSiegeCharges';
import { useUserProfile } from '../../hooks/useUserProfile';
import { SiegeDots, SiegePanel } from '../../components/SiegeHUD/SiegeHUD';
import { AttackSheet } from '../../components/AttackSheet/AttackSheet';
import { AttackStrike } from '../../components/AttackStrike/AttackStrike';
import { DefenseSuccess } from '../../components/DefenseSuccess/DefenseSuccess';
import { fetchEnemyTerritories, launchAttack, clearDefendedAttacks, fetchOwnAttackedTerritories } from '../../lib/db';
import { getMapInstance } from '../../features/map/mapSingleton';
import { MapView } from '../../features/map/components/MapView';
import { ActivityControls } from '../../features/activity/components/ActivityControls';
import { Modal } from '../../components/Modal/Modal';
import { TerritoryDetails } from '../../features/territory/components/TerritoryDetails';
import { TerritoryVictory, type VictoryData } from '../../components/TerritoryVictory/TerritoryVictory';
import { getTierInfo } from '../../features/territory/utils/territoryTier';
import { MapHeader } from '../../components/MapHeader/MapHeader';
import { useGhostPlayer, clearGhostPlayer } from '../../features/territory/hooks/useGhostPlayer';
import { useGeolocation } from '../../features/map/hooks/useGeolocation';
import { useActivityTracker } from '../../features/activity/hooks/useActivityTracker';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { useParkSearch } from '../../features/parks/hooks/useParkSearch';
import { formatParkDistance, navigateToPark } from '../../features/parks/utils/parkUtils';
import { colorFromId, polyCentroid, haversineDistance, bufferPath, isLinearPath, buildRoadRing, simplifyRing, simplifyPath } from '../../features/map/utils/geo';
import { snapPathToRoads } from '../../features/map/utils/snapToRoads';
import { calcPoints } from '../../features/activity/utils/points';
import type { Park } from '../../features/parks/types';
import type { Territory, Coordinate, ActivityType, RunEntry, WorldTerritory, AttackType, SiegeCharges } from '../../types';
import { ATTACK_COSTS, ATTACK_DURATIONS_MS } from '../../types';
import styles from './Home.module.css';

// Theme gradient map — mirrors TerritoryDetails THEMES
const THEME_GRADS: Record<string, string> = {
  azure:   'linear-gradient(135deg,#60a5fa,#1d4ed8)',
  arctic:  'linear-gradient(135deg,#e0f2fe,#0369a1)',
  lagoon:  'linear-gradient(135deg,#2dd4bf,#0f766e)',
  abyss:   'linear-gradient(135deg,#38bdf8,#164e63)',
  emerald: 'linear-gradient(135deg,#34d399,#065f46)',
  moss:    'linear-gradient(135deg,#a3e635,#3f6212)',
  ember:   'linear-gradient(135deg,#fbbf24,#b45309)',
  inferno: 'linear-gradient(135deg,#f97316,#7f1d1d)',
  nebula:  'linear-gradient(135deg,#a78bfa,#4c1d95)',
  aurora:  'linear-gradient(135deg,#f0abfc,#6b21a8)',
  sakura:  'linear-gradient(135deg,#fda4af,#9f1239)',
  rose:    'linear-gradient(135deg,#fb7185,#881337)',
  onyx:    'linear-gradient(135deg,#475569,#0f172a)',
  gold:    'linear-gradient(135deg,#fde68a,#92400e)',
  prism:   'linear-gradient(135deg,#818cf8,#06b6d4)',
  dusk:    'linear-gradient(135deg,#fb923c,#7c3aed)',
};
function themeGrad(theme?: string, color?: string) {
  return THEME_GRADS[theme ?? ''] ?? `linear-gradient(135deg, ${color ?? '#0284c7'}, #1e3a5f)`;
}

// ── Adaptive road half-width ─────────────────────────────────────────────────
// Maps the OFM Liberty road `class` property → real-world half-width in metres.
// These values come from standard road widths (one carriageway side + kerb).
const ROAD_CLASS_HALF_WIDTH: Record<string, number> = {
  motorway:      10,   // dual carriageway
  trunk:          8,   // major arterial
  primary:        7,   // national/state highway within city
  secondary:      5.5, // major collector road
  tertiary:       4.5, // local collector
  minor:          3.5,
  street:         3.5, // residential / local street
  service:        2.5, // access lane
  driveway:       2,
  alley:          2,
  path:           1.5,
  footway:        1.5,
  pedestrian:     2.5,
  cycleway:       2,
  track:          2,
  living_street:  3,
  unclassified:   3,
};

const ROAD_QUERY_LAYERS = [
  'road-motorway', 'road-trunk', 'road-primary',
  'road-secondary-tertiary', 'road-street', 'road-street-low',
  'road-path', 'road-track',
];

/**
 * Sample up to 8 points along the snapped path, query the map's rendered road
 * features at each point, and return the half-width for the dominant road class.
 * Falls back to `fallback` if the map isn't ready or no features are found.
 */
function queryRoadHalf(path: Coordinate[], fallback: number): number {
  const map = getMapInstance();
  if (!map) return fallback;

  const step = Math.max(1, Math.floor(path.length / 8));
  const counts: Record<string, number> = {};

  for (let i = 0; i < path.length; i += step) {
    try {
      const px = map.project(path[i] as [number, number]);
      const feats = map.queryRenderedFeatures(
        [[px.x - 8, px.y - 8], [px.x + 8, px.y + 8]],
        { layers: ROAD_QUERY_LAYERS },
      );
      const cls = feats[0]?.properties?.class ?? feats[0]?.properties?.type;
      if (cls) counts[cls] = (counts[cls] ?? 0) + 1;
    } catch { /* off-screen or map not ready — skip */ }
  }

  let dominant: string | null = null;
  let maxCount = 0;
  for (const [cls, n] of Object.entries(counts)) {
    if (n > maxCount) { maxCount = n; dominant = cls; }
  }

  return dominant ? (ROAD_CLASS_HALF_WIDTH[dominant] ?? fallback) : fallback;
}

export function Home() {
  const [victoryData, setVictoryData] = useState<VictoryData | null>(null);
  const [showSiegePanel, setShowSiegePanel] = useState(false);
  const [attackTarget, setAttackTarget] = useState<WorldTerritory | null>(null);
  const [enemyTerritories, setEnemyTerritories] = useState<WorldTerritory[]>([]);
  const [strike, setStrike] = useState<{ type: AttackType; targetName: string; ownerName: string; attackerName: string } | null>(null);
  const [attackedId, setAttackedId] = useState<string | null>(null);
  const [ownAttacked, setOwnAttacked] = useState<Territory[]>([]);
  const [defended, setDefended] = useState<string[]>([]);
  const { charges, addCharges, spendCharges } = useSiegeCharges();
  const user = useUserProfile();
  const ghost = useGhostPlayer();
  const geo = useGeolocation();
  const tracker = useActivityTracker();
  const store = useTerritoryStore();
  const [parkCardDismissed, setParkCardDismissed] = useState(false);
  const [selectedPark, setSelectedPark] = useState<Park | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);

  // Set of claimed park IDs for context
  const claimedParkIds = useMemo(() => new Set<string>(), []);

  const { parks, loading: parksLoading, error: parksError } = useParkSearch(geo.position, claimedParkIds);

  // Closest park for map highlight
  const closestPark = parks.length > 0 && parks[0].distance <= 5000 ? parks[0] : null;

  const showParksTray =
    !parkCardDismissed &&
    (parks.length > 0 || (parksLoading && geo.position !== null) || !!parksError) &&
    tracker.session.status === 'idle' &&
    selectedPark === null;

  // When a park chip is tapped — fly map to it, show confirm sheet
  const handleParkChipTap = useCallback((park: Park) => {
    setSelectedPark(park);
  }, []);

  // Derive center target for the map from selected park
  const mapCenterTarget: Coordinate | null = selectedPark
    ? [selectedPark.lng, selectedPark.lat]
    : null;

  // Feed every GPS fix into the tracker while a run is active.
  // Skip positions with poor accuracy (> 35 m) — they cause jitter and criss-cross paths.
  useEffect(() => {
    if (tracker.session.status === 'active' && geo.position) {
      if (geo.accuracy === null || geo.accuracy <= 35) {
        tracker.addPosition(geo.position);
      }
    }
  }, [geo.position, tracker.session.status]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Load enemy territories once on mount (refresh after attack too)
  const loadEnemyTerritories = useCallback(() => {
    if (!user.id) return;
    fetchEnemyTerritories(user.id).then(setEnemyTerritories);
  }, [user.id]);

  useEffect(() => { loadEnemyTerritories(); }, [loadEnemyTerritories]);

  // Load own territories that are currently under active attack
  const loadOwnAttacked = useCallback(() => {
    if (!user.id) return;
    fetchOwnAttackedTerritories(user.id).then(setOwnAttacked);
  }, [user.id]);

  useEffect(() => { loadOwnAttacked(); }, [loadOwnAttacked]);

  // Handle tap on enemy territory — open attack sheet
  const handleEnemyTerritoryClick = useCallback((t: WorldTerritory) => {
    setAttackTarget(t);
  }, []);

  // Execute an attack
  const handleAttack = useCallback(async (type: AttackType, newName?: string) => {
    if (!attackTarget) return;
    const cost      = ATTACK_COSTS[type];
    const duration  = ATTACK_DURATIONS_MS[type];
    const expiresAt = duration > 0 ? Date.now() + duration : null;
    spendCharges({ [type]: cost } as Partial<typeof charges>);
    const result = await launchAttack(user.id, attackTarget.id, type, expiresAt, newName);
    if (!result.ok) {
      // Refund charge — attack didn't land
      addCharges({ [type]: cost } as Partial<SiegeCharges>);
      if (result.error !== 'conflict') {
        console.error('[Home] Attack failed:', result.error);
      }
      return;
    }
    const target = attackTarget; // capture before state clears
    // Optimistically update enemy territory attack state locally
    setEnemyTerritories(prev =>
      prev.map(t => t.id === target.id
        ? { ...t, attackType: type, attackExpiresAt: expiresAt, attackerId: user.id,
            attackerName: user.name, name: newName ?? t.name }
        : t
      )
    );
    // ── Charge-up delay ── keep sheet open showing "Charging..." for 1.4 s
    // The Supabase write already succeeded above; this is purely for drama.
    await new Promise<void>(r => setTimeout(r, 1400));
    // Close the attack sheet
    setAttackTarget(null);
    // Refresh from server so subsequent attacks use fresh data
    loadEnemyTerritories();
    // Haptic feedback on supported devices
    navigator.vibrate?.([80, 40, 160, 40, 280]);
    // Fly map to attacked territory so the player sees the effect
    const mapInst = getMapInstance();
    if (mapInst) {
      const center = polyCentroid(target.coordinates as Coordinate[]);
      mapInst.flyTo({ center, zoom: 17, pitch: 55, bearing: 20, duration: 1400 });
    }
    // Show siege launch card — user must dismiss manually
    const displayName = newName?.trim() || target.name;
    setAttackedId(target.id);
    setStrike({ type, targetName: displayName, ownerName: target.ownerName, attackerName: user.name });
  }, [attackTarget, spendCharges, addCharges, user.id, charges, loadEnemyTerritories]);

  const handleStart = useCallback((type: ActivityType = 'run') => {
    geo.startWatching();
    tracker.start(type);
    setParkCardDismissed(true);
    setSelectedPark(null);
  }, [geo, tracker]);

  const handleStop = useCallback(async () => {
    geo.stopWatching();

    const currentPath      = tracker.session.path;
    const currentDistance  = tracker.session.distance;
    const currentStartTime = tracker.session.startTime;
    const sessionId        = tracker.session.id;
    const elapsed          = tracker.elapsedSeconds;
    const activityType     = tracker.session.activityType;

    tracker.stop();

    if (currentPath.length < 3) {
      tracker.reset();
      return;
    }

    // ── Snap path to real road/footpath geometry ─────────────
    // Shows "Mapping territory…" while OSRM resolves (max 6s).
    // Falls back to raw GPS path automatically on any failure.
    setIsSnapping(true);
    const snappedPath = await snapPathToRoads(currentPath, activityType);
    setIsSnapping(false);

    // ── Corridor vs Zone ────────────────────────────────────────
    // Road half-width: read actual road class from map tile features, giving
    // accurate per-road-type widths. Falls back to activity-based defaults.
    const fallbackHalf = activityType === 'cycle' ? 10 : activityType === 'walk' ? 6 : 7;
    const ROAD_HALF = queryRoadHalf(snappedPath, fallbackHalf);
    const linear  = isLinearPath(snappedPath);
    let coords: Coordinate[];
    let innerRing: Coordinate[] | undefined;
    if (linear) {
      // Corridor: buffer the road centerline both sides
      coords = simplifyRing(bufferPath(snappedPath, ROAD_HALF), 5);
    } else {
      // Zone: road-ring donut.
      // Strong simplification collapses straight segments to corner-only path
      // so the ring sides are perfectly straight, matching the road geometry.
      const zonePath = simplifyPath(snappedPath, 15);
      const [rawOuter, rawInner] = buildRoadRing(zonePath, ROAD_HALF);
      coords    = simplifyRing(rawOuter, 5);
      innerRing = simplifyRing(rawInner, 5);
    }
    const color    = colorFromId(sessionId);
    const duration = elapsed;

    // ── Detect if this run re-traces an existing territory ────
    // If the centroid of the new polygon is within 120m of an existing
    // territory's centroid we treat it as another lap, not a new zone.
    const newCentroid = polyCentroid(coords);
    const existing = store.territories.find((t) => {
      const c = polyCentroid(t.coordinates as Coordinate[]);
      return haversineDistance(newCentroid, c) < 120;
    });

    // ── Siege: check yesterday streak BEFORE modifying territory timestamps ──
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart.getTime() - 86_400_000;
    const wasActiveYday = store.territories.some(t => {
      const lr = t.lastRunAt ?? t.createdAt;
      return lr >= yesterdayStart && lr < todayStart.getTime();
    });

    if (existing) {
      // Accumulate stats onto the existing territory
      const earned = calcPoints(currentDistance, activityType, false);
      // Track visit days for streak calculation (day-floor timestamp)
      const todayMs = Math.floor(Date.now() / 86_400_000) * 86_400_000;
      const prevDays = existing.visitDays ?? [existing.createdAt];
      const visitDays = prevDays.some((d) => Math.floor(d / 86_400_000) === Math.floor(todayMs / 86_400_000))
        ? prevDays
        : [...prevDays, todayMs];
      const newRun: RunEntry = { ts: Date.now(), dist: currentDistance, dur: duration, type: activityType };
      const prevRuns  = existing.runs ?? 1;
      const nextRuns  = prevRuns + 1;
      store.updateTerritory(existing.id, {
        runs:         nextRuns,
        distance:     existing.distance + currentDistance,
        lastRunAt:    Date.now(),
        activityType,
        points:       (existing.points ?? 0) + earned,
        visitDays,
        runLog:       [...(existing.runLog ?? []), newRun],
      });
      // ── Siege: earn charges for this revisit ─────────────────────────
      const siegeEarned = computeEarnedCharges(
        currentDistance, activityType, false,
        store.territories.length, wasActiveYday,
      );
      addCharges(siegeEarned);
      setVictoryData({
        isNew:         false,
        tierChanged:   getTierInfo(nextRuns).name !== getTierInfo(prevRuns).name,
        tierName:      getTierInfo(nextRuns).name,
        territoryName: existing.name,
        color:         existing.color,
        themeGrad:     themeGrad(existing.theme, existing.color),
        emblem:        existing.emblem ?? 'star',
        runDist:       currentDistance,
        runDur:        duration,
        earnedPoints:  earned,
        totalRuns:     nextRuns,
        activityType,
      });
    } else {
      // Brand-new zone — no pre-generated buildings; construction grows with runs
      const earned = calcPoints(currentDistance, activityType, true);
      const territory: Territory = {
        id: sessionId,
        name: `Territory ${store.territories.length + 1}`,
        coordinates: coords,
        createdAt: currentStartTime ?? Date.now(),
        distance: currentDistance,
        duration,
        buildings: [],
        color,
        runs: 1,
        lastRunAt: Date.now(),
        shape:       linear ? 'corridor' : 'zone',
        rawPath:     snappedPath,  // OSRM road centreline — used for road surface rendering
        innerRing,                 // road-ring hole for zone territories (undefined for corridors)
        activityType,
        visitDays:   [Math.floor(Date.now() / 86_400_000) * 86_400_000],
        points:       earned,
        runLog:       [{ ts: currentStartTime ?? Date.now(), dist: currentDistance, dur: duration, type: activityType }],
      };
      store.addTerritory(territory);
      // ── Siege: earn charges for new territory ────────────────────────
      const siegeEarned = computeEarnedCharges(
        currentDistance, activityType, true,
        store.territories.length + 1, wasActiveYday,
      );
      addCharges(siegeEarned);
      setVictoryData({
        isNew:         true,
        tierChanged:   false,
        tierName:      getTierInfo(1).name,
        territoryName: territory.name,
        color,
        themeGrad:     themeGrad(undefined, color),
        emblem:        'star',
        runDist:       currentDistance,
        runDur:        duration,
        earnedPoints:  earned,
        totalRuns:     1,
        activityType,
      });
    }
    tracker.reset();
    setParkCardDismissed(false); // re-show park nudge after activity
    setSelectedPark(null);
    // Check if any of our territories were under attack with defense window open.
    // Any completed run automatically defends them — the core health loop.
    clearDefendedAttacks(user.id).then(names => {
      if (names.length > 0) {
        setDefended(names);
        setOwnAttacked([]);      // clear local siege state immediately
        loadEnemyTerritories();  // refresh enemy map visuals
      }
    });
  }, [geo, tracker, store, user.id, loadEnemyTerritories]);

  const selectedTerritory = store.selectedId
    ? store.getTerritory(store.selectedId)
    : null;

  return (
    <div className={styles.page}>
      <MapHeader
        isActive={tracker.session.status === 'active'}
        centerContent={
          <button
            className={styles.siegeTrigger}
            onClick={() => setShowSiegePanel(true)}
            aria-label="Siege Powers"
          >
            <SiegeDots charges={charges} />
          </button>
        }
      />

      {/* Ghost player banner — shown when viewing a rival's territories on the map */}
      {ghost && (
        <div className={styles.ghostBanner}>
          <div className={styles.ghostAvatar} style={{ background: ghost.color }}>
            {ghost.name[0].toUpperCase()}
          </div>
          <span className={styles.ghostText}>
            Viewing <strong>{ghost.name}</strong>'s {ghost.territories.length} {ghost.territories.length === 1 ? 'territory' : 'territories'}
          </span>
          <button className={styles.ghostClose} onClick={clearGhostPlayer} aria-label="Clear view">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Under-attack banner — own territories currently being sieged */}
      {ownAttacked.length > 0 && !ghost && tracker.session.status !== 'active' && (
        <div className={styles.underAttackBanner}>
          <div className={styles.underAttackDot} />
          <div className={styles.underAttackText}>
            <span className={styles.underAttackTitle}>
              {ownAttacked.length === 1
                ? `“${ownAttacked[0].name}” is under siege`
                : `${ownAttacked.length} territories under siege`}
            </span>
            <span className={styles.underAttackHint}>Run to defend</span>
          </div>
        </div>
      )}

      {/* Background-tracking warning toast */}
      {geo.backgrounded && tracker.session.status === 'active' && (
        <div className={styles.bgToast}>
          ⚠️ App went to background — GPS may have paused. Keep this screen open.
        </div>
      )}

      <MapView
        userPosition={geo.position}
        userHeading={geo.heading}
        userAccuracy={geo.accuracy}
        territories={store.territories}
        activePath={tracker.session.path}
        selectedTerritoryId={store.selectedId}
        onTerritoryClick={store.selectTerritory}
        parks={parks}
        closestParkId={closestPark?.id ?? null}
        centerTarget={mapCenterTarget}
        selectedPark={selectedPark}
        enemyTerritories={enemyTerritories}
        onEnemyTerritoryClick={handleEnemyTerritoryClick}
        attackedTerritoryId={attackedId}
      />

      {/* Parks tray — horizontal scroll list, shown when idle */}
      {showParksTray && (
        <div className={styles.parksTray}>
          <div className={styles.parksTrayHeader}>
            <MapPin size={12} strokeWidth={2.5} className={styles.parksTrayPin} />
            <span className={styles.parksTrayTitle}>
              {parksLoading ? 'Finding nearby places…' : `${parks.length} place${parks.length !== 1 ? 's' : ''} nearby`}
            </span>
            {!parksLoading && (
              <button
                className={styles.parksTrayDismiss}
                onClick={() => setParkCardDismissed(true)}
                aria-label="Dismiss"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <div className={styles.parksTrayScroll}>
            {parksError && parks.length === 0
              ? <span className={styles.parksTrayError}>Couldn't load nearby places — retrying…</span>
              : parksLoading
              ? [1, 2, 3].map((i) => <div key={i} className={styles.parkChipSkeleton} />)
              : parks.slice(0, 8).map((park) => {
                  const isLake = park.placeType === 'lake';
                  return (
                    <button
                      key={park.id}
                      className={[styles.parkChip, isLake ? styles.parkChipLake : ''].filter(Boolean).join(' ')}
                      onClick={() => handleParkChipTap(park)}
                    >
                      <div className={styles.parkChipIcon}>
                        {isLake
                          ? <Waves size={16} strokeWidth={1.75} />
                          : <Trees size={16} strokeWidth={1.75} />
                        }
                      </div>
                  <div className={styles.parkChipBody}>
                    <span className={styles.parkChipName}>{park.name}</span>
                    <span className={styles.parkChipMeta}>
                      {formatParkDistance(park.distance)} · {park.walkMinutes} min
                    </span>
                  </div>
                    </button>
                  );
                })}
          </div>
        </div>
      )}

      {/* Park confirm sheet — shown after tapping a chip */}
      {selectedPark && tracker.session.status === 'idle' && (
        <div className={styles.parkConfirm}>
          <button
            className={styles.parkConfirmDismiss}
            onClick={() => setSelectedPark(null)}
            aria-label="Back"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
          <div className={styles.parkConfirmInfo}>
            <div className={[
              styles.parkConfirmIcon,
              selectedPark.placeType === 'lake' ? styles.parkConfirmIconLake : ''
            ].filter(Boolean).join(' ')}>
              {selectedPark.placeType === 'lake'
                ? <Waves size={18} strokeWidth={1.75} />
                : <Trees size={18} strokeWidth={1.75} />
              }
            </div>
            <div>
              <p className={styles.parkConfirmName}>{selectedPark.name}</p>
              <p className={styles.parkConfirmMeta}>
                {formatParkDistance(selectedPark.distance)} · {selectedPark.walkMinutes} min walk
              </p>
            </div>
          </div>
          <div className={styles.parkConfirmActions}>
            <button
              className={styles.parkConfirmNav}
              onClick={() => navigateToPark(selectedPark.lat, selectedPark.lng)}
            >
              <Navigation size={15} strokeWidth={2} />
              Directions
            </button>
            <button className={styles.parkConfirmStart} onClick={() => handleStart('run')}>
              <Play size={15} strokeWidth={2.5} />
              Start Run Here
            </button>
          </div>
        </div>
      )}

      {/* Strike overlay — full-screen dramatic animation after a successful attack */}
      {strike && (
        <AttackStrike
          type={strike.type}
          targetName={strike.targetName}
          ownerName={strike.ownerName}
          attackerName={strike.attackerName}
          onClose={() => { setStrike(null); setAttackedId(null); }}
        />
      )}

      {/* Defense success — shown after a run that cleared an active siege */}
      {defended.length > 0 && (
        <DefenseSuccess
          territories={defended}
          onClose={() => setDefended([])}
        />
      )}

      {/* Attack sheet — opened when tapping an enemy territory */}
      {attackTarget && (
        <AttackSheet
          territory={attackTarget}
          charges={charges}
          currentUserId={user.id}
          onAttack={handleAttack}
          onClose={() => setAttackTarget(null)}
        />
      )}

      {/* Siege panel — full charge breakdown, opened from header dots */}
      {showSiegePanel && (
        <SiegePanel charges={charges} onClose={() => setShowSiegePanel(false)} />
      )}

      <ActivityControls
        status={tracker.session.status}
        elapsedSeconds={tracker.elapsedSeconds}
        distance={tracker.session.distance}
        activityType={tracker.session.activityType}
        onStart={handleStart}
        onStop={handleStop}
        isSnapping={isSnapping}
      />

      {victoryData && (
        <TerritoryVictory data={victoryData} onClose={() => setVictoryData(null)} />
      )}

      {selectedTerritory && (
        <Modal
          open={!!store.selectedId}
          onClose={() => store.selectTerritory(null)}
          title={selectedTerritory.name}
        >
          <TerritoryDetails
            territory={selectedTerritory}
            onDelete={(id) => {
              store.removeTerritory(id);
              store.selectTerritory(null);
            }}
            onUpdate={store.updateTerritory}
          />
        </Modal>
      )}

      {geo.error && (
        <div className={styles.geoError}>
          <span>{geo.error}</span>
        </div>
      )}
    </div>
  );
}
