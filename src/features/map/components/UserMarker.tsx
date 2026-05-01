import { useEffect, useRef } from 'react';
import maplibregl, { type Map, type Marker } from 'maplibre-gl';
import type { Coordinate } from '../../../types';

interface UserMarkerProps {
  map: Map;
  position: Coordinate | null;
}

export function UserMarker({ map, position }: UserMarkerProps) {
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    // Create the DOM element for the custom marker
    const el = document.createElement('div');
    el.className = 'user-marker';
    el.style.cssText = `
      width: 20px;
      height: 20px;
      background: #4f46e5;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25), 0 2px 8px rgba(0,0,0,0.2);
      position: relative;
      z-index: 10;
    `;

    // Outer pulse ring
    const pulse = document.createElement('div');
    pulse.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      background: rgba(79, 70, 229, 0.15);
      border-radius: 50%;
      animation: pulse-ring 2s ease-out infinite;
      pointer-events: none;
    `;
    el.appendChild(pulse);

    // Inject keyframes once
    if (!document.getElementById('user-marker-style')) {
      const style = document.createElement('style');
      style.id = 'user-marker-style';
      style.textContent = `
        @keyframes pulse-ring {
          0%   { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2.0); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' });
    markerRef.current = marker;

    if (position) {
      marker.setLngLat(position).addTo(map);
    }

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // intentionally run once per map mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update marker position when GPS changes
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
