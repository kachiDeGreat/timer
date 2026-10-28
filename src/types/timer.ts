export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type StageColor = 'white' | 'blue';

export interface TimerState {
  queuedHours: number;
  queuedMinutes: number;
  queuedSeconds: number;
  totalSeconds: number;
  remainingSeconds: number;
  status: TimerStatus;
  targetEndTime: number | null;
  finishedAt: number | null;
  lastUpdated: number;
  colorScheme: StageColor;
  isBlackout: boolean;
  lastAction?: string;
}

export const DEFAULT_TIMER_STATE: TimerState = {
  queuedHours: 0,
  queuedMinutes: 10,
  queuedSeconds: 0,
  totalSeconds: 600,
  remainingSeconds: 600,
  status: 'idle',
  targetEndTime: null,
  finishedAt: null,
  lastUpdated: Date.now(),
  colorScheme: 'white',
  isBlackout: false,
  lastAction: 'Initialized (10:00)',
};

