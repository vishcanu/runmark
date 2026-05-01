import { useCallback, useState, useMemo } from 'react';
import { MapView } from '../../features/map/components/MapView';
import { ActivityControls } from '../../features/activity/components/ActivityControls';
import { Modal } from '../../components/Modal/Modal';
import { TerritoryDetails } from '../../features/territory/components/TerritoryDetails';
import { NearbyParkCard } from '../../features/parks/components/NearbyParkCard';
import { MapHeader } from '../../components/MapHeader/MapHeader';
import { useGeolocation } from '../../features/map/hooks/useGeolocation';
import { useActivityTracker } from '../../features/activity/hooks/useActivityTracker';
import { useTerritoryStore } from '../../features/territory/hooks/useTerritoryStore';
import { useParkSearch } from '../../features/parks/hooks/useParkSearch';
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

  // Closest park within 5km
  const closestPark = parks.length > 0 && parks[0].distance <= 5000 ? parks[0] : null;

  const showParkCard =
    !parkCardDismissed &&
    closestPark !== null &&
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

      {/* Park nudge card — shown above the FAB when idle near a park */}
      {showParkCard && closestPark && (
        <div className={styles.parkCardWrap}>
          <NearbyParkCard
            park={closestPark}
            estimatedBuildings={Math.max(3, Math.round(closestPark.distance / 30))}
            onStartActivityHere={handleStart}
            onDismiss={() => setParkCardDismissed(true)}
          />
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
