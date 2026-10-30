export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type StageColor = 'white' | 'blue';

export type AutoAdvanceMode = 'manual' | 'auto-ready' | 'auto-start';

export interface QueuedTimerItem {
  id: string;
  title: string;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

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
  // Multi-timer queue (up to 5 items)
  timerQueue: QueuedTimerItem[];
  activeQueueItemId: string | null;
  autoAdvanceMode: AutoAdvanceMode;

  // Up Next Stage Alert
  upNextTriggerSeconds: number; // Seconds remaining to trigger (default: 60)
  upNextAlertUntil: number | null; // Timestamp when 5s alert ends
  upNextAlertTitle: string | null; // Title of the upcoming segment
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
  isBlackout: true,
  lastAction: 'Initialized (10:00)',
  timerQueue: [],
  activeQueueItemId: null,
  autoAdvanceMode: 'manual',
  upNextTriggerSeconds: 60,
  upNextAlertUntil: null,
  upNextAlertTitle: null,
};

