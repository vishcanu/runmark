import { useRef, useEffect } from 'react';
import { useMap } from '../hooks/useMap';
import { UserMarker } from './UserMarker';
import { TerritoryLayer } from './TerritoryLayer';
import { PathLayer } from './PathLayer';
import { BuildingLayer } from '../../building/components/BuildingLayer';
import { ParkLayer } from '../../parks/components/ParkLayer';
import type { Territory, Coordinate } from '../../../types';
import type { Park } from '../../parks/types';
import styles from './MapView.module.css';

interface MapViewProps {
  userPosition: Coordinate | null;
  territories: Territory[];
  activePath: Coordinate[];
  selectedTerritoryId: string | null;
  onTerritoryClick: (id: string) => void;
  parks: Park[];
  closestParkId: string | null;
}

export function MapView({
  userPosition,
  territories,
  activePath,
  selectedTerritoryId,
  onTerritoryClick,
  parks,
  closestParkId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, isReady, flyTo } = useMap(containerRef);

  // Fly to user on first position fix
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (userPosition && isReady && !hasCenteredRef.current) {
      flyTo(userPosition, 16);
      hasCenteredRef.current = true;
    }
  }, [userPosition, isReady, flyTo]);

  return (
    <div className={styles.container} ref={containerRef}>
      {isReady && map && (
        <>
          <ParkLayer map={map} parks={parks} closestParkId={closestParkId} />
          <UserMarker map={map} position={userPosition} />
          <TerritoryLayer
            map={map}
            territories={territories}
            selectedId={selectedTerritoryId}
            onTerritoryClick={onTerritoryClick}
          />
          <PathLayer map={map} path={activePath} />
          <BuildingLayer map={map} territories={territories} />
        </>
      )}
    </div>
  );
}
