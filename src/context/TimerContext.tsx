import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_TIMER_STATE } from '../types/timer';
import type { TimerState, StageColor, AutoAdvanceMode, QueuedTimerItem } from '../types/timer';
import { formatTime } from '../utils/time';

const STORAGE_KEY = 'STAGE_TIMER_STATE_V2';
const CHANNEL_NAME = 'STAGE_TIMER_SYNC_CHANNEL';

interface TimerContextValue {
  state: TimerState;
  queueTime: (hours: number, minutes: number, seconds?: number) => void;
  startWithQueued: () => void;
  pushQueueToLive: () => void;
  loadQueueToStage: (hours?: number, minutes?: number, seconds?: number) => void;
  toggleBlackout: () => void;
  toggleRunPause: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  addTimeToLive: (hours: number, minutes: number, seconds?: number) => void;
  subtractTimeFromLive: (hours: number, minutes: number, seconds?: number) => void;
  adjustRemainingTime: (deltaSeconds: number) => void;
  setLiveDuration: (hours: number, minutes: number, seconds?: number) => void;
  setColorScheme: (color: StageColor) => void;

  // Multi-timer queue (up to 5 items)
  addToQueue: (hours: number, minutes: number, seconds?: number, title?: string) => boolean;
  removeFromQueue: (id: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  updateQueueItemTitle: (id: string, title: string) => void;
  clearQueue: () => void;
  playQueueItem: (id: string) => void;
  loadQueueItemToStage: (id: string) => void;
  playNextInQueue: () => void;
  loadNextInQueueToStage: () => void;
  setAutoAdvanceMode: (mode: AutoAdvanceMode) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function loadInitialState(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Filter out any leftover hardcoded seed items ('q-1', 'q-2') so queue defaults to completely empty
      const rawQueue: QueuedTimerItem[] = Array.isArray(parsed.timerQueue)
        ? parsed.timerQueue
        : [];
      const timerQueue = rawQueue.filter((item) => item.id !== 'q-1' && item.id !== 'q-2');
      const autoAdvanceMode: AutoAdvanceMode = parsed.autoAdvanceMode || 'manual';
      const activeQueueItemId =
        parsed.activeQueueItemId === 'q-1' || parsed.activeQueueItemId === 'q-2'
          ? null
          : parsed.activeQueueItemId || null;

      if (parsed.status === 'running' && parsed.targetEndTime) {
        const remaining = Math.max(0, Math.ceil((parsed.targetEndTime - Date.now()) / 1000));
        return {
          ...DEFAULT_TIMER_STATE,
          ...parsed,
          queuedHours: parsed.queuedHours || 0,
          remainingSeconds: remaining,
          status: remaining > 0 ? 'running' : 'finished',
          finishedAt: remaining > 0 ? null : (parsed.finishedAt || Date.now()),
          timerQueue,
          autoAdvanceMode,
          activeQueueItemId,
        };
      }
      return {
        ...DEFAULT_TIMER_STATE,
        ...parsed,
        queuedHours: parsed.queuedHours || 0,
        finishedAt: parsed.finishedAt || null,
        timerQueue,
        autoAdvanceMode,
        activeQueueItemId,
      };
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
        const finishTime = Date.now();
        updateStateAndBroadcast((prev) => ({
          ...prev,
          remainingSeconds: 0,
          status: 'finished',
          finishedAt: prev.finishedAt || finishTime,
          targetEndTime: null,
          lastUpdated: finishTime,
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

  // Queue time supporting Hours, Minutes, Seconds
  const queueTime = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    const clampedHrs = Math.max(0, Math.min(99, hours));
    const clampedMins = Math.max(0, Math.min(59, minutes));
    const clampedSecs = Math.max(0, Math.min(59, seconds));
    updateStateAndBroadcast((prev) => ({
      ...prev,
      queuedHours: clampedHrs,
      queuedMinutes: clampedMins,
      queuedSeconds: clampedSecs,
      lastUpdated: Date.now(),
      lastAction: `Queued ${clampedHrs > 0 ? String(clampedHrs).padStart(2, '0') + ':' : ''}${String(clampedMins).padStart(2, '0')}:${String(clampedSecs).padStart(2, '0')}`,
    }));
  }, [updateStateAndBroadcast]);

  // Push the currently queued time directly to the live projection and run/jump
  const pushQueueToLive = useCallback(() => {
    const current = stateRef.current;
    const total = (current.queuedHours || 0) * 3600 + (current.queuedMinutes || 0) * 60 + (current.queuedSeconds || 0);
    const validTotal = total > 0 ? total : 600;
    const now = Date.now();

    updateStateAndBroadcast((prev) => ({
      ...prev,
      totalSeconds: validTotal,
      remainingSeconds: validTotal,
      status: 'running',
      targetEndTime: now + validTotal * 1000,
      finishedAt: null,
      isBlackout: false,
      lastUpdated: now,
      lastAction: `Jumped to ${formatTime(validTotal).text}`,
    }));
  }, [updateStateAndBroadcast]);

  // Load the queued time onto the stage display in idle / ready mode (waiting for speaker to speak)
  const loadQueueToStage = useCallback((hours?: number, minutes?: number, seconds?: number) => {
    const current = stateRef.current;
    const h = hours !== undefined ? hours : (current.queuedHours || 0);
    const m = minutes !== undefined ? minutes : (current.queuedMinutes || 0);
    const s = seconds !== undefined ? seconds : (current.queuedSeconds || 0);
    const total = h * 3600 + m * 60 + s;
    const validTotal = total > 0 ? total : 600;
    const now = Date.now();

    updateStateAndBroadcast((prev) => ({
      ...prev,
      queuedHours: h,
      queuedMinutes: m,
      queuedSeconds: s,
      totalSeconds: validTotal,
      remainingSeconds: validTotal,
      status: 'idle',
      targetEndTime: null,
      finishedAt: null,
      isBlackout: false,
      lastUpdated: now,
      lastAction: `Loaded ${formatTime(validTotal).text} to Stage (Ready)`,
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
      finishedAt: null,
      lastUpdated: Date.now(),
      lastAction: 'Paused',
    }));
  }, [updateStateAndBroadcast]);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'paused' && current.status !== 'idle') return;

    const remaining = current.remainingSeconds > 0 ? current.remainingSeconds : (current.totalSeconds || 600);
    const now = Date.now();

    updateStateAndBroadcast((prev) => ({
      ...prev,
      remainingSeconds: remaining,
      totalSeconds: prev.totalSeconds || remaining,
      status: 'running',
      targetEndTime: now + remaining * 1000,
      finishedAt: null,
      isBlackout: false,
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
      finishedAt: null,
      lastUpdated: Date.now(),
      lastAction: 'Stopped',
    }));
  }, [updateStateAndBroadcast]);

  const reset = useCallback(() => {
    updateStateAndBroadcast((prev) => {
      const resetTime = prev.totalSeconds > 0 ? prev.totalSeconds : 600;
      return {
        ...prev,
        remainingSeconds: resetTime,
        status: 'idle',
        targetEndTime: null,
        finishedAt: null,
        isBlackout: false,
        lastUpdated: Date.now(),
        lastAction: 'Reset to Ready',
      };
    });
  }, [updateStateAndBroadcast]);

  const addTimeToLive = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    const delta = hours * 3600 + minutes * 60 + seconds;
    if (delta <= 0) return;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      if (prev.status === 'finished') {
        return {
          ...prev,
          remainingSeconds: delta,
          totalSeconds: Math.max(prev.totalSeconds, delta),
          targetEndTime: now + delta * 1000,
          status: 'running',
          finishedAt: null,
          isBlackout: false,
          lastUpdated: now,
          lastAction: `Added +${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`,
        };
      }
      let newRemaining = prev.remainingSeconds + delta;
      if (prev.status === 'running' && prev.targetEndTime) {
        const newTarget = prev.targetEndTime + delta * 1000;
        newRemaining = Math.max(0, Math.ceil((newTarget - now) / 1000));
        return {
          ...prev,
          remainingSeconds: newRemaining,
          targetEndTime: newTarget,
          status: 'running',
          finishedAt: null,
          isBlackout: false,
          lastUpdated: now,
          lastAction: `Added +${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`,
        };
      } else {
        return {
          ...prev,
          remainingSeconds: newRemaining,
          totalSeconds: Math.max(prev.totalSeconds, newRemaining),
          finishedAt: null,
          isBlackout: false,
          lastUpdated: now,
          lastAction: `Added +${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`,
        };
      }
    });
  }, [updateStateAndBroadcast]);

  const subtractTimeFromLive = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    const delta = hours * 3600 + minutes * 60 + seconds;
    if (delta <= 0) return;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      let newRemaining = Math.max(0, prev.remainingSeconds - delta);
      if (prev.status === 'running' && prev.targetEndTime) {
        const newTarget = Math.max(now, prev.targetEndTime - delta * 1000);
        newRemaining = Math.max(0, Math.ceil((newTarget - now) / 1000));
        const isFinished = newRemaining === 0;
        return {
          ...prev,
          remainingSeconds: newRemaining,
          targetEndTime: isFinished ? null : newTarget,
          status: isFinished ? 'finished' : 'running',
          finishedAt: isFinished ? (prev.finishedAt || now) : null,
          lastUpdated: now,
          lastAction: `Subtracted -${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`,
        };
      } else {
        const isFinished = newRemaining === 0 && prev.status !== 'idle';
        return {
          ...prev,
          remainingSeconds: newRemaining,
          status: isFinished ? 'finished' : prev.status,
          finishedAt: isFinished ? (prev.finishedAt || now) : null,
          lastUpdated: now,
          lastAction: `Subtracted -${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`,
        };
      }
    });
  }, [updateStateAndBroadcast]);

  const adjustRemainingTime = useCallback((deltaSeconds: number) => {
    if (deltaSeconds >= 0) {
      addTimeToLive(0, 0, deltaSeconds);
    } else {
      subtractTimeFromLive(0, 0, Math.abs(deltaSeconds));
    }
  }, [addTimeToLive, subtractTimeFromLive]);

  const setLiveDuration = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    const newTotal = hours * 3600 + minutes * 60 + seconds;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      const isRunning = prev.status === 'running';
      return {
        ...prev,
        totalSeconds: newTotal,
        remainingSeconds: newTotal,
        targetEndTime: isRunning ? now + newTotal * 1000 : null,
        status: isRunning ? 'running' : prev.status,
        finishedAt: null,
        isBlackout: false,
        lastUpdated: now,
        lastAction: `Set to ${formatTime(newTotal).text}`,
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

  // Multi-timer queue management (up to 5 items)
  const addToQueue = useCallback(
    (hours: number, minutes: number, seconds: number = 0, title?: string) => {
      const current = stateRef.current;
      const queue = current.timerQueue || [];
      if (queue.length >= 5) {
        return false;
      }

      const clampedHrs = Math.max(0, Math.min(99, hours));
      const clampedMins = Math.max(0, Math.min(59, minutes));
      const clampedSecs = Math.max(0, Math.min(59, seconds));
      const total = clampedHrs * 3600 + clampedMins * 60 + clampedSecs;
      if (total <= 0) return false;

      const newId = `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const formatted = formatTime(total).text;
      const itemTitle = title?.trim() || `${formatted} Countdown`;

      const newItem: QueuedTimerItem = {
        id: newId,
        title: itemTitle,
        hours: clampedHrs,
        minutes: clampedMins,
        seconds: clampedSecs,
        totalSeconds: total,
      };

      updateStateAndBroadcast((prev) => ({
        ...prev,
        timerQueue: [...(prev.timerQueue || []), newItem],
        lastUpdated: Date.now(),
        lastAction: `Added "${itemTitle}" to Queue`,
      }));
      return true;
    },
    [updateStateAndBroadcast]
  );

  const removeFromQueue = useCallback(
    (id: string) => {
      updateStateAndBroadcast((prev) => {
        const filtered = (prev.timerQueue || []).filter((item) => item.id !== id);
        return {
          ...prev,
          timerQueue: filtered,
          activeQueueItemId: prev.activeQueueItemId === id ? null : prev.activeQueueItemId,
          lastUpdated: Date.now(),
          lastAction: 'Removed timer from Queue',
        };
      });
    },
    [updateStateAndBroadcast]
  );

  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateStateAndBroadcast((prev) => {
        const queue = [...(prev.timerQueue || [])];
        if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) {
          return prev;
        }
        const [moved] = queue.splice(fromIndex, 1);
        queue.splice(toIndex, 0, moved);
        return {
          ...prev,
          timerQueue: queue,
          lastUpdated: Date.now(),
        };
      });
    },
    [updateStateAndBroadcast]
  );

  const updateQueueItemTitle = useCallback(
    (id: string, title: string) => {
      updateStateAndBroadcast((prev) => ({
        ...prev,
        timerQueue: (prev.timerQueue || []).map((item) =>
          item.id === id ? { ...item, title: title.trim() || item.title } : item
        ),
        lastUpdated: Date.now(),
      }));
    },
    [updateStateAndBroadcast]
  );

  const clearQueue = useCallback(() => {
    updateStateAndBroadcast((prev) => ({
      ...prev,
      timerQueue: [],
      activeQueueItemId: null,
      lastUpdated: Date.now(),
      lastAction: 'Cleared Queue',
    }));
  }, [updateStateAndBroadcast]);

  const playQueueItem = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const item = (current.timerQueue || []).find((q) => q.id === id);
      if (!item) return;

      const now = Date.now();
      updateStateAndBroadcast((prev) => ({
        ...prev,
        activeQueueItemId: id,
        totalSeconds: item.totalSeconds,
        remainingSeconds: item.totalSeconds,
        status: 'running',
        targetEndTime: now + item.totalSeconds * 1000,
        finishedAt: null,
        isBlackout: false,
        lastUpdated: now,
        lastAction: `Started ${item.title}`,
      }));
    },
    [updateStateAndBroadcast]
  );

  const loadQueueItemToStage = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const item = (current.timerQueue || []).find((q) => q.id === id);
      if (!item) return;

      const now = Date.now();
      updateStateAndBroadcast((prev) => ({
        ...prev,
        activeQueueItemId: id,
        totalSeconds: item.totalSeconds,
        remainingSeconds: item.totalSeconds,
        status: 'idle',
        targetEndTime: null,
        finishedAt: null,
        isBlackout: false,
        lastUpdated: now,
        lastAction: `Loaded ${item.title} to Stage (Ready)`,
      }));
    },
    [updateStateAndBroadcast]
  );

  const playNextInQueue = useCallback(() => {
    const current = stateRef.current;
    const queue = current.timerQueue || [];
    if (queue.length === 0) return;

    const currentIndex = queue.findIndex((item) => item.id === current.activeQueueItemId);
    const nextItem =
      currentIndex >= 0 && currentIndex < queue.length - 1
        ? queue[currentIndex + 1]
        : queue[0];

    if (nextItem) {
      playQueueItem(nextItem.id);
    }
  }, [playQueueItem]);

  const loadNextInQueueToStage = useCallback(() => {
    const current = stateRef.current;
    const queue = current.timerQueue || [];
    if (queue.length === 0) return;

    const currentIndex = queue.findIndex((item) => item.id === current.activeQueueItemId);
    const nextItem =
      currentIndex >= 0 && currentIndex < queue.length - 1
        ? queue[currentIndex + 1]
        : queue[0];

    if (nextItem) {
      loadQueueItemToStage(nextItem.id);
    }
  }, [loadQueueItemToStage]);

  const setAutoAdvanceMode = useCallback(
    (mode: AutoAdvanceMode) => {
      updateStateAndBroadcast((prev) => ({
        ...prev,
        autoAdvanceMode: mode,
        lastUpdated: Date.now(),
        lastAction: `Mode: ${mode === 'manual' ? 'Manual' : mode === 'auto-ready' ? 'Auto-Load Ready' : 'Auto-Start Next'}`,
      }));
    },
    [updateStateAndBroadcast]
  );

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
    addToQueue,
    removeFromQueue,
    reorderQueue,
    updateQueueItemTitle,
    clearQueue,
    playQueueItem,
    loadQueueItemToStage,
    playNextInQueue,
    loadNextInQueueToStage,
    setAutoAdvanceMode,
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
