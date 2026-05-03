import { useCallback, useState, useMemo, useEffect } from 'react';
import { Trees, Waves, MapPin, X, Play, Navigation } from 'lucide-react';
import { MapView } from '../../features/map/components/MapView';
import { ActivityControls } from '../../features/activity/components/ActivityControls';
import { Modal } from '../../components/Modal/Modal';
import { TerritoryDetails } from '../../features/territory/components/TerritoryDetails';
import { MapHeader } from '../../components/MapHeader/MapHeader';
import { useGeolocation } from '../../features/map/hooks/useGeolocation';
import { useActivityTracker } from '../../features/activity/hooks/useActivityTracker';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { useParkSearch } from '../../features/parks/hooks/useParkSearch';
import { formatParkDistance, navigateToPark } from '../../features/parks/utils/parkUtils';
import { pathToPolygon, colorFromId, polyCentroid, haversineDistance, isLinearPath, bufferPath } from '../../features/map/utils/geo';
import { snapPathToRoads } from '../../features/map/utils/snapToRoads';
import { generateBuildings } from '../../features/building/utils/buildingGenerator';
import type { Park } from '../../features/parks/types';
import type { Territory, Coordinate } from '../../types';
import styles from './Home.module.css';

export function Home() {
  const geo = useGeolocation();
  const tracker = useActivityTracker();
  const store = useTerritoryStore();
  const [parkCardDismissed, setParkCardDismissed] = useState(false);
  const [selectedPark, setSelectedPark] = useState<Park | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);

  // Set of claimed park IDs for context
  const claimedParkIds = useMemo(() => new Set<string>(), []);

  const { parks, loading: parksLoading } = useParkSearch(geo.position, claimedParkIds);

  // Closest park for map highlight
  const closestPark = parks.length > 0 && parks[0].distance <= 5000 ? parks[0] : null;

  const showParksTray =
    !parkCardDismissed &&
    (parks.length > 0 || (parksLoading && geo.position !== null)) &&
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

  // Feed every GPS fix into the tracker while a run is active
  useEffect(() => {
    if (tracker.session.status === 'active' && geo.position) {
      tracker.addPosition(geo.position);
    }
  }, [geo.position, tracker.session.status]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(() => {
    geo.startWatching();
    tracker.start();
    setParkCardDismissed(true);
    setSelectedPark(null);
  }, [geo, tracker]);

  const handleStop = useCallback(async () => {
    geo.stopWatching();

    const currentPath     = tracker.session.path;
    const currentDistance = tracker.session.distance;
    const currentStartTime = tracker.session.startTime;
    const sessionId       = tracker.session.id;
    const elapsed         = tracker.elapsedSeconds;

    tracker.stop();

    if (currentPath.length < 3) {
      tracker.reset();
      return;
    }

    // ── Snap path to real road/footpath geometry ─────────────
    // Shows "Mapping territory…" while OSRM resolves (max 6s).
    // Falls back to raw GPS path automatically on any failure.
    setIsSnapping(true);
    const snappedPath = await snapPathToRoads(currentPath);
    setIsSnapping(false);

    // ── Detect shape: closed zone vs out-and-back corridor ───
    const linear  = isLinearPath(snappedPath);
    const coords  = linear ? bufferPath(snappedPath, 5) : pathToPolygon(snappedPath);
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

    if (existing) {
      // Accumulate stats onto the existing territory
      store.updateTerritory(existing.id, {
        runs:      (existing.runs ?? 1) + 1,
        distance:  existing.distance + currentDistance,
        lastRunAt: Date.now(),
      });
    } else {
      // Brand-new zone
      const buildings = generateBuildings(coords, currentDistance, duration);
      const territory: Territory = {
        id: sessionId,
        name: `Territory ${store.territories.length + 1}`,
        coordinates: coords,
        createdAt: currentStartTime ?? Date.now(),
        distance: currentDistance,
        duration,
        buildings,
        color,
        runs: 1,
        lastRunAt: Date.now(),
        shape:   linear ? 'corridor' : 'zone',
        rawPath: linear ? snappedPath : undefined,
      };
      store.addTerritory(territory);
    }
    tracker.reset();
    setParkCardDismissed(false); // re-show park nudge after activity
    setSelectedPark(null);
  }, [geo, tracker, store]);

  const selectedTerritory = store.selectedId
    ? store.getTerritory(store.selectedId)
    : null;

  return (
    <div className={styles.page}>
      <MapHeader isActive={tracker.session.status === 'active'} />

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
            {parksLoading
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
            <button className={styles.parkConfirmStart} onClick={handleStart}>
              <Play size={15} strokeWidth={2.5} />
              Start Run Here
            </button>
          </div>
        </div>
      )}

      <ActivityControls
        status={tracker.session.status}
        elapsedSeconds={tracker.elapsedSeconds}
        distance={tracker.session.distance}
        onStart={handleStart}
        onStop={handleStop}
        isSnapping={isSnapping}
      />

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
