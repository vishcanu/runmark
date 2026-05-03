import { useState, useRef, useCallback, useEffect } from 'react';
import type { ActivitySession, Coordinate } from '../../../types';
import { haversineDistance, totalPathDistance } from '../../map/utils/geo';

function generateId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const INITIAL_SESSION: ActivitySession = {
  id: '',
  status: 'idle',
  path: [],
  startTime: null,
  endTime: null,
  distance: 0,
};

export function useActivityTracker() {
  const [session, setSession] = useState<ActivitySession>(INITIAL_SESSION);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second when active
  useEffect(() => {
    if (session.status === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session.status]);

  const start = useCallback(() => {
    setElapsedSeconds(0);
    setSession({
      id: generateId(),
      status: 'active',
      path: [],
      startTime: Date.now(),
      endTime: null,
      distance: 0,
    });
  }, []);

  const addPosition = useCallback((coord: Coordinate) => {
    setSession((prev) => {
      if (prev.status !== 'active') return prev;

      const lastPoint = prev.path[prev.path.length - 1];
      const dist = lastPoint
        ? haversineDistance(lastPoint, coord)
        : 0;

      // Ignore jitter under 5 metres
      if (dist < 5 && prev.path.length > 0) return prev;

      return {
        ...prev,
        path: [...prev.path, coord],
        distance: Math.round(prev.distance + dist),
      };
    });
  }, []);

  const stop = useCallback((): ActivitySession => {
    let completed = INITIAL_SESSION;
    setSession((prev) => {
      completed = {
        ...prev,
        status: 'completed',
        endTime: Date.now(),
        distance: totalPathDistance(prev.path),
      };
      return completed;
    });
    setElapsedSeconds(0);
    return completed;
  }, []);

  const reset = useCallback(() => {
    setSession(INITIAL_SESSION);
    setElapsedSeconds(0);
  }, []);

  return { session, elapsedSeconds, start, addPosition, stop, reset };
}
