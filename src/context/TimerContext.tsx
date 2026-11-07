import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_TIMER_STATE } from '../types/timer';
import type {
  TimerState,
  StageColor,
  AutoAdvanceMode,
  IdleDisplayMode,
  QueuedTimerItem,
  TimingReportEntry,
  TimingReportEventType,
  TimerSettings,
} from '../types/timer';
import { formatTime, hasValidTimerLabel } from '../utils/time';

const STORAGE_KEY = 'STAGE_TIMER_STATE_V2';
const CHANNEL_NAME = 'STAGE_TIMER_SYNC_CHANNEL';

export interface TimerContextValue {
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
  setIdle: () => void;
  addTimeToLive: (hours: number, minutes: number, seconds?: number) => void;
  subtractTimeFromLive: (hours: number, minutes: number, seconds?: number) => void;
  adjustRemainingTime: (deltaSeconds: number) => void;
  setLiveDuration: (hours: number, minutes: number, seconds?: number) => void;
  setColorScheme: (color: StageColor) => void;

  // Unlimited Multi-timer queue
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

  // Idle Display & Clock Settings
  setIdleDisplayMode: (mode: IdleDisplayMode) => void;
  setClockFormat24: (is24: boolean) => void;

  // Up Next Stage Alert Controls
  triggerUpNextAlert: (customTitle?: string, durationSeconds?: number) => void;
  dismissUpNextAlert: () => void;
  setUpNextTriggerSeconds: (seconds: number) => void;

  // Event Timing Report
  clearTimingReport: () => void;
  logTimingEvent: (type: TimingReportEventType, notes?: string, customLabel?: string) => void;

  // Remote Network Sync
  dispatchAction: (action: { type: string; payload?: any }) => void;
  connectedClientsCount: number;
  isWsConnected: boolean;
  isRemoteClient: boolean;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function formatTimeOfDay(ms: number, is24?: boolean): string {
  try {
    return new Date(ms).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !is24,
    });
  } catch {
    return new Date(ms).toTimeString().substring(0, 8);
  }
}

// Helper to persist only user preferences into settings.json and localStorage
function persistSettings(partialSettings: Partial<TimerSettings>) {
  try {
    const raw = localStorage.getItem('STAGE_TIMER_SETTINGS');
    const existing = raw ? JSON.parse(raw) : {};
    const updated = { ...existing, ...partialSettings };
    localStorage.setItem('STAGE_TIMER_SETTINGS', JSON.stringify(updated));
  } catch {}

  // Write to settings.json via server API
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partialSettings),
  }).catch(() => {});

  if (window.electronAPI?.saveSettings) {
    window.electronAPI.saveSettings(partialSettings).catch(() => {});
  }
}

// Helper to persist timing cues / queue into settings.json and localStorage
function persistQueue(queue: QueuedTimerItem[]) {
  try {
    localStorage.setItem('STAGE_TIMER_QUEUE', JSON.stringify(queue));
  } catch {}

  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timerQueue: queue }),
  }).catch(() => {});

  if (window.electronAPI?.saveSettings) {
    window.electronAPI.saveSettings({ timerQueue: queue }).catch(() => {});
  }
}

function loadInitialState(): TimerState {
  // Purge any stale runtime state from localStorage so past countdowns/overtime never resurrect!
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('STAGE_TIMER_STATE');
  } catch {}

  let initialSettings: TimerSettings = {
    idleDisplayMode: 'zero',
    clockFormat24: false,
    autoAdvanceMode: 'manual',
    upNextTriggerSeconds: 60,
    colorScheme: 'white',
  };

  try {
    const rawSettings = localStorage.getItem('STAGE_TIMER_SETTINGS');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed.idleDisplayMode === 'clock' || parsed.idleDisplayMode === 'zero') {
        initialSettings.idleDisplayMode = parsed.idleDisplayMode;
      }
      if (typeof parsed.clockFormat24 === 'boolean') {
        initialSettings.clockFormat24 = parsed.clockFormat24;
      }
      if (parsed.autoAdvanceMode) {
        initialSettings.autoAdvanceMode =
          parsed.autoAdvanceMode === 'auto-ready' ? 'auto-load' : parsed.autoAdvanceMode;
      }
      if (typeof parsed.upNextTriggerSeconds === 'number') {
        initialSettings.upNextTriggerSeconds = parsed.upNextTriggerSeconds;
      }
      if (typeof parsed.colorScheme === 'string' && parsed.colorScheme) {
        initialSettings.colorScheme = parsed.colorScheme;
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved settings:', e);
  }

  let initialQueue: QueuedTimerItem[] = [];
  try {
    const rawQueue = localStorage.getItem('STAGE_TIMER_QUEUE');
    if (rawQueue) {
      const parsedQueue = JSON.parse(rawQueue);
      if (Array.isArray(parsedQueue)) {
        initialQueue = parsedQueue.map((item) => ({ ...item }));
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved queue:', e);
  }

  // Always return fresh idle timer at 00:00 (or device clock if configured in settings), with preserved cues
  return {
    ...DEFAULT_TIMER_STATE,
    ...initialSettings,
    status: 'idle',
    remainingSeconds: 0,
    totalSeconds: 0,
    initialDurationSeconds: 0,
    activeTimerTitle: '',
    finishedAt: null,
    targetEndTime: null,
    isBlackout: true, // Default to pure black on startup (VideoPsalm standard)
    lastAction: 'Ready (00:00)',
    timerQueue: initialQueue,
    activeQueueItemId: null,
    timingReport: [],
  };
}

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TimerState>(loadInitialState);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastUpNextTriggeredTargetRef = useRef<number | null>(null);
  const autoAdvancedFinishedAtRef = useRef<number | null>(null);

  // Network remote control state
  const isElectron = Boolean(window.electronAPI?.isElectron);
  const isRemoteClient =
    !isElectron &&
    typeof window !== 'undefined' &&
    (/Mobile|Android|iP(hone|od|ad)|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      new URLSearchParams(window.location.search).get('view') === 'remote' ||
      window.location.port === '3456');

  const wsRef = useRef<WebSocket | null>(null);
  const [connectedClientsCount, setConnectedClientsCount] = useState<number>(0);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const serverTimeOffsetRef = useRef<number>(0);

  const sendActionToHost = useCallback((action: { type: string; payload?: any; actionId?: string }) => {
    const actionWithId = {
      ...action,
      actionId: action.actionId || `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };

    // Primary transport: WebSocket for instant, authoritative delivery
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'ACTION', action: actionWithId }));
        return; // CRITICAL: Stop here! Do NOT double-send over HTTP!
      } catch (e) {
        console.warn('WS sendAction failed, falling back to HTTP:', e);
      }
    }

    // Secondary fallback transport: HTTP POST /api/action only if WebSocket is unavailable
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionWithId }),
    }).catch(() => {
      // ignore
    });
  }, []);

  const broadcastTick = useCallback(
    (remainingSeconds: number) => {
      if (isRemoteClient) return;
      const tickData = { type: 'TICK', remainingSeconds };
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(tickData));
        } catch {
          // ignore
        }
      }
      if (channelRef.current) {
        try {
          channelRef.current.postMessage(tickData);
        } catch {
          // ignore
        }
      }
      if (window.electronAPI?.sendTick) {
        try {
          window.electronAPI.sendTick(remainingSeconds);
        } catch {
          // ignore
        }
      }
    },
    [isRemoteClient]
  );

  const lastBroadcastTimeRef = useRef<number>(0);

  const broadcastState = useCallback(
    (newState: TimerState) => {
      if (isRemoteClient) return; // Remote clients do not broadcast state, only actions
      if (lastBroadcastTimeRef.current === newState.lastUpdated) return;
      lastBroadcastTimeRef.current = newState.lastUpdated;

      try {
        // Broadcast to other browser tabs, Electron displays, and mobile remote clients in real time
        if (channelRef.current) {
          channelRef.current.postMessage({ type: 'SYNC_STATE', payload: newState });
        }
        if (window.electronAPI?.sendState) {
          window.electronAPI.sendState(newState);
        }
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'SYNC_STATE', payload: newState }));
        }
        fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: newState }),
        }).catch(() => {});
      } catch (e) {
        console.warn('Broadcast failed:', e);
      }
    },
    [isRemoteClient]
  );

  const updateStateAndBroadcast = useCallback(
    (updater: (prev: TimerState) => TimerState) => {
      setState((prev) => {
        const updated = updater(prev);
        broadcastState(updated);
        return updated;
      });
    },
    [broadcastState]
  );

  // Load settings from settings.json via /api/settings or Electron API
  useEffect(() => {
    if (window.electronAPI?.getSettings) {
      window.electronAPI
        .getSettings()
        .then((saved) => {
          if (saved && typeof saved === 'object') {
            setState((prev) => ({
              ...prev,
              idleDisplayMode:
                saved.idleDisplayMode === 'clock' || saved.idleDisplayMode === 'zero'
                  ? saved.idleDisplayMode
                  : prev.idleDisplayMode,
              clockFormat24:
                typeof saved.clockFormat24 === 'boolean'
                  ? saved.clockFormat24
                  : prev.clockFormat24,
              autoAdvanceMode: saved.autoAdvanceMode || prev.autoAdvanceMode,
              upNextTriggerSeconds:
                typeof saved.upNextTriggerSeconds === 'number'
                  ? saved.upNextTriggerSeconds
                  : prev.upNextTriggerSeconds,
              colorScheme: saved.colorScheme || prev.colorScheme,
              timerQueue: Array.isArray(saved.timerQueue) ? saved.timerQueue : prev.timerQueue,
            }));
            try {
              localStorage.setItem('STAGE_TIMER_SETTINGS', JSON.stringify(saved));
              if (Array.isArray(saved.timerQueue)) {
                localStorage.setItem('STAGE_TIMER_QUEUE', JSON.stringify(saved.timerQueue));
              }
            } catch {}
          }
        })
        .catch(() => {});
    } else {
      fetch('/api/settings')
        .then((res) => (res.ok ? res.json() : null))
        .then((saved) => {
          if (saved && typeof saved === 'object') {
            setState((prev) => ({
              ...prev,
              idleDisplayMode:
                saved.idleDisplayMode === 'clock' || saved.idleDisplayMode === 'zero'
                  ? saved.idleDisplayMode
                  : prev.idleDisplayMode,
              clockFormat24:
                typeof saved.clockFormat24 === 'boolean'
                  ? saved.clockFormat24
                  : prev.clockFormat24,
              autoAdvanceMode: saved.autoAdvanceMode || prev.autoAdvanceMode,
              upNextTriggerSeconds:
                typeof saved.upNextTriggerSeconds === 'number'
                  ? saved.upNextTriggerSeconds
                  : prev.upNextTriggerSeconds,
              colorScheme: saved.colorScheme || prev.colorScheme,
              timerQueue: Array.isArray(saved.timerQueue) ? saved.timerQueue : prev.timerQueue,
            }));
            try {
              localStorage.setItem('STAGE_TIMER_SETTINGS', JSON.stringify(saved));
              if (Array.isArray(saved.timerQueue)) {
                localStorage.setItem('STAGE_TIMER_QUEUE', JSON.stringify(saved.timerQueue));
              }
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, []);

  // Initial Sync: Remote clients fetch host state immediately; Host publishes state immediately
  useEffect(() => {
    if (isRemoteClient) {
      fetch('/api/state')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.status || typeof data.totalSeconds === 'number')) {
            if (data.lastUpdated) {
              serverTimeOffsetRef.current = Date.now() - data.lastUpdated;
            }
            setState(data);
            lastBroadcastTimeRef.current = data.lastUpdated || 0;
          }
        })
        .catch(() => {});
    } else {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateRef.current }),
      }).catch(() => {});
    }
  }, [isRemoteClient]);

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = bc;

      bc.onmessage = (event) => {
        if (event.data?.type === 'SYNC_STATE' && event.data.payload) {
          const incoming: TimerState = event.data.payload;
          if (incoming.lastUpdated) {
            serverTimeOffsetRef.current = Date.now() - incoming.lastUpdated;
          }
          setState((prev) => {
            if (incoming.lastUpdated >= prev.lastUpdated) {
              return incoming;
            }
            return prev;
          });
        } else if (event.data?.type === 'TICK' && typeof event.data.remainingSeconds === 'number') {
          if (isRemoteClient) {
            setState((prev) => {
              if (prev.status === 'running' && prev.remainingSeconds !== event.data.remainingSeconds) {
                return { ...prev, remainingSeconds: event.data.remainingSeconds };
              }
              return prev;
            });
          }
        }
      };
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }

    let unsubElectron: (() => void) | undefined;
    if (window.electronAPI?.onStateUpdate) {
      unsubElectron = window.electronAPI.onStateUpdate((incoming: TimerState) => {
        if (incoming?.lastUpdated) {
          serverTimeOffsetRef.current = Date.now() - incoming.lastUpdated;
        }
        setState((prev) => {
          if (incoming && incoming.lastUpdated >= prev.lastUpdated) {
            return incoming;
          }
          return prev;
        });
      });
    }

    let unsubElectronTick: (() => void) | undefined;
    if (window.electronAPI?.onTick) {
      unsubElectronTick = window.electronAPI.onTick((remainingSeconds: number) => {
        if (isRemoteClient) {
          setState((prev) => {
            if (prev.status === 'running' && prev.remainingSeconds !== remainingSeconds) {
              return { ...prev, remainingSeconds };
            }
            return prev;
          });
        }
      });
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.lastUpdated) {
            serverTimeOffsetRef.current = Date.now() - parsed.lastUpdated;
          }
          setState(parsed);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      if (bc) bc.close();
      if (unsubElectron) unsubElectron();
      if (unsubElectronTick) unsubElectronTick();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isRemoteClient]);

  // Interval timer for drift-free countdown & automatic Up Next alerts
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const current = stateRef.current;
      if (current.status !== 'running' || !current.targetEndTime) {
        return;
      }

      if (isRemoteClient) {
        // REMOTE CLIENT (Phone):
        // 1. Estimate host time by subtracting synchronized clock skew
        const estimatedHostNow = Date.now() - serverTimeOffsetRef.current;
        const rawRemaining = Math.max(0, Math.ceil((current.targetEndTime - estimatedHostNow) / 1000));

        // 2. Hard clamp: remaining seconds cannot count up or exceed active duration
        const ceilingLimit =
          current.remainingSeconds > 0
            ? current.remainingSeconds
            : (current.totalSeconds > 0 ? current.totalSeconds : rawRemaining);
        const remaining = Math.min(ceilingLimit, rawRemaining);

        if (remaining !== current.remainingSeconds) {
          setState((prev) => ({
            ...prev,
            remainingSeconds: remaining,
          }));
        }
        return;
      }

      // HOST LOGIC (Master Engine):
      const now = Date.now();
      const rawRemaining = Math.max(0, Math.ceil((current.targetEndTime - now) / 1000));
      const ceilingLimit =
        current.remainingSeconds > 0
          ? current.remainingSeconds
          : (current.totalSeconds > 0 ? current.totalSeconds : rawRemaining);
      const remaining = Math.min(ceilingLimit, rawRemaining);

      const triggerSecs = current.upNextTriggerSeconds ?? 60;
      const shouldTriggerUpNext =
        triggerSecs > 0 &&
        remaining === triggerSecs &&
        lastUpNextTriggeredTargetRef.current !== current.targetEndTime;

      if (remaining === 0) {
        const finishTime = Date.now();
        updateStateAndBroadcast((prev) => {
          const timeUpEntry: TimingReportEntry = {
            id: `rpt-${finishTime}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: finishTime,
            timeFormatted: formatTimeOfDay(finishTime, prev.clockFormat24),
            eventType: 'TIME_UP',
            label: prev.activeTimerTitle || 'Live Timer',
            plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds || 0,
            notes: 'Countdown reached 00:00 (Time Up)',
          };
          return {
            ...prev,
            remainingSeconds: 0,
            status: 'finished',
            finishedAt: prev.finishedAt || finishTime,
            targetEndTime: null,
            upNextAlertUntil: prev.upNextAlertUntil,
            lastUpdated: finishTime,
            lastAction: 'Time Up!',
            timingReport: [timeUpEntry, ...(prev.timingReport || []).slice(0, 99)],
          };
        });
      } else if (shouldTriggerUpNext) {
        lastUpNextTriggeredTargetRef.current = current.targetEndTime;
        const queue = current.timerQueue || [];
        const activeIdx = queue.findIndex((q) => q.id === current.activeQueueItemId);
        const nextItem =
          activeIdx >= 0 && activeIdx < queue.length - 1
            ? queue[activeIdx + 1]
            : (activeIdx === -1 && queue.length > 0 ? queue[0] : null);

        if (nextItem && hasValidTimerLabel(nextItem.title)) {
          updateStateAndBroadcast((prev) => ({
            ...prev,
            remainingSeconds: remaining,
            upNextAlertUntil: now + 5000,
            upNextAlertTitle: nextItem.title.trim(),
            lastUpdated: now,
            lastAction: `Up Next Alert: ${nextItem.title}`,
          }));
        } else if (remaining !== current.remainingSeconds) {
          setState((prev) => ({
            ...prev,
            remainingSeconds: remaining,
          }));
          broadcastTick(remaining);
        }
      } else if (remaining !== current.remainingSeconds) {
        setState((prev) => ({
          ...prev,
          remainingSeconds: remaining,
        }));
        broadcastTick(remaining);
      }
    }, 200);

    return () => clearInterval(timerInterval);
  }, [isRemoteClient, updateStateAndBroadcast, broadcastTick]);

  // Queue time supporting Hours, Minutes, Seconds (staged builder time, DOES NOT overwrite running timer)
  const queueTime = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'QUEUE_TIME', payload: { hours, minutes, seconds } });
      return;
    }
    const clampedHrs = Math.max(0, Math.min(99, hours));
    const clampedMins = Math.max(0, Math.min(59, minutes));
    const clampedSecs = Math.max(0, Math.min(59, seconds));
    updateStateAndBroadcast((prev) => ({
      ...prev,
      queuedHours: clampedHrs,
      queuedMinutes: clampedMins,
      queuedSeconds: clampedSecs,
      lastUpdated: Date.now(),
      lastAction: `Builder set to ${clampedHrs > 0 ? String(clampedHrs).padStart(2, '0') + ':' : ''}${String(clampedMins).padStart(2, '0')}:${String(clampedSecs).padStart(2, '0')}`,
    }));
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  // Push the currently queued time directly to the live projection and run/jump
  const pushQueueToLive = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'START_LIVE' });
      return;
    }
    const current = stateRef.current;
    // CRITICAL RESET/START FIX: If the timer is staged/reset with remaining seconds > 0, start from that staged duration!
    let validTotal = 0;
    if (current.status === 'idle' && current.remainingSeconds > 0) {
      validTotal = current.remainingSeconds;
    } else {
      const total = (current.queuedHours || 0) * 3600 + (current.queuedMinutes || 0) * 60 + (current.queuedSeconds || 0);
      validTotal = total > 0 ? total : (current.initialDurationSeconds > 0 ? current.initialDurationSeconds : (current.totalSeconds > 0 ? current.totalSeconds : 600));
    }

    const now = Date.now();
    lastUpNextTriggeredTargetRef.current = null;

    updateStateAndBroadcast((prev) => {
      const sessionTitle = prev.activeTimerTitle || (prev.activeQueueItemId ? (prev.timerQueue?.find(q => q.id === prev.activeQueueItemId)?.title || '') : '');
      const reportEntry: TimingReportEntry = {
        id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
        eventType: 'START',
        label: sessionTitle || 'Live Timer',
        plannedDurationSeconds: validTotal,
        notes: `Started timer countdown: ${formatTime(validTotal).text}`,
      };
      return {
        ...prev,
        totalSeconds: validTotal,
        remainingSeconds: validTotal,
        initialDurationSeconds: validTotal,
        status: 'running',
        targetEndTime: now + validTotal * 1000,
        finishedAt: null,
        isBlackout: false,
        upNextAlertUntil: null,
        lastUpdated: now,
        lastAction: `Started ${formatTime(validTotal).text}`,
        timingReport: [reportEntry, ...(prev.timingReport || []).slice(0, 99)],
      };
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  // Load the queued time onto the stage display in idle / ready mode (waiting for speaker to speak)
  const loadQueueToStage = useCallback((hours?: number, minutes?: number, seconds?: number) => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'LOAD_READY', payload: { hours, minutes, seconds } });
      return;
    }
    const current = stateRef.current;
    const h = hours !== undefined ? hours : (current.queuedHours || 0);
    const m = minutes !== undefined ? minutes : (current.queuedMinutes || 0);
    const s = seconds !== undefined ? seconds : (current.queuedSeconds || 0);
    const total = h * 3600 + m * 60 + s;
    const validTotal = total > 0 ? total : 600;
    const now = Date.now();
    lastUpNextTriggeredTargetRef.current = null;

    updateStateAndBroadcast((prev) => ({
      ...prev,
      queuedHours: h,
      queuedMinutes: m,
      queuedSeconds: s,
      totalSeconds: validTotal,
      remainingSeconds: validTotal,
      initialDurationSeconds: validTotal,
      status: 'idle',
      targetEndTime: null,
      finishedAt: null,
      isBlackout: false,
      upNextAlertUntil: null,
      lastUpdated: now,
      lastAction: `Loaded ${formatTime(validTotal).text} to Stage (Ready)`,
    }));
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const toggleBlackout = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'TOGGLE_BLACKOUT' });
      return;
    }
    updateStateAndBroadcast((prev) => ({
      ...prev,
      isBlackout: !prev.isBlackout,
      lastUpdated: Date.now(),
      lastAction: !prev.isBlackout ? 'Stage Screen Blackout' : 'Stage Screen Active',
    }));
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const startWithQueued = useCallback(() => {
    pushQueueToLive();
  }, [pushQueueToLive]);

  const pause = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'PAUSE' });
      return;
    }
    const current = stateRef.current;
    if (current.status !== 'running' || !current.targetEndTime) return;

    const rawRemaining = Math.max(0, Math.ceil((current.targetEndTime - Date.now()) / 1000));
    const remaining = Math.min(current.remainingSeconds, rawRemaining);
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      const entry: TimingReportEntry = {
        id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
        eventType: 'PAUSE',
        label: prev.activeTimerTitle || 'Live Timer',
        plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds || 0,
        notes: `Paused with ${formatTime(remaining).text} remaining`,
      };
      return {
        ...prev,
        remainingSeconds: remaining,
        status: 'paused',
        targetEndTime: null,
        finishedAt: null,
        lastUpdated: now,
        lastAction: 'Paused',
        timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
      };
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const resume = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'RESUME' });
      return;
    }
    const current = stateRef.current;
    if (current.status !== 'paused' && current.status !== 'idle') return;

    const remaining =
      current.remainingSeconds > 0
        ? current.remainingSeconds
        : (current.initialDurationSeconds || current.totalSeconds || 600);
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      const entry: TimingReportEntry = {
        id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
        eventType: 'RESUME',
        label: prev.activeTimerTitle || 'Live Timer',
        plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds || remaining,
        notes: `Resumed countdown: ${formatTime(remaining).text} remaining`,
      };
      return {
        ...prev,
        remainingSeconds: remaining,
        totalSeconds: prev.totalSeconds || remaining,
        initialDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds || remaining,
        status: 'running',
        targetEndTime: now + remaining * 1000,
        finishedAt: null,
        isBlackout: false,
        lastUpdated: now,
        lastAction: 'Running',
        timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
      };
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

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
    if (isRemoteClient) {
      sendActionToHost({ type: 'STOP' });
      return;
    }
    lastUpNextTriggeredTargetRef.current = null;
    const now = Date.now();
    updateStateAndBroadcast((prev) => {
      const entry: TimingReportEntry = {
        id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
        eventType: 'STOP',
        label: prev.activeTimerTitle || 'Live Timer',
        plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds || 0,
        notes: 'Stopped timer',
      };
      return {
        ...prev,
        remainingSeconds: 0,
        status: 'idle',
        targetEndTime: null,
        finishedAt: null,
        upNextAlertUntil: null,
        lastUpdated: now,
        lastAction: 'Stopped',
        timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
      };
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  // CRITICAL FIX: Reset properly resets to active timer's original duration, NOT builder queue inputs!
  const reset = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'RESET' });
      return;
    }
    lastUpNextTriggeredTargetRef.current = null;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      let resetTime = 0;
      if (prev.activeQueueItemId) {
        const item = (prev.timerQueue || []).find((q) => q.id === prev.activeQueueItemId);
        if (item) {
          resetTime = item.totalSeconds;
        }
      }
      if (resetTime === 0) {
        resetTime =
          prev.initialDurationSeconds > 0
            ? prev.initialDurationSeconds
            : (prev.totalSeconds > 0 ? prev.totalSeconds : 0);
      }

      const entry: TimingReportEntry = {
        id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
        eventType: 'RESET',
        label: prev.activeTimerTitle || 'Live Timer',
        plannedDurationSeconds: resetTime,
        notes: `Reset timer to original duration: ${formatTime(resetTime).text}`,
      };

      return {
        ...prev,
        remainingSeconds: resetTime,
        totalSeconds: resetTime,
        initialDurationSeconds: resetTime,
        status: 'idle',
        targetEndTime: null,
        finishedAt: null,
        isBlackout: false,
        upNextAlertUntil: null,
        lastUpdated: now,
        lastAction: `Reset to ${formatTime(resetTime).text}`,
        timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
      };
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const setIdle = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'SET_IDLE' });
      return;
    }
    lastUpNextTriggeredTargetRef.current = null;
    const now = Date.now();
    updateStateAndBroadcast((prev) => {
      const entry: TimingReportEntry = {
        id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
        eventType: 'IDLE',
        label: prev.activeTimerTitle || 'Live Stage',
        plannedDurationSeconds: 0,
        notes: `Returned stage to Idle mode (${prev.idleDisplayMode === 'clock' ? 'Device Clock' : '00:00'})`,
      };
      return {
        ...prev,
        remainingSeconds: 0,
        totalSeconds: 0,
        initialDurationSeconds: 0,
        activeTimerTitle: '',
        activeQueueItemId: null,
        status: 'idle',
        targetEndTime: null,
        finishedAt: null,
        upNextAlertUntil: null,
        upNextAlertTitle: null,
        lastUpdated: now,
        lastAction: 'Set to Idle',
        timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
      };
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const addTimeToLive = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'ADD_TIME', payload: { hours, minutes, seconds } });
      return;
    }
    const delta = hours * 3600 + minutes * 60 + seconds;
    if (delta <= 0) return;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      const addedText = `+${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
      if (prev.status === 'finished') {
        const entry: TimingReportEntry = {
          id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
          eventType: 'ADD_TIME',
          label: prev.activeTimerTitle || 'Live Timer',
          plannedDurationSeconds: prev.initialDurationSeconds || delta,
          notes: `Added ${addedText} while finished (New duration: ${formatTime(delta).text})`,
        };
        return {
          ...prev,
          remainingSeconds: delta,
          totalSeconds: Math.max(prev.totalSeconds, delta),
          targetEndTime: now + delta * 1000,
          status: 'running',
          finishedAt: null,
          isBlackout: false,
          lastUpdated: now,
          lastAction: `Added ${addedText}`,
          timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
        };
      }
      let newRemaining = prev.remainingSeconds + delta;
      if (prev.status === 'running' && prev.targetEndTime) {
        const newTarget = prev.targetEndTime + delta * 1000;
        newRemaining = Math.min(prev.remainingSeconds + delta, Math.max(0, Math.ceil((newTarget - now) / 1000)));
        const entry: TimingReportEntry = {
          id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
          eventType: 'ADD_TIME',
          label: prev.activeTimerTitle || 'Live Timer',
          plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds,
          notes: `Added ${addedText} (Remaining: ${formatTime(newRemaining).text})`,
        };
        return {
          ...prev,
          remainingSeconds: newRemaining,
          targetEndTime: newTarget,
          status: 'running',
          finishedAt: null,
          isBlackout: false,
          lastUpdated: now,
          lastAction: `Added ${addedText}`,
          timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
        };
      } else {
        const entry: TimingReportEntry = {
          id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
          eventType: 'ADD_TIME',
          label: prev.activeTimerTitle || 'Live Timer',
          plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds,
          notes: `Added ${addedText} (Remaining: ${formatTime(newRemaining).text})`,
        };
        return {
          ...prev,
          remainingSeconds: newRemaining,
          totalSeconds: Math.max(prev.totalSeconds, newRemaining),
          finishedAt: null,
          isBlackout: false,
          lastUpdated: now,
          lastAction: `Added ${addedText}`,
          timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
        };
      }
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const subtractTimeFromLive = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'SUBTRACT_TIME', payload: { hours, minutes, seconds } });
      return;
    }
    const delta = hours * 3600 + minutes * 60 + seconds;
    if (delta <= 0) return;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      const subbedText = `-${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
      let newRemaining = Math.max(0, prev.remainingSeconds - delta);
      if (prev.status === 'running' && prev.targetEndTime) {
        const newTarget = Math.max(now, prev.targetEndTime - delta * 1000);
        newRemaining = Math.min(Math.max(0, prev.remainingSeconds - delta), Math.max(0, Math.ceil((newTarget - now) / 1000)));
        const isFinished = newRemaining === 0;
        const entry: TimingReportEntry = {
          id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
          eventType: 'SUBTRACT_TIME',
          label: prev.activeTimerTitle || 'Live Timer',
          plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds,
          notes: `Subtracted ${subbedText} (Remaining: ${formatTime(newRemaining).text})`,
        };
        return {
          ...prev,
          remainingSeconds: newRemaining,
          targetEndTime: isFinished ? null : newTarget,
          status: isFinished ? 'finished' : 'running',
          finishedAt: isFinished ? (prev.finishedAt || now) : null,
          lastUpdated: now,
          lastAction: `Subtracted ${subbedText}`,
          timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
        };
      } else {
        const isFinished = newRemaining === 0 && prev.status !== 'idle';
        const entry: TimingReportEntry = {
          id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
          eventType: 'SUBTRACT_TIME',
          label: prev.activeTimerTitle || 'Live Timer',
          plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds,
          notes: `Subtracted ${subbedText} (Remaining: ${formatTime(newRemaining).text})`,
        };
        return {
          ...prev,
          remainingSeconds: newRemaining,
          status: isFinished ? 'finished' : prev.status,
          finishedAt: isFinished ? (prev.finishedAt || now) : null,
          lastUpdated: now,
          lastAction: `Subtracted ${subbedText}`,
          timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
        };
      }
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const adjustRemainingTime = useCallback((deltaSeconds: number) => {
    if (deltaSeconds >= 0) {
      addTimeToLive(0, 0, deltaSeconds);
    } else {
      subtractTimeFromLive(0, 0, Math.abs(deltaSeconds));
    }
  }, [addTimeToLive, subtractTimeFromLive]);

  const setLiveDuration = useCallback((hours: number, minutes: number, seconds: number = 0) => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'SET_DURATION', payload: { hours, minutes, seconds } });
      return;
    }
    const newTotal = hours * 3600 + minutes * 60 + seconds;
    const now = Date.now();

    updateStateAndBroadcast((prev) => {
      const isRunning = prev.status === 'running';
      return {
        ...prev,
        totalSeconds: newTotal,
        remainingSeconds: newTotal,
        initialDurationSeconds: newTotal,
        targetEndTime: isRunning ? now + newTotal * 1000 : null,
        status: isRunning ? 'running' : prev.status,
        finishedAt: null,
        isBlackout: false,
        lastUpdated: now,
        lastAction: `Set to ${formatTime(newTotal).text}`,
      };
    });
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const setColorScheme = useCallback((colorScheme: StageColor) => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'SET_COLOR_SCHEME', payload: { color: colorScheme } });
      return;
    }
    persistSettings({ colorScheme });
    updateStateAndBroadcast((prev) => ({
      ...prev,
      colorScheme,
      lastUpdated: Date.now(),
    }));
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  // UNLIMITED Multi-timer queue management
  const addToQueue = useCallback(
    (hours: number, minutes: number, seconds: number = 0, title?: string) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'ADD_TO_QUEUE', payload: { hours, minutes, seconds, title } });
        return true;
      }
      const clampedHrs = Math.max(0, Math.min(99, hours));
      const clampedMins = Math.max(0, Math.min(59, minutes));
      const clampedSecs = Math.max(0, Math.min(59, seconds));
      const total = clampedHrs * 3600 + clampedMins * 60 + clampedSecs;
      if (total <= 0) return false;

      const newId = `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const itemTitle = title?.trim() || '';

      const newItem: QueuedTimerItem = {
        id: newId,
        title: itemTitle,
        hours: clampedHrs,
        minutes: clampedMins,
        seconds: clampedSecs,
        totalSeconds: total,
      };

      updateStateAndBroadcast((prev) => {
        const updatedQueue = [...(prev.timerQueue || []), newItem];
        persistQueue(updatedQueue);
        return {
          ...prev,
          timerQueue: updatedQueue,
          lastUpdated: Date.now(),
          lastAction: itemTitle
            ? `Added "${itemTitle}" to Queue`
            : `Added ${formatTime(total).text} to Queue`,
        };
      });
      return true;
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const removeFromQueue = useCallback(
    (id: string) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'REMOVE_FROM_QUEUE', payload: { id } });
        return;
      }
      updateStateAndBroadcast((prev) => {
        const filtered = (prev.timerQueue || []).filter((item) => item.id !== id);
        persistQueue(filtered);
        return {
          ...prev,
          timerQueue: filtered,
          activeQueueItemId: prev.activeQueueItemId === id ? null : prev.activeQueueItemId,
          lastUpdated: Date.now(),
          lastAction: 'Removed timer from Queue',
        };
      });
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'REORDER_QUEUE', payload: { fromIndex, toIndex } });
        return;
      }
      updateStateAndBroadcast((prev) => {
        const queue = [...(prev.timerQueue || [])];
        if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) {
          return prev;
        }
        const [moved] = queue.splice(fromIndex, 1);
        queue.splice(toIndex, 0, moved);
        persistQueue(queue);
        return {
          ...prev,
          timerQueue: queue,
          lastUpdated: Date.now(),
        };
      });
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const updateQueueItemTitle = useCallback(
    (id: string, title: string) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'UPDATE_QUEUE_TITLE', payload: { id, title } });
        return;
      }
      updateStateAndBroadcast((prev) => {
        const updatedQueue = (prev.timerQueue || []).map((item) =>
          item.id === id ? { ...item, title: title.trim() || item.title } : item
        );
        persistQueue(updatedQueue);
        return {
          ...prev,
          timerQueue: updatedQueue,
          lastUpdated: Date.now(),
        };
      });
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const clearQueue = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'CLEAR_QUEUE' });
      return;
    }
    persistQueue([]);
    updateStateAndBroadcast((prev) => ({
      ...prev,
      timerQueue: [],
      activeQueueItemId: null,
      lastUpdated: Date.now(),
      lastAction: 'Cleared Queue',
    }));
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const playQueueItem = useCallback(
    (id: string) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'PLAY_QUEUE_ITEM', payload: { id } });
        return;
      }
      const current = stateRef.current;
      const item = (current.timerQueue || []).find((q) => q.id === id);
      if (!item) return;

      lastUpNextTriggeredTargetRef.current = null;
      const now = Date.now();
      updateStateAndBroadcast((prev) => {
        const reportEntry: TimingReportEntry = {
          id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
          eventType: 'START',
          label: item.title || `Queue Item #${(prev.timerQueue || []).findIndex(q => q.id === id) + 1}`,
          plannedDurationSeconds: item.totalSeconds,
          notes: `Started from queue: ${item.title || formatTime(item.totalSeconds).text}`,
        };
        return {
          ...prev,
          activeQueueItemId: id,
          activeTimerTitle: item.title || '',
          totalSeconds: item.totalSeconds,
          remainingSeconds: item.totalSeconds,
          initialDurationSeconds: item.totalSeconds,
          status: 'running',
          targetEndTime: now + item.totalSeconds * 1000,
          finishedAt: null,
          isBlackout: false,
          upNextAlertUntil: null,
          lastUpdated: now,
          lastAction: `Started ${item.title || formatTime(item.totalSeconds).text}`,
          timingReport: [reportEntry, ...(prev.timingReport || []).slice(0, 99)],
        };
      });
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const loadQueueItemToStage = useCallback(
    (id: string) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'LOAD_QUEUE_ITEM', payload: { id } });
        return;
      }
      const current = stateRef.current;
      const item = (current.timerQueue || []).find((q) => q.id === id);
      if (!item) return;

      lastUpNextTriggeredTargetRef.current = null;
      const now = Date.now();
      updateStateAndBroadcast((prev) => ({
        ...prev,
        activeQueueItemId: id,
        activeTimerTitle: item.title || '',
        totalSeconds: item.totalSeconds,
        remainingSeconds: item.totalSeconds,
        initialDurationSeconds: item.totalSeconds,
        status: 'idle',
        targetEndTime: null,
        finishedAt: null,
        isBlackout: false,
        upNextAlertUntil: null,
        lastUpdated: now,
        lastAction: `Loaded ${item.title || formatTime(item.totalSeconds).text} to Stage (Ready)`,
      }));
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const playNextInQueue = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'PLAY_NEXT' });
      return;
    }
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
  }, [isRemoteClient, sendActionToHost, playQueueItem]);

  const loadNextInQueueToStage = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'LOAD_NEXT' });
      return;
    }
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
  }, [isRemoteClient, sendActionToHost, loadQueueItemToStage]);

  // Queue Transition Behavior Setting (auto-start, auto-load, manual)
  const setAutoAdvanceMode = useCallback(
    (mode: AutoAdvanceMode) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'SET_AUTO_ADVANCE_MODE', payload: { mode } });
        return;
      }
      persistSettings({ autoAdvanceMode: mode });
      updateStateAndBroadcast((prev) => ({
        ...prev,
        autoAdvanceMode: mode,
        lastUpdated: Date.now(),
        lastAction: `Transition Mode: ${
          mode === 'auto-start'
            ? 'Auto Start Next'
            : mode === 'auto-load' || mode === 'auto-ready'
            ? 'Auto Load Next'
            : 'Manual'
        }`,
      }));
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  // Default Idle Display Setting (00:00 vs live Device Clock)
  const setIdleDisplayMode = useCallback(
    (mode: IdleDisplayMode) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'SET_IDLE_DISPLAY_MODE', payload: { mode } });
        return;
      }
      persistSettings({ idleDisplayMode: mode });
      updateStateAndBroadcast((prev) => ({
        ...prev,
        idleDisplayMode: mode,
        lastUpdated: Date.now(),
        lastAction: `Idle display: ${mode === 'clock' ? 'Device Clock' : '00:00'}`,
      }));
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  // 12-hour or 24-hour clock format
  const setClockFormat24 = useCallback(
    (clockFormat24: boolean) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'SET_CLOCK_FORMAT_24', payload: { clockFormat24 } });
        return;
      }
      persistSettings({ clockFormat24 });
      updateStateAndBroadcast((prev) => ({
        ...prev,
        clockFormat24,
        lastUpdated: Date.now(),
        lastAction: `Clock format: ${clockFormat24 ? '24-hour' : '12-hour'}`,
      }));
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  // Clear Event Timing Report
  const clearTimingReport = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'CLEAR_TIMING_REPORT' });
      return;
    }
    updateStateAndBroadcast((prev) => ({
      ...prev,
      timingReport: [],
      lastUpdated: Date.now(),
      lastAction: 'Cleared Timing Report',
    }));
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  // Log custom Timing Event
  const logTimingEvent = useCallback(
    (type: TimingReportEventType, notes?: string, customLabel?: string) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'LOG_TIMING_EVENT', payload: { type, notes, customLabel } });
        return;
      }
      const now = Date.now();
      updateStateAndBroadcast((prev) => {
        const entry: TimingReportEntry = {
          id: `rpt-${now}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTimeOfDay(now, prev.clockFormat24),
          eventType: type,
          label: customLabel || prev.activeTimerTitle || 'Live Timer',
          plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds || 0,
          notes,
        };
        return {
          ...prev,
          timingReport: [entry, ...(prev.timingReport || []).slice(0, 99)],
          lastUpdated: now,
        };
      });
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  // Auto Transition Effect when timer finishes (shows TIME UP 5s + PLEASE CONCLUDE NOW 5s = 10s total, then auto starts or loads next if queue has items)
  useEffect(() => {
    if (isRemoteClient) return;
    if (state.status !== 'finished' || !state.finishedAt) {
      autoAdvancedFinishedAtRef.current = null;
      return;
    }

    const mode = state.autoAdvanceMode;
    if (mode !== 'auto-start' && mode !== 'auto-load' && mode !== 'auto-ready') {
      return;
    }

    const queue = state.timerQueue || [];
    if (queue.length === 0) return;

    const interval = setInterval(() => {
      const current = stateRef.current;
      if (current.status !== 'finished' || !current.finishedAt) return;
      if (autoAdvancedFinishedAtRef.current === current.finishedAt) return;

      const elapsed = Math.floor((Date.now() - current.finishedAt) / 1000);
      // Wait exactly 10s (5s TIME UP + 5s CONCLUDE NOW) before auto transitioning, with NO overtime count up
      if (elapsed >= 10) {
        const currentQueue = current.timerQueue || [];
        const activeIdx = currentQueue.findIndex((q) => q.id === current.activeQueueItemId);
        let nextItem: QueuedTimerItem | null = null;
        if (activeIdx >= 0 && activeIdx < currentQueue.length - 1) {
          nextItem = currentQueue[activeIdx + 1];
        } else if (activeIdx === -1 && currentQueue.length > 0) {
          nextItem = currentQueue[0];
        }

        if (nextItem) {
          autoAdvancedFinishedAtRef.current = current.finishedAt;
          const concludeTime = Date.now();
          // Log Concluded in Timing Report
          updateStateAndBroadcast((prev) => {
            const concludedEntry: TimingReportEntry = {
              id: `rpt-${concludeTime}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: concludeTime,
              timeFormatted: formatTimeOfDay(concludeTime, prev.clockFormat24),
              eventType: 'CONCLUDED',
              label: prev.activeTimerTitle || 'Live Timer',
              plannedDurationSeconds: prev.initialDurationSeconds || prev.totalSeconds || 0,
              actualDurationSeconds: (prev.initialDurationSeconds || prev.totalSeconds || 0) + 10,
              notes: `Concluded segment (Auto-advanced to "${nextItem?.title || formatTime(nextItem?.totalSeconds || 0).text}")`,
            };
            return {
              ...prev,
              timingReport: [concludedEntry, ...(prev.timingReport || []).slice(0, 99)],
            };
          });

          if (mode === 'auto-start') {
            playQueueItem(nextItem.id);
          } else {
            loadQueueItemToStage(nextItem.id);
          }
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [
    state.status,
    state.finishedAt,
    state.autoAdvanceMode,
    state.timerQueue,
    isRemoteClient,
    playQueueItem,
    loadQueueItemToStage,
    updateStateAndBroadcast,
  ]);

  const triggerUpNextAlert = useCallback(
    (customTitle?: string, durationSeconds: number = 5) => {
      if (isRemoteClient) {
        sendActionToHost({
          type: 'TRIGGER_UP_NEXT',
          payload: { title: customTitle, durationSeconds },
        });
        return;
      }
      const current = stateRef.current;
      let candidate = customTitle?.trim();
      if (!candidate) {
        const queue = current.timerQueue || [];
        const activeIdx = queue.findIndex((q) => q.id === current.activeQueueItemId);
        let nextItem: QueuedTimerItem | null = null;
        if (activeIdx >= 0 && activeIdx < queue.length - 1) {
          nextItem = queue[activeIdx + 1];
        } else if (queue.length > 0) {
          nextItem = queue[0];
        }
        candidate = nextItem?.title;
      }

      // STRICT RULE: If the timer does NOT have a valid, user-assigned label, DO NOT trigger any alert
      if (!hasValidTimerLabel(candidate)) {
        return;
      }

      const validTitle = candidate!.trim();
      const now = Date.now();
      updateStateAndBroadcast((prev) => ({
        ...prev,
        upNextAlertUntil: now + durationSeconds * 1000,
        upNextAlertTitle: validTitle,
        lastUpdated: now,
        lastAction: `Cued Up Next: "${validTitle}" (${durationSeconds}s)`,
      }));
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const dismissUpNextAlert = useCallback(() => {
    if (isRemoteClient) {
      sendActionToHost({ type: 'DISMISS_UP_NEXT' });
      return;
    }
    updateStateAndBroadcast((prev) => ({
      ...prev,
      upNextAlertUntil: null,
      lastUpdated: Date.now(),
      lastAction: 'Dismissed Up Next Alert',
    }));
  }, [isRemoteClient, sendActionToHost, updateStateAndBroadcast]);

  const setUpNextTriggerSeconds = useCallback(
    (seconds: number) => {
      if (isRemoteClient) {
        sendActionToHost({ type: 'SET_UP_NEXT_SECONDS', payload: { seconds } });
        return;
      }
      persistSettings({ upNextTriggerSeconds: seconds });
      updateStateAndBroadcast((prev) => ({
        ...prev,
        upNextTriggerSeconds: seconds,
        lastUpdated: Date.now(),
        lastAction: `Up Next Alert at ${seconds > 0 ? formatTime(seconds).text : 'Disabled'}`,
      }));
    },
    [isRemoteClient, sendActionToHost, updateStateAndBroadcast]
  );

  const processedActionIdsRef = useRef<Map<string, number>>(new Map());

  const executeAction = useCallback(
    (action: { type: string; payload?: any; actionId?: string }) => {
      if (!action || !action.type) return;

      // Idempotency: Ignore duplicate actions with the same actionId within 10 seconds
      if (action.actionId) {
        const now = Date.now();
        for (const [id, timestamp] of processedActionIdsRef.current.entries()) {
          if (now - timestamp > 10000) {
            processedActionIdsRef.current.delete(id);
          }
        }
        if (processedActionIdsRef.current.has(action.actionId)) {
          return;
        }
        processedActionIdsRef.current.set(action.actionId, now);
      }

      switch (action.type) {
        case 'START':
        case 'RESUME':
          resume();
          break;
        case 'PAUSE':
          pause();
          break;
        case 'STOP':
          stop();
          break;
        case 'RESET':
          reset();
          break;
        case 'SET_IDLE':
          setIdle();
          break;
        case 'TOGGLE_BLACKOUT':
          toggleBlackout();
          break;
        case 'SET_DURATION':
          if (action.payload) {
            setLiveDuration(
              action.payload.hours || 0,
              action.payload.minutes || 0,
              action.payload.seconds || 0
            );
          }
          break;
        case 'ADD_TIME':
          if (action.payload) {
            addTimeToLive(
              action.payload.hours || 0,
              action.payload.minutes || 0,
              action.payload.seconds || 0
            );
          }
          break;
        case 'SUBTRACT_TIME':
          if (action.payload) {
            subtractTimeFromLive(
              action.payload.hours || 0,
              action.payload.minutes || 0,
              action.payload.seconds || 0
            );
          }
          break;
        case 'LOAD_READY':
          if (action.payload) {
            loadQueueToStage(
              action.payload.hours,
              action.payload.minutes,
              action.payload.seconds
            );
          } else {
            loadQueueToStage();
          }
          break;
        case 'START_LIVE':
          pushQueueToLive();
          break;
        case 'QUEUE_TIME':
          if (action.payload) {
            queueTime(
              action.payload.hours || 0,
              action.payload.minutes || 0,
              action.payload.seconds || 0
            );
          }
          break;
        case 'ADD_TO_QUEUE':
          if (action.payload) {
            addToQueue(
              action.payload.hours || 0,
              action.payload.minutes || 0,
              action.payload.seconds || 0,
              action.payload.title
            );
          }
          break;
        case 'REMOVE_FROM_QUEUE':
          if (action.payload?.id) {
            removeFromQueue(action.payload.id);
          }
          break;
        case 'REORDER_QUEUE':
          if (
            action.payload &&
            typeof action.payload.fromIndex === 'number' &&
            typeof action.payload.toIndex === 'number'
          ) {
            reorderQueue(action.payload.fromIndex, action.payload.toIndex);
          }
          break;
        case 'UPDATE_QUEUE_TITLE':
          if (action.payload?.id && action.payload?.title !== undefined) {
            updateQueueItemTitle(action.payload.id, action.payload.title);
          }
          break;
        case 'CLEAR_QUEUE':
          clearQueue();
          break;
        case 'PLAY_QUEUE_ITEM':
          if (action.payload?.id) {
            playQueueItem(action.payload.id);
          }
          break;
        case 'LOAD_QUEUE_ITEM':
          if (action.payload?.id) {
            loadQueueItemToStage(action.payload.id);
          }
          break;
        case 'PLAY_NEXT':
          playNextInQueue();
          break;
        case 'LOAD_NEXT':
          loadNextInQueueToStage();
          break;
        case 'SET_COLOR_SCHEME':
          if (action.payload?.color) {
            setColorScheme(action.payload.color);
          }
          break;
        case 'SET_AUTO_ADVANCE_MODE':
          if (action.payload?.mode) {
            setAutoAdvanceMode(action.payload.mode);
          }
          break;
        case 'SET_IDLE_DISPLAY_MODE':
          if (action.payload?.mode) {
            setIdleDisplayMode(action.payload.mode);
          }
          break;
        case 'SET_CLOCK_FORMAT_24':
          if (typeof action.payload?.clockFormat24 === 'boolean') {
            setClockFormat24(action.payload.clockFormat24);
          }
          break;
        case 'CLEAR_TIMING_REPORT':
          clearTimingReport();
          break;
        case 'LOG_TIMING_EVENT':
          if (action.payload?.type) {
            logTimingEvent(action.payload.type, action.payload.notes, action.payload.customLabel);
          }
          break;
        case 'TRIGGER_UP_NEXT':
          triggerUpNextAlert(action.payload?.title, action.payload?.durationSeconds || 5);
          break;
        case 'DISMISS_UP_NEXT':
          dismissUpNextAlert();
          break;
        case 'SET_UP_NEXT_SECONDS':
          if (typeof action.payload?.seconds === 'number') {
            setUpNextTriggerSeconds(action.payload.seconds);
          }
          break;
      }
    },
    [
      resume,
      pause,
      stop,
      reset,
      toggleBlackout,
      setLiveDuration,
      addTimeToLive,
      subtractTimeFromLive,
      loadQueueToStage,
      pushQueueToLive,
      queueTime,
      addToQueue,
      removeFromQueue,
      reorderQueue,
      updateQueueItemTitle,
      clearQueue,
      playQueueItem,
      loadQueueItemToStage,
      playNextInQueue,
      loadNextInQueueToStage,
      setColorScheme,
      setAutoAdvanceMode,
      setIdleDisplayMode,
      setClockFormat24,
      clearTimingReport,
      logTimingEvent,
      triggerUpNextAlert,
      dismissUpNextAlert,
      setUpNextTriggerSeconds,
    ]
  );

  const dispatchAction = useCallback(
    (action: { type: string; payload?: any }) => {
      if (isElectron) {
        executeAction(action);
      } else {
        sendActionToHost(action);
        executeAction(action);
      }
    },
    [isElectron, executeAction, sendActionToHost]
  );

  const executeActionRef = useRef(executeAction);
  executeActionRef.current = executeAction;

  // Electron Host listeners for remote action from phone & clients count
  useEffect(() => {
    if (window.electronAPI?.onRemoteAction) {
      const unsub = window.electronAPI.onRemoteAction((action) => {
        executeActionRef.current(action);
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onRemoteClientsChange) {
      const unsub = window.electronAPI.onRemoteClientsChange((count) => {
        setConnectedClientsCount(count);
      });
      return unsub;
    }
  }, []);

  // WebSocket Connection for Real-Time Network Remote Sync (Mounted once)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let unmounted = false;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        if (!host) return;

        ws = new WebSocket(`${protocol}//${host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsWsConnected(true);
          try {
            if (isRemoteClient) {
              ws?.send(JSON.stringify({ type: 'REQUEST_STATE' }));
            } else {
              ws?.send(JSON.stringify({ type: 'SYNC_STATE', payload: stateRef.current }));
            }
          } catch {
            // ignore
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYNC_STATE' && data.payload) {
              const incoming: TimerState = data.payload;
              if (incoming.lastUpdated) {
                serverTimeOffsetRef.current = Date.now() - incoming.lastUpdated;
              }
              setState((prev) => {
                if (isRemoteClient) {
                  // Remote clients always strictly follow the host
                  return incoming;
                }
                if (incoming.lastUpdated >= prev.lastUpdated) {
                  lastBroadcastTimeRef.current = incoming.lastUpdated;
                  return incoming;
                }
                return prev;
              });
            } else if (data.type === 'TICK' && typeof data.remainingSeconds === 'number') {
              if (isRemoteClient) {
                setState((prev) => {
                  if (prev.status === 'running' && prev.remainingSeconds !== data.remainingSeconds) {
                    return {
                      ...prev,
                      remainingSeconds: data.remainingSeconds,
                    };
                  }
                  return prev;
                });
              }
            } else if (data.type === 'ACTION_RELAY' && data.action) {
              // ONLY the host executes remote actions on the master state
              if (!isRemoteClient) {
                executeActionRef.current(data.action);
              }
            } else if (data.type === 'REQUEST_STATE' && !isRemoteClient) {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'SYNC_STATE', payload: stateRef.current }));
              }
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          wsRef.current = null;
          if (!unmounted) {
            reconnectTimeout = setTimeout(connectWebSocket, 2000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!unmounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      unmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [isRemoteClient]);

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
    setIdle,
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
    setIdleDisplayMode,
    setClockFormat24,
    clearTimingReport,
    logTimingEvent,
    triggerUpNextAlert,
    dismissUpNextAlert,
    setUpNextTriggerSeconds,
    dispatchAction,
    connectedClientsCount,
    isWsConnected,
    isRemoteClient,
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
