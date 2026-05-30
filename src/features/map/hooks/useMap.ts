import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { setMapInstance } from '../mapSingleton';

const DEFAULT_CENTER: [number, number] = [77.5946, 12.9716]; // Bengaluru fallback — GPS will override immediately
const DEFAULT_ZOOM = 13;
const DEFAULT_PITCH = 50; // 3D tilt angle (0 = top-down, 60 = max)

export type MapTheme = 'light' | 'dark' | 'night';

const THEME_STYLES: Record<MapTheme, string> = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark:  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  night: 'https://tiles.openfreemap.org/styles/liberty',
};

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

  // Buildings — hidden completely (flat footprints + 3D extrusions)
  // Only streets/roads remain visible, like Google Maps style
  const hide = (layer: string) => {
    try {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', 'none');
    } catch { /* layer may not exist at this zoom */ }
  };
  hide('building');
  hide('building-3d');

  // ── Hide road names, POI icons, neighbourhood labels ─────────────────────
  // Keep: water names (lakes, rivers, ocean), park labels — useful for
  // navigation context. Hide: road labels, shields, POI, place names.
  const OWN_PREFIXES = [
    'territories-', 'ghost-territories-',
    'active-path-', 'construction-', 'buildings-',
  ];
  // Layer-id prefixes/substrings we want to KEEP visible from the base style
  const KEEP_PREFIXES = ['water-name', 'park'];
  (map.getStyle()?.layers ?? []).forEach((l) => {
    if (l.type !== 'symbol') return;
    if (OWN_PREFIXES.some((p) => l.id.startsWith(p))) return;
    if (KEEP_PREFIXES.some((p) => l.id.startsWith(p))) return;
    try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch { /* skip */ }
  });
}

// ── Dark theme (CartoDB Dark Matter base) ────────────────────────────
// CartoDB is already styled dark — just hide labels and buildings universally.
function applyDarkTheme(map: Map) {
  ['building', 'building-3d', 'building-extrusion'].forEach((l) => {
    try { if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'none'); } catch { /* ok */ }
  });
  const OWN = ['territories-', 'ghost-territories-', 'active-path-', 'construction-', 'buildings-'];
  (map.getStyle()?.layers ?? []).forEach((l) => {
    if (l.type !== 'symbol') return;
    if (OWN.some((p) => l.id.startsWith(p))) return;
    try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch { /* ok */ }
  });
}

// ── Night theme (OFM Liberty + deep-dark tactical overrides) ───────────
function applyNightTheme(map: Map) {
  applyRunMarkTheme(map); // inherit label hiding, building hiding, base structure
  const set = (layer: string, prop: string, value: unknown) => {
    try { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value); } catch { /* ok */ }
  };
  set('background',                    'background-color', '#09090f');
  set('landcover-grass',               'fill-color',       '#0b1510');
  set('landcover-wood',                'fill-color',       '#091210');
  set('landcover-sand',                'fill-color',       '#0d0d08');
  set('landcover-ice',                 'fill-color',       '#0c1025');
  set('landuse-residential',           'fill-color',       '#0c0f1c');
  set('landuse-commercial',            'fill-color',       '#0d1020');
  set('landuse-industrial',            'fill-color',       '#0c0e1a');
  set('landuse-retail',                'fill-color',       '#0b0d18');
  set('landuse-cemetery',              'fill-color',       '#0a1412');
  set('landuse-garages',               'fill-color',       '#0b0e18');
  set('landuse-military',              'fill-color',       '#0e0c0a');
  set('park',                          'fill-color',       '#091a10');
  set('park-outline',                  'line-color',       '#0f2018');
  set('nature-green',                  'fill-color',       '#091a0e');
  set('hospital',                      'fill-color',       '#180a0a');
  set('school',                        'fill-color',       '#100e08');
  set('pitch',                         'fill-color',       '#0a1a0e');
  set('stadium',                       'fill-color',       '#0c1c0c');
  set('water-shadow',                  'fill-color',       '#040b22');
  set('water',                         'fill-color',       '#050f2c');
  set('road-path',                     'line-color',       '#141820');
  set('road-track',                    'line-color',       '#141820');
  set('road-service-link-tunnel',      'line-color',       '#161a26');
  set('road-street',                   'line-color',       '#1c2038');
  set('road-street-low',               'line-color',       '#1c2038');
  set('road-street-case',              'line-color',       '#10141e');
  set('road-secondary-tertiary',       'line-color',       '#202540');
  set('road-secondary-tertiary-case',  'line-color',       '#141828');
  set('road-primary',                  'line-color',       '#242e4a');
  set('road-primary-case',             'line-color',       '#161c30');
  set('road-trunk',                    'line-color',       '#222018');
  set('road-trunk-case',               'line-color',       '#181510');
  set('road-motorway',                 'line-color',       '#222018');
  set('road-motorway-case',            'line-color',       '#181510');
  set('road-motorway-trunk',           'line-color',       '#222018');
  set('road-motorway-trunk-case',      'line-color',       '#181510');
  set('road-rail',                     'line-color',       '#141820');
  set('road-rail-tracks',              'line-color',       '#141820');
}

export function useMap(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<Map | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [theme, setThemeState] = useState<MapTheme>(
    () => (localStorage.getItem('map-theme') as MapTheme | null) ?? 'light',
  );
  const themeRef = useRef<MapTheme>(theme);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: THEME_STYLES[themeRef.current],
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      bearing: 0,
      pitch: DEFAULT_PITCH,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    let initialized = false;
    map.on('style.load', () => {
      if (themeRef.current === 'dark')        applyDarkTheme(map);
      else if (themeRef.current === 'night') applyNightTheme(map);
      else                                   applyRunMarkTheme(map);
      if (!initialized) {
        initialized = true;
        setMapInstance(map);
        setIsReady(true);
      }
      setStyleVersion((v) => v + 1);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
      setIsReady(false);
    };
  }, [containerRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTheme = useCallback((newTheme: MapTheme) => {
    themeRef.current = newTheme;
    setThemeState(newTheme);
    localStorage.setItem('map-theme', newTheme);
    mapRef.current?.setStyle(THEME_STYLES[newTheme]);
  }, []);

  const flyTo = useCallback((center: [number, number], zoom?: number) => {
    mapRef.current?.flyTo({ center, zoom: zoom ?? DEFAULT_ZOOM, pitch: DEFAULT_PITCH, duration: 800 });
  }, []);

  return { map: mapRef.current, mapRef, isReady, flyTo, theme, setTheme, styleVersion };
}
