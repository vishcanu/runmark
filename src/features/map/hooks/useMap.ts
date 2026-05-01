import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map } from 'maplibre-gl';

const DEFAULT_CENTER: [number, number] = [77.5946, 12.9716]; // Bengaluru fallback
const DEFAULT_ZOOM = 15;
const DEFAULT_PITCH = 50; // 3D tilt angle (0 = top-down, 60 = max)

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
      pitch: DEFAULT_PITCH,
      attributionControl: false,
    });

    map.on('load', () => {
      // Enable 3D building extrusion from the base style
      try {
        const buildingLayer = map.getLayer('building');
        if (buildingLayer) {
          map.setPaintProperty('building', 'fill-extrusion-height', [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'render_height'],
          ]);
        }
      } catch { /* style may not have building layer */ }
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
    mapRef.current?.flyTo({ center, zoom: zoom ?? DEFAULT_ZOOM, pitch: DEFAULT_PITCH, duration: 800 });
  };

  return { map: mapRef.current, mapRef, isReady, flyTo };
}
