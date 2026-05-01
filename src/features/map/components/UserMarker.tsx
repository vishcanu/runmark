import { useEffect, useRef } from 'react';
import maplibregl, { type Map, type Marker } from 'maplibre-gl';
import type { Coordinate } from '../../../types';

interface UserMarkerProps {
  map: Map;
  position: Coordinate | null;
}

// Lucide-style person SVG — rendered white on green circle
const PERSON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
  fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2.5"
  stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="8" r="4"/>
  <path d="M20 21a8 8 0 1 0-16 0"/>
</svg>`;

export function UserMarker({ map, position }: UserMarkerProps) {
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    // Inject animation keyframes once
    if (!document.getElementById('user-marker-style')) {
      const style = document.createElement('style');
      style.id = 'user-marker-style';
      style.textContent = `
        .um-ring {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 60px; height: 60px;
          border-radius: 50%;
          background: rgba(21, 128, 61, 0.16);
          animation: um-pulse 2.4s ease-out infinite;
          pointer-events: none;
        }
        @keyframes um-pulse {
          0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Wrapper — positions pulse ring behind the icon
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:40px;height:40px;';

    // Pulsing ring
    const ring = document.createElement('div');
    ring.className = 'um-ring';
    wrap.appendChild(ring);

    // Green circle with person icon
    const icon = document.createElement('div');
    icon.style.cssText = `
      position: absolute; inset: 0;
      background: #15803d;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 10px rgba(21,128,61,0.45), 0 1px 4px rgba(0,0,0,0.18);
      display: flex; align-items: center; justify-content: center;
      z-index: 1;
    `;
    icon.innerHTML = PERSON_SVG;
    wrap.appendChild(icon);

    const marker = new maplibregl.Marker({ element: wrap, anchor: 'center' });
    markerRef.current = marker;

    if (position) {
      marker.setLngLat(position).addTo(map);
    }

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update position on GPS change
  useEffect(() => {
    if (!markerRef.current) return;
    if (position) {
      markerRef.current.setLngLat(position).addTo(map);
    } else {
      markerRef.current.remove();
    }
  }, [position, map]);

  return null;
}
