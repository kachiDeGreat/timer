export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type StageColorPreset =
  | 'white'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'amber'
  | 'orange'
  | 'purple'
  | 'magenta';

export type StageColor = StageColorPreset | string;

export interface ColorPresetOption {
  id: string;
  name: string;
  hex: string;
}

export const STAGE_COLOR_PRESETS: ColorPresetOption[] = [
  { id: 'white', name: 'Studio White', hex: '#ffffff' },
  { id: 'blue', name: 'Electric Sky', hex: '#38bdf8' },
  { id: 'cyan', name: 'Vivid Cyan', hex: '#06b6d4' },
  { id: 'green', name: 'Emerald Green', hex: '#10b981' },
  { id: 'amber', name: 'Amber Gold', hex: '#f59e0b' },
  { id: 'orange', name: 'Vivid Orange', hex: '#f97316' },
  { id: 'purple', name: 'Neon Purple', hex: '#a855f7' },
  { id: 'magenta', name: 'Hot Coral', hex: '#f43f5e' },
];

export function resolveStageColor(color?: string): string {
  if (!color) return '#ffffff';
  const found = STAGE_COLOR_PRESETS.find((p) => p.id === color || p.hex.toLowerCase() === color.toLowerCase());
  if (found) return found.hex;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  return '#ffffff';
}

export type AutoAdvanceMode = 'manual' | 'auto-load' | 'auto-start' | 'auto-ready';

export type IdleDisplayMode = 'zero' | 'clock';

export type TimingReportEventType =
  | 'START'
  | 'PAUSE'
  | 'RESUME'
  | 'STOP'
  | 'RESET'
  | 'IDLE'
  | 'ADD_TIME'
  | 'SUBTRACT_TIME'
  | 'TIME_UP'
  | 'OVERTIME'
  | 'CONCLUDED';

export interface TimingReportEntry {
  id: string;
  timestamp: number;
  timeFormatted: string;
  eventType: TimingReportEventType;
  label: string;
  plannedDurationSeconds: number;
  actualDurationSeconds?: number;
  overtimeSeconds?: number;
  notes?: string;
}

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
  initialDurationSeconds: number; // Base duration of active timer session (for reliable reset)
  activeTimerTitle: string; // Title / label of currently active countdown
  status: TimerStatus;
  targetEndTime: number | null;
  finishedAt: number | null;
  lastUpdated: number;
  colorScheme: StageColor;
  isBlackout: boolean;
  lastAction?: string;

  // Unlimited Multi-timer Queue
  timerQueue: QueuedTimerItem[];
  activeQueueItemId: string | null;
  autoAdvanceMode: AutoAdvanceMode;

  // Display Settings
  idleDisplayMode: IdleDisplayMode; // 'zero' (00:00) or 'clock' (live device clock)
  clockFormat24: boolean; // 12-hour or 24-hour clock

  // Up Next Stage Alert
  upNextTriggerSeconds: number; // Seconds remaining to trigger (default: 60)
  upNextAlertUntil: number | null; // Timestamp when 5s alert ends
  upNextAlertTitle: string | null; // Title of the upcoming segment

  // Audit trail / Event Timing Report
  timingReport: TimingReportEntry[];
}

export interface TimerSettings {
  idleDisplayMode: IdleDisplayMode; // 'zero' (00:00) or 'clock' (device local clock)
  clockFormat24: boolean; // 12-hour or 24-hour clock
  autoAdvanceMode: AutoAdvanceMode;
  upNextTriggerSeconds: number;
  colorScheme: StageColor;
  timerQueue?: QueuedTimerItem[];
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  idleDisplayMode: 'zero',
  clockFormat24: false,
  autoAdvanceMode: 'manual',
  upNextTriggerSeconds: 60,
  colorScheme: 'white',
  timerQueue: [],
};

export const DEFAULT_TIMER_STATE: TimerState = {
  queuedHours: 0,
  queuedMinutes: 0,
  queuedSeconds: 0,
  totalSeconds: 0,
  remainingSeconds: 0,
  initialDurationSeconds: 0,
  activeTimerTitle: '',
  status: 'idle',
  targetEndTime: null,
  finishedAt: null,
  lastUpdated: Date.now(),
  colorScheme: 'white',
  isBlackout: true,
  lastAction: 'Ready (00:00)',
  timerQueue: [],
  activeQueueItemId: null,
  autoAdvanceMode: 'manual',
  idleDisplayMode: 'zero',
  clockFormat24: false,
  upNextTriggerSeconds: 60,
  upNextAlertUntil: null,
  upNextAlertTitle: null,
  timingReport: [],
};
