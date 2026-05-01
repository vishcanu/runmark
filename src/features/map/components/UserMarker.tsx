import { useEffect, useRef } from 'react';
import maplibregl, { type Map, type Marker } from 'maplibre-gl';
import type { Coordinate } from '../../../types';

interface UserMarkerProps {
  map: Map;
  position: Coordinate | null;
  heading?: number | null;
  accuracy?: number | null;
}

/**
 * Running person SVG — dynamic pose, green on transparent.
 * White shadow applied via CSS filter for map readability.
 */
const RUNNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"
  fill="none" stroke="#15803d" stroke-width="2.2"
  stroke-linecap="round" stroke-linejoin="round">
  <circle cx="13" cy="4.5" r="2.2" fill="#15803d" stroke="none"/>
  <line x1="12" y1="7" x2="10" y2="13"/>
  <line x1="11" y1="9" x2="7" y2="11"/>
  <line x1="11" y1="9" x2="15" y2="7"/>
  <line x1="10" y1="13" x2="13" y2="18"/>
  <line x1="13" y1="18" x2="15" y2="21"/>
  <line x1="10" y1="13" x2="7.5" y2="17"/>
  <line x1="7.5" y1="17" x2="5" y2="18.5"/>
</svg>`;

export function UserMarker({ map, position, heading, accuracy: _accuracy }: UserMarkerProps) {
  const markerRef = useRef<Marker | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Inject styles once
    if (!document.getElementById('user-marker-style')) {
      const style = document.createElement('style');
      style.id = 'user-marker-style';
      style.textContent = `
        .um-accuracy {
          position: absolute;
          top: 50%; left: 50%;
          width: 60px; height: 60px;
          border-radius: 50%;
          background: rgba(21, 128, 61, 0.10);
          border: 1.5px solid rgba(21, 128, 61, 0.22);
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: um-pulse 2.6s ease-out infinite;
        }
        @keyframes um-pulse {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.9); opacity: 0; }
        }
        .um-icon {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          /* White halo makes the green icon readable on any map tile */
          filter:
            drop-shadow(0 0 3px #fff)
            drop-shadow(0 0 6px #fff)
            drop-shadow(0 1px 3px rgba(0,0,0,0.30));
          z-index: 2;
        }
        .um-direction {
          position: absolute;
          top: 50%; left: 50%;
          width: 0; height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 13px solid rgba(21,128,61,0.85);
          pointer-events: none;
          filter: drop-shadow(0 1px 2px rgba(255,255,255,0.9));
        }
      `;
      document.head.appendChild(style);
    }

    // Wrapper
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:32px;height:32px;overflow:visible;';
    wrapRef.current = wrap;

    // Pulse ring
    const ring = document.createElement('div');
    ring.className = 'um-accuracy';
    wrap.appendChild(ring);

    // SVG icon — no background circle, just the runner with white halo
    const icon = document.createElement('div');
    icon.className = 'um-icon';
    icon.innerHTML = RUNNER_SVG;
    wrap.appendChild(icon);

    // Direction arrow cone
    const arrow = document.createElement('div');
    arrow.id = 'um-arrow';
    arrow.className = 'um-direction';
    arrow.style.display = 'none';
    wrap.appendChild(arrow);

    const marker = new maplibregl.Marker({ element: wrap, anchor: 'center' });
    markerRef.current = marker;

    if (position) {
      marker.setLngLat(position).addTo(map);
    }

    return () => {
      marker.remove();
      markerRef.current = null;
      wrapRef.current = null;
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

  // Update direction arrow when heading changes
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const arrow = wrap.querySelector<HTMLDivElement>('#um-arrow');
    if (!arrow) return;

    if (heading != null && isFinite(heading)) {
      // Position the arrow tip at the top edge of the circle, pointing outward
      // CSS triangle: border-bottom is the "body", rotate around base center
      arrow.style.display = 'block';
      // Translate to center of marker, then rotate around base of triangle
      arrow.style.transform = `translate(-50%, calc(-100% - 18px)) rotate(${heading}deg)`;
      arrow.style.transformOrigin = '50% calc(100% + 16px)';
    } else {
      arrow.style.display = 'none';
    }
  }, [heading]);

  return null;
}

