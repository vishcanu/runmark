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
 * Running person SVG — dynamic pose, white on transparent
 * Designed to look like a runner in motion (inspired by fitness app icons)
 */
const RUNNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
  fill="none" stroke="rgba(255,255,255,0.96)" stroke-width="2.2"
  stroke-linecap="round" stroke-linejoin="round">
  <!-- Head -->
  <circle cx="13" cy="4.5" r="2.2" fill="rgba(255,255,255,0.96)" stroke="none"/>
  <!-- Torso (angled forward — running lean) -->
  <line x1="12" y1="7" x2="10" y2="13"/>
  <!-- Front arm (swinging back) -->
  <line x1="11" y1="9" x2="7" y2="11"/>
  <!-- Back arm (swinging forward) -->
  <line x1="11" y1="9" x2="15" y2="7"/>
  <!-- Front leg (striding forward) -->
  <line x1="10" y1="13" x2="13" y2="18"/>
  <line x1="13" y1="18" x2="15" y2="21"/>
  <!-- Back leg (pushing off) -->
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
          background: rgba(21, 128, 61, 0.13);
          border: 1.5px solid rgba(21, 128, 61, 0.28);
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: um-pulse 2.6s ease-out infinite;
        }
        @keyframes um-pulse {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.9); opacity: 0; }
        }
        .um-direction {
          position: absolute;
          top: 50%; left: 50%;
          width: 0; height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 13px solid rgba(21,128,61,0.80);
          transform-origin: 0 9px;
          pointer-events: none;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
        }
        .um-shadow {
          position: absolute;
          bottom: -4px; left: 50%;
          transform: translateX(-50%);
          width: 18px; height: 5px;
          background: rgba(0,0,0,0.18);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(2px);
        }
      `;
      document.head.appendChild(style);
    }

    // Outer wrapper — large enough to contain accuracy ring + direction cone
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:32px;height:32px;overflow:visible;';
    wrapRef.current = wrap;

    // Accuracy / pulse ring
    const ring = document.createElement('div');
    ring.className = 'um-accuracy';
    wrap.appendChild(ring);

    // Shadow under the circle
    const shadow = document.createElement('div');
    shadow.className = 'um-shadow';
    wrap.appendChild(shadow);

    // Main circle — white ring + green fill
    const circle = document.createElement('div');
    circle.style.cssText = `
      position: absolute; inset: 0;
      background: #15803d;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 10px rgba(21,128,61,0.45), 0 1px 4px rgba(0,0,0,0.18);
      display: flex; align-items: center; justify-content: center;
      z-index: 2;
    `;
    circle.innerHTML = RUNNER_SVG;
    wrap.appendChild(circle);

    // Direction arrow cone (hidden initially, shown when heading is valid)
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

