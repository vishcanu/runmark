import { useState, useEffect, useRef, useCallback } from 'react';
import type { Coordinate } from '../../../types';

export interface GeolocationState {
  position: Coordinate | null;
  accuracy: number | null;
  heading: number | null;
  error: string | null;
  isWatching: boolean;
  /** True when the page went to background during an active watch */
  backgrounded: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    accuracy: null,
    heading: null,
    error: null,
    isWatching: false,
    backgrounded: false,
  });

  const watchIdRef   = useRef<number | null>(null);
  const wakeLockRef  = useRef<WakeLockSentinel | null>(null);

  // Auto-fetch a one-shot initial position on mount so parks load immediately
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState((prev) =>
          prev.position
            ? prev
            : {
                ...prev,
                position: [pos.coords.longitude, pos.coords.latitude],
                accuracy: pos.coords.accuracy,
              }
        );
      },
      () => { /* silently ignore */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // ── Screen Wake Lock — keeps screen on during active runs ────
  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      }
    } catch { /* device may deny wake lock (e.g. low battery) — ignore */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // Re-acquire wake lock when page becomes visible again (OS can steal it)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && watchIdRef.current !== null) {
        acquireWakeLock();
        setState((prev) => ({ ...prev, backgrounded: false }));
      } else if (document.visibilityState === 'hidden' && watchIdRef.current !== null) {
        setState((prev) => ({ ...prev, backgrounded: true }));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [acquireWakeLock]);

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, error: 'Geolocation not supported.' }));
      return;
    }

    setState((prev) => ({ ...prev, isWatching: true, backgrounded: false, error: null }));
    acquireWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: [pos.coords.longitude, pos.coords.latitude],
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading ?? null,
          error: null,
          isWatching: true,
          backgrounded: false,
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
        maximumAge: 1000,   // accept positions up to 1 s old
        timeout: 30000,     // generous timeout — GPS can be slow outdoors
      }
    );
  }, [acquireWakeLock]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    setState((prev) => ({ ...prev, isWatching: false, backgrounded: false }));
  }, [releaseWakeLock]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return { ...state, startWatching, stopWatching };
}


