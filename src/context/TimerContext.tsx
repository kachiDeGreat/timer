import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_TIMER_STATE } from '../types/timer';
import type { TimerState, StageColor } from '../types/timer';

const STORAGE_KEY = 'STAGE_TIMER_STATE_V2';
const CHANNEL_NAME = 'STAGE_TIMER_SYNC_CHANNEL';

interface TimerContextValue {
  state: TimerState;
  queueTime: (minutes: number, seconds?: number) => void;
  startWithQueued: () => void;
  pushQueueToLive: () => void;
  loadQueueToStage: (minutes?: number, seconds?: number) => void;
  toggleBlackout: () => void;
  toggleRunPause: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  addTimeToLive: (minutes: number, seconds?: number) => void;
  subtractTimeFromLive: (minutes: number, seconds?: number) => void;
  adjustRemainingTime: (deltaSeconds: number) => void;
  setLiveDuration: (minutes: number, seconds?: number) => void;
  setColorScheme: (color: StageColor) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function loadInitialState(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.status === 'running' && parsed.targetEndTime) {
        const remaining = Math.max(0, Math.ceil((parsed.targetEndTime - Date.now()) / 1000));
        return {
          ...DEFAULT_TIMER_STATE,
          ...parsed,
          remainingSeconds: remaining,
          status: remaining > 0 ? 'running' : 'finished',
        };
      }
      return { ...DEFAULT_TIMER_STATE, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to parse timer state:', e);
  }
  return DEFAULT_TIMER_STATE;
}

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TimerState>(loadInitialState);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const broadcastState = useCallback((newState: TimerState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'SYNC_STATE', payload: newState });
      }
    } catch (e) {
      console.warn('Broadcast failed:', e);
    }
  }, []);

  const updateStateAndBroadcast = useCallback((updater: (prev: TimerState) => TimerState) => {
    setState((prev) => {
      const updated = updater(prev);
      broadcastState(updated);
      return updated;
    });
  }, [broadcastState]);

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = bc;

      bc.onmessage = (event) => {
        if (event.data?.type === 'SYNC_STATE' && event.data.payload) {
          const incoming: TimerState = event.data.payload;
          setState((prev) => {
            if (incoming.lastUpdated >= prev.lastUpdated) {
              return incoming;
            }
            return prev;
          });
        }
      };
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setState(parsed);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Interval timer for drift-free countdown
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const current = stateRef.current;
      if (current.status !== 'running' || !current.targetEndTime) {
        return;
      }

      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((current.targetEndTime - now) / 1000));

      if (remaining === 0) {
        updateStateAndBroadcast((prev) => ({
          ...prev,
          remainingSeconds: 0,
          status: 'finished',
          targetEndTime: null,
          lastUpdated: Date.now(),
          lastAction: 'Time Up!',
        }));
      } else if (remaining !== current.remainingSeconds) {
        setState((prev) => ({
          ...prev,
          remainingSeconds: remaining,
        }));
      }
    }, 200);

    return () => clearInterval(timerInterval);
  }, [updateStateAndBroadcast]);

  // Actions
  const queueTime = useCallback((minutes: number, seconds: number = 0) => {
    const clampedMins = Math.max(0, Math.min(999, minutes));
    const clampedSecs = Math.max(0, Math.min(59, seconds));
    updateStateAndBroadcast((prev) => ({
      ...prev,
      queuedMinutes: clampedMins,
      queuedSeconds: clampedSecs,
      lastUpdated: Date.now(),
      lastAction: `Queued ${String(clampedMins).padStart(2, '0')}:${String(clampedSecs).padStart(2, '0')}`,
    }));
  }, [updateStateAndBroadcast]);

  // Push the currently queued time directly to the live projection and run/jump
  const pushQueueToLive = useCallback(() => {
    const current = stateRef.current;
    const total = current.queuedMinutes * 60 + current.queuedSeconds;
    const validTotal = total > 0 ? total : 600;
    const now = Date.now();

    updateStateAndBroadcast((prev) => ({
      ...prev,
      totalSeconds: validTotal,
      remainingSeconds: validTotal,
      status: 'running',
      targetEndTime: now + validTotal * 1000,
      isBlackout: false,
      lastUpdated: now,
      lastAction: `Jumped to ${String(Math.floor(validTotal / 60)).padStart(2, '0')}:${String(validTotal % 60).padStart(2, '0')}`,
    }));
  }, [updateStateAndBroadcast]);

  // Load the queued time onto the stage display in idle / ready mode (waiting for speaker to speak)
  const loadQueueToStage = useCallback((minutes?: number, seconds?: number) => {
    const current = stateRef.current;
    const m = minutes !== undefined ? minutes : current.queuedMinutes;
    const s = seconds !== undefined ? seconds : current.queuedSeconds;
    const total = m * 60 + s;
    const validTotal = total > 0 ? total : 600;
    const now = Date.now();

    updateStateAndBroadcast((prev) => ({
      ...prev,
      queuedMinutes: m,
      queuedSeconds: s,
      totalSeconds: validTotal,
      remainingSeconds: validTotal,
      status: 'idle',
      targetEndTime: null,
      isBlackout: false,
      lastUpdated: now,
      lastAction: `Loaded ${String(Math.floor(validTotal / 60)).padStart(2, '0')}:${String(validTotal % 60).padStart(2, '0')} to Stage (Ready)`,
    }));
  }, [updateStateAndBroadcast]);

  const toggleBlackout = useCallback(() => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      isBlackout: !prev.isBlackout,
      lastUpdated: Date.now(),
      lastAction: !prev.isBlackout ? 'Stage Screen Blackout' : 'Stage Screen Active',
    }));
  }, [updateStateAndBroadcast]);

  const startWithQueued = useCallback(() => {
    pushQueueToLive();
  }, [pushQueueToLive]);

  const pause = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'running' || !current.targetEndTime) return;

    const remaining = Math.max(0, Math.ceil((current.targetEndTime - Date.now()) / 1000));
    updateStateAndBroadcast((prev) => ({
      ...prev,
      remainingSeconds: remaining,
      status: 'paused',
      targetEndTime: null,
      lastUpdated: Date.now(),
      lastAction: 'Paused',
    }));
  }, [updateStateAndBroadcast]);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'paused' && current.status !== 'idle') return;

    const remaining = current.remainingSeconds > 0 ? current.remainingSeconds : (current.queuedMinutes * 60 + current.queuedSeconds || 600);
    const now = Date.now();

    updateStateAndBroadcast((prev) => ({
      ...prev,
      remainingSeconds: remaining,
      totalSeconds: prev.totalSeconds || remaining,
      status: 'running',
      targetEndTime: now + remaining * 1000,
      lastUpdated: now,
      lastAction: 'Running',
    }));
  }, [updateStateAndBroadcast]);

  const toggleRunPause = useCallback(() => {
    const current = stateRef.current;
    if (current.status === 'running') {
      pause();
    } else if (current.status === 'paused') {
      resume();
    } else {
      pushQueueToLive();
    }
  }, [pause, resume, pushQueueToLive]);

  const stop = useCallback(() => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      remainingSeconds: 0,
      status: 'idle',
      targetEndTime: null,
      lastUpdated: Date.now(),
      lastAction: 'Stopped',
    }));
  }, [updateStateAndBroadcast]);

  const reset = useCallback(() => {
    updateStateAndBroadcast((prev) => {
      const resetTime = prev.totalSeconds > 0 ? prev.totalSeconds : (prev.queuedMinutes * 60 + prev.queuedSeconds || 600);
      return {
        ...prev,
        remainingSeconds: resetTime,
        status: 'idle',
        targetEndTime: null,
        lastUpdated: Date.now(),
        lastAction: 'Reset',
      };
    });
  }, [updateStateAndBroadcast]);

  const addTimeToLive = useCallback((minutes: number, seconds: number = 0) => {
    const delta = minutes * 60 + seconds;
    if (delta <= 0) return;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      let newRemaining = prev.remainingSeconds + delta;
      if (prev.status === 'running' && prev.targetEndTime) {
        const newTarget = prev.targetEndTime + delta * 1000;
        newRemaining = Math.max(0, Math.ceil((newTarget - now) / 1000));
        return {
          ...prev,
          remainingSeconds: newRemaining,
          targetEndTime: newTarget,
          status: 'running',
          lastUpdated: now,
          lastAction: `Added +${minutes}m ${seconds}s`,
        };
      } else {
        return {
          ...prev,
          remainingSeconds: newRemaining,
          totalSeconds: Math.max(prev.totalSeconds, newRemaining),
          lastUpdated: now,
          lastAction: `Added +${minutes}m ${seconds}s`,
        };
      }
    });
  }, [updateStateAndBroadcast]);

  const subtractTimeFromLive = useCallback((minutes: number, seconds: number = 0) => {
    const delta = minutes * 60 + seconds;
    if (delta <= 0) return;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      let newRemaining = Math.max(0, prev.remainingSeconds - delta);
      if (prev.status === 'running' && prev.targetEndTime) {
        const newTarget = Math.max(now, prev.targetEndTime - delta * 1000);
        newRemaining = Math.max(0, Math.ceil((newTarget - now) / 1000));
        return {
          ...prev,
          remainingSeconds: newRemaining,
          targetEndTime: newRemaining > 0 ? newTarget : null,
          status: newRemaining > 0 ? 'running' : 'finished',
          lastUpdated: now,
          lastAction: `Subtracted -${minutes}m ${seconds}s`,
        };
      } else {
        return {
          ...prev,
          remainingSeconds: newRemaining,
          status: newRemaining === 0 && prev.status !== 'idle' ? 'finished' : prev.status,
          lastUpdated: now,
          lastAction: `Subtracted -${minutes}m ${seconds}s`,
        };
      }
    });
  }, [updateStateAndBroadcast]);

  const adjustRemainingTime = useCallback((deltaSeconds: number) => {
    if (deltaSeconds >= 0) {
      addTimeToLive(0, deltaSeconds);
    } else {
      subtractTimeFromLive(0, Math.abs(deltaSeconds));
    }
  }, [addTimeToLive, subtractTimeFromLive]);

  const setLiveDuration = useCallback((minutes: number, seconds: number = 0) => {
    const newTotal = minutes * 60 + seconds;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      const isRunning = prev.status === 'running';
      return {
        ...prev,
        totalSeconds: newTotal,
        remainingSeconds: newTotal,
        targetEndTime: isRunning ? now + newTotal * 1000 : null,
        status: isRunning ? 'running' : prev.status,
        lastUpdated: now,
        lastAction: `Set to ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      };
    });
  }, [updateStateAndBroadcast]);

  const setColorScheme = useCallback((colorScheme: StageColor) => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      colorScheme,
      lastUpdated: Date.now(),
    }));
  }, [updateStateAndBroadcast]);

  const value: TimerContextValue = {
    state,
    queueTime,
    startWithQueued,
    pushQueueToLive,
    loadQueueToStage,
    toggleBlackout,
    toggleRunPause,
    pause,
    resume,
    stop,
    reset,
    addTimeToLive,
    subtractTimeFromLive,
    adjustRemainingTime,
    setLiveDuration,
    setColorScheme,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return ctx;
}
