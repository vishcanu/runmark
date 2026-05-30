import { useRef, useEffect, useCallback } from 'react';
import { Crosshair, Sun, Moon, Sparkles } from 'lucide-react';
import { useMap } from '../hooks/useMap';
import type { MapTheme } from '../hooks/useMap';
import { UserMarker } from './UserMarker';
import { TerritoryLayer } from './TerritoryLayer';
import { PathLayer } from './PathLayer';
import { BuildingLayer } from '../../building/components/BuildingLayer';
import { ParkLayer } from '../../parks/components/ParkLayer';
import { ParkBoundaryLayer } from '../../parks/components/ParkBoundaryLayer';
import type { Territory, Coordinate, WorldTerritory } from '../../../types';
import type { Park } from '../../parks/types';
import styles from './MapView.module.css';

interface MapViewProps {
  userPosition: Coordinate | null;
  userHeading?: number | null;
  userAccuracy?: number | null;
  territories: Territory[];
  activePath: Coordinate[];
  selectedTerritoryId: string | null;
  onTerritoryClick: (id: string) => void;
  parks: Park[];
  closestParkId: string | null;
  centerTarget: Coordinate | null;
  selectedPark: Park | null;
  enemyTerritories?: WorldTerritory[];
  onEnemyTerritoryClick?: (t: WorldTerritory) => void;
  attackedTerritoryId?: string | null;
}

export function MapView({
  userPosition,
  userHeading,
  userAccuracy,
  territories,
  activePath,
  selectedTerritoryId,
  onTerritoryClick,
  parks,
  closestParkId,
  centerTarget,
  selectedPark,
  enemyTerritories,
  onEnemyTerritoryClick,
  attackedTerritoryId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, isReady, flyTo, theme, setTheme, styleVersion } = useMap(containerRef);

  const THEMES: MapTheme[] = ['light', 'dark', 'night'];
  const cycleTheme = useCallback(() => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
  }, [theme, setTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Center on user the moment first GPS fix arrives
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (userPosition && isReady && !hasCenteredRef.current) {
      flyTo(userPosition, 16);
      hasCenteredRef.current = true;
    }
  }, [userPosition, isReady, flyTo]);

  // Re-center button handler
  const handleLocate = useCallback(() => {
    if (userPosition && isReady) flyTo(userPosition, 16);
  }, [userPosition, isReady, flyTo]);

  // Fly to selected park when user taps a chip
  useEffect(() => {
    if (centerTarget && isReady) {
      flyTo(centerTarget, 17);
    }
  }, [centerTarget, isReady, flyTo]);

  return (
    <div className={styles.container} ref={containerRef}>
      {isReady && map && (
        <>
          <ParkLayer map={map} parks={parks} closestParkId={closestParkId} />
          <ParkBoundaryLayer map={map} park={selectedPark} />
          <UserMarker map={map} position={userPosition} heading={userHeading} accuracy={userAccuracy} />
          <TerritoryLayer
            map={map}
            territories={territories}
            selectedId={selectedTerritoryId}
            onTerritoryClick={onTerritoryClick}
            enemyTerritories={enemyTerritories}
            onEnemyTerritoryClick={onEnemyTerritoryClick}
            attackedTerritoryId={attackedTerritoryId}
            styleVersion={styleVersion}
          />
          <PathLayer map={map} path={activePath} />
          <BuildingLayer map={map} territories={territories} />
        </>
      )}
      {/* Re-center on user button */}
      {userPosition && (
        <button
          className={styles.locateBtn}
          onClick={handleLocate}
          aria-label="Center on my location"
        >
          <Crosshair size={20} strokeWidth={2} />
        </button>
      )}
      {/* Theme toggle — cycles Light → Dark → Night, sits right of locate btn */}
      <button
        className={`${styles.themeBtn} ${theme !== 'light' ? styles.themeBtnDark : ''}`}
        onClick={cycleTheme}
        aria-label={`Map theme: ${theme}`}
      >
        {theme === 'light' ? <Sun size={17} strokeWidth={2} /> :
         theme === 'dark'  ? <Moon size={17} strokeWidth={2} /> :
         <Sparkles size={17} strokeWidth={2} />}
      </button>
    </div>
  );
}
