import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map } from 'maplibre-gl';

const DEFAULT_CENTER: [number, number] = [77.5946, 12.9716]; // Bengaluru fallback
const DEFAULT_ZOOM = 15;

// OpenFreeMap Liberty — free, vector, premium light style
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function useMap(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<Map | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      bearing: 0,
      pitch: 0,
      attributionControl: false,
    });

    map.on('load', () => {
      setIsReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setIsReady(false);
    };
  }, [containerRef]);

  const flyTo = (center: [number, number], zoom?: number) => {
    mapRef.current?.flyTo({ center, zoom: zoom ?? DEFAULT_ZOOM, duration: 800 });
  };

  return { map: mapRef.current, mapRef, isReady, flyTo };
}
