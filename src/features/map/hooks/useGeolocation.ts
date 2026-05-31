import { useState, useEffect, useRef, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { KeepAwake } from '@capacitor-community/keep-awake';
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

  const watchIdRef = useRef<string | null>(null);

  // Auto-fetch a one-shot initial position on mount so parks load immediately
  useEffect(() => {
    Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 })
      .then((pos) => {
        setState((prev) =>
          prev.position
            ? prev
            : {
                ...prev,
                position: [pos.coords.longitude, pos.coords.latitude],
                accuracy: pos.coords.accuracy,
              }
        );
      })
      .catch(() => { /* silently ignore */ });
  }, []);

  // ── Screen Wake Lock — keeps screen on during active runs ────
  const acquireWakeLock = useCallback(async () => {
    try {
      await KeepAwake.keepAwake();
    } catch { /* device may deny — ignore */ }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await KeepAwake.allowSleep();
    } catch { /* ignore */ }
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

  const startWatching = useCallback(async () => {
    setState((prev) => ({ ...prev, isWatching: true, backgrounded: false, error: null }));
    await acquireWakeLock();

    try {
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 },
        (pos, err) => {
          if (err || !pos) {
            setState((prev) => ({
              ...prev,
              error: err?.message ?? 'Location error',
              isWatching: false,
            }));
            return;
          }
          setState({
            position: [pos.coords.longitude, pos.coords.latitude],
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading ?? null,
            error: null,
            isWatching: true,
            backgrounded: false,
          });
        }
      );
      watchIdRef.current = id;
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start location',
        isWatching: false,
      }));
    }
  }, [acquireWakeLock]);

  const stopWatching = useCallback(async () => {
    if (watchIdRef.current !== null) {
      await Geolocation.clearWatch({ id: watchIdRef.current });
      watchIdRef.current = null;
    }
    await releaseWakeLock();
    setState((prev) => ({ ...prev, isWatching: false, backgrounded: false }));
  }, [releaseWakeLock]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
      }
      KeepAwake.allowSleep().catch(() => {});
    };
  }, []);

  return { ...state, startWatching, stopWatching };
}


