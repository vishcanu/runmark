import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { setMapInstance } from '../mapSingleton';

const DEFAULT_CENTER: [number, number] = [77.5946, 12.9716]; // Bengaluru fallback — GPS will override immediately
const DEFAULT_ZOOM = 14;
const DEFAULT_PITCH = 50; // 3D tilt angle (0 = top-down, 60 = max)

// OpenFreeMap Liberty — free, vector, premium light style
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// ── RunMark Tactical theme ───────────────────────────────────
// Called once after style loads. Overrides paint properties on
// existing Liberty layers — no source changes needed.
export function applyRunMarkTheme(map: Map) {
  // Helper: silently skip layers that don't exist at this zoom
  const set = (layer: string, prop: string, value: unknown) => {
    try {
      if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
    } catch { /* ignore */ }
  };

  // Land & background — cool blue-grey base
  set('background',             'background-color', '#edf1f7');
  set('landcover-grass',        'fill-color',       '#dde8d8');
  set('landcover-wood',         'fill-color',       '#c8d9c2');
  set('landcover-sand',         'fill-color',       '#e8e2d4');
  set('landcover-ice',          'fill-color',       '#ddeeff');

  // Landuse areas
  set('landuse-residential',    'fill-color',       '#e8ecf4');
  set('landuse-commercial',     'fill-color',       '#e4e8f2');
  set('landuse-industrial',     'fill-color',       '#dde0ec');
  set('landuse-retail',         'fill-color',       '#e6e2f0');
  set('landuse-cemetery',       'fill-color',       '#d8e4d4');
  set('landuse-garages',        'fill-color',       '#e0dcea');
  set('landuse-military',       'fill-color',       '#e4ddd8');

  // Parks & nature — soft green so territories still pop
  set('park',                   'fill-color',       '#cee8cc');
  set('park-outline',           'line-color',       '#a8c8a4');
  set('nature-green',           'fill-color',       '#cde8c8');
  set('hospital',               'fill-color',       '#f0e4e4');
  set('school',                 'fill-color',       '#e8e0d4');
  set('pitch',                  'fill-color',       '#c4dfc0');
  set('stadium',                'fill-color',       '#d4e8d0');

  // Water — brand sky-blue tint
  set('water-shadow',           'fill-color',       '#9ecbee');
  set('water',                  'fill-color',       '#a8d4f0');

  // Roads — light so they recede behind territory polygons
  set('road-path',              'line-color',       '#c8d0dc');
  set('road-track',             'line-color',       '#c8d0dc');
  set('road-service-link-tunnel','line-color',      '#d8dde8');
  set('road-street',            'line-color',       '#ffffff');
  set('road-street-low',        'line-color',       '#ffffff');
  set('road-street-case',       'line-color',       '#d0d8e4');
  set('road-secondary-tertiary','line-color',       '#f4f4f8');
  set('road-secondary-tertiary-case','line-color',  '#c4ccd8');
  set('road-primary',           'line-color',       '#f8f8fc');
  set('road-primary-case',      'line-color',       '#b8c4d4');
  set('road-trunk',             'line-color',       '#fdf0c0');
  set('road-trunk-case',        'line-color',       '#d4c080');
  set('road-motorway',          'line-color',       '#fce8a8');
  set('road-motorway-case',     'line-color',       '#d0b060');
  set('road-motorway-trunk',    'line-color',       '#fce8a8');
  set('road-motorway-trunk-case','line-color',      '#d0b060');
  set('road-rail',              'line-color',       '#c4c8d4');
  set('road-rail-tracks',       'line-color',       '#c4c8d4');

  // Buildings — subtle blue-grey so 3D extrusion looks clean
  set('building',               'fill-color',       '#d4dae8');
  set('building',               'fill-outline-color','#bcc4d8');
  set('building-3d',            'fill-extrusion-color', '#d4dae8');
  set('building-3d',            'fill-extrusion-opacity', 0.85);

  // Labels — dark slate for readability
  const labelColor = '#334155';
  const labelHalo  = 'rgba(255,255,255,0.85)';
  [
    'place-city', 'place-town', 'place-village', 'place-suburb',
    'place-neighbourhood', 'road-label', 'road-label-small',
    'poi-level-1', 'poi-level-2', 'poi-level-3',
    'water-name-lakeline', 'water-name-ocean', 'water-name-other',
  ].forEach((l) => {
    set(l, 'text-color', labelColor);
    set(l, 'text-halo-color', labelHalo);
  });
}

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
      canvasContextAttributes: { preserveDrawingBuffer: true }, // required for toDataURL()
    });

    map.on('load', () => {
      // Apply RunMark colour theme over the base Liberty style
      applyRunMarkTheme(map);

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
      setMapInstance(map);
      setIsReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
      setIsReady(false);
    };
  }, [containerRef]);

  const flyTo = (center: [number, number], zoom?: number) => {
    mapRef.current?.flyTo({ center, zoom: zoom ?? DEFAULT_ZOOM, pitch: DEFAULT_PITCH, duration: 800 });
  };

  return { map: mapRef.current, mapRef, isReady, flyTo };
}
