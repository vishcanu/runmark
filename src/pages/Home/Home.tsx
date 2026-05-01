import { useCallback, useState, useMemo } from 'react';
import { Trees, Waves, MapPin, X } from 'lucide-react';
import { MapView } from '../../features/map/components/MapView';
import { ActivityControls } from '../../features/activity/components/ActivityControls';
import { Modal } from '../../components/Modal/Modal';
import { TerritoryDetails } from '../../features/territory/components/TerritoryDetails';
import { MapHeader } from '../../components/MapHeader/MapHeader';
import { useGeolocation } from '../../features/map/hooks/useGeolocation';
import { useActivityTracker } from '../../features/activity/hooks/useActivityTracker';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { useParkSearch } from '../../features/parks/hooks/useParkSearch';
import { formatParkDistance } from '../../features/parks/utils/parkUtils';
import { pathToPolygon, colorFromId } from '../../features/map/utils/geo';
import { generateBuildings } from '../../features/building/utils/buildingGenerator';
import type { Territory } from '../../types';
import styles from './Home.module.css';

export function Home() {
  const geo = useGeolocation();
  const tracker = useActivityTracker();
  const store = useTerritoryStore();
  const [parkCardDismissed, setParkCardDismissed] = useState(false);

  // Set of claimed park IDs for context
  const claimedParkIds = useMemo(() => new Set<string>(), []);

  const { parks } = useParkSearch(geo.position, claimedParkIds);

  // Closest park for map highlight
  const closestPark = parks.length > 0 && parks[0].distance <= 5000 ? parks[0] : null;

  const showParksTray =
    !parkCardDismissed &&
    parks.length > 0 &&
    tracker.session.status === 'idle';

  const handleStart = useCallback(() => {
    geo.startWatching();
    tracker.start();
    setParkCardDismissed(true);
  }, [geo, tracker]);

  const handleStop = useCallback(() => {
    geo.stopWatching();

    const currentPath = tracker.session.path;
    const currentDistance = tracker.session.distance;
    const currentStartTime = tracker.session.startTime;
    const sessionId = tracker.session.id;
    const elapsed = tracker.elapsedSeconds;

    tracker.stop();

    if (currentPath.length < 3) {
      tracker.reset();
      return;
    }

    const coords = pathToPolygon(currentPath);
    const color = colorFromId(sessionId);
    const duration = elapsed;

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
    };

    store.addTerritory(territory);
    tracker.reset();
    setParkCardDismissed(false); // re-show park nudge after activity
  }, [geo, tracker, store]);

  const selectedTerritory = store.selectedId
    ? store.getTerritory(store.selectedId)
    : null;

  return (
    <div className={styles.page}>
      <MapHeader isActive={tracker.session.status === 'active'} />

      <MapView
        userPosition={geo.position}
        territories={store.territories}
        activePath={tracker.session.path}
        selectedTerritoryId={store.selectedId}
        onTerritoryClick={store.selectTerritory}
        parks={parks}
        closestParkId={closestPark?.id ?? null}
      />

      {/* Parks tray — horizontal scroll list, shown when idle */}
      {showParksTray && (
        <div className={styles.parksTray}>
          <div className={styles.parksTrayHeader}>
            <MapPin size={12} strokeWidth={2.5} className={styles.parksTrayPin} />
            <span className={styles.parksTrayTitle}>
              {parks.length} nearby place{parks.length !== 1 ? 's' : ''}
            </span>
            <button
              className={styles.parksTrayDismiss}
              onClick={() => setParkCardDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
          <div className={styles.parksTrayScroll}>
            {parks.slice(0, 8).map((park) => {
              const isLake = park.placeType === 'lake';
              return (
                <button
                  key={park.id}
                  className={[styles.parkChip, isLake ? styles.parkChipLake : ''].filter(Boolean).join(' ')}
                  onClick={handleStart}
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
                      {formatParkDistance(park.distance)} · {park.walkMinutes} min walk
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ActivityControls
        status={tracker.session.status}
        elapsedSeconds={tracker.elapsedSeconds}
        distance={tracker.session.distance}
        onStart={handleStart}
        onStop={handleStop}
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
