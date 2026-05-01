import { useState, useEffect, useRef } from 'react';
import type { Coordinate } from '../../../types';

export interface GeolocationState {
  position: Coordinate | null;
  accuracy: number | null;
  error: string | null;
  isWatching: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    accuracy: null,
    error: null,
    isWatching: false,
  });

  const watchIdRef = useRef<number | null>(null);

  // Auto-fetch a one-shot initial position on mount so parks load immediately
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState((prev) =>
          prev.position
            ? prev // already have a more accurate position from watchPosition
            : {
                ...prev,
                position: [pos.coords.longitude, pos.coords.latitude],
                accuracy: pos.coords.accuracy,
              }
        );
      },
      () => { /* silently ignore — watchPosition will surface the error */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const startWatching = () => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, error: 'Geolocation not supported.' }));
      return;
    }

    setState((prev) => ({ ...prev, isWatching: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: [pos.coords.longitude, pos.coords.latitude],
          accuracy: pos.coords.accuracy,
          error: null,
          isWatching: true,
        });
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          error: err.message,
          isWatching: false,
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );
  };

  const stopWatching = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isWatching: false }));
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { ...state, startWatching, stopWatching };
}
