/**
 * Time formatting utility for StageTimer Pro
 * Under 60 minutes: displays standard MM:SS
 * 60 minutes and above (1+ hours): displays HH:MM:SS
 */
export function formatTime(seconds: number): {
  text: string;
  hasHours: boolean;
} {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safeSeconds / 3600);
  const remaining = safeSeconds % 3600;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  // Under 60 minutes: strictly MM:SS (e.g. 10:00, 45:00)
  // 60 minutes and above: HH:MM:SS (e.g. 01:19:00 for 79 mins, 01:30:00)
  if (hrs > 0) {
    return {
      text: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      hasHours: true,
    };
  }

  return {
    text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    hasHours: false,
  };
}

/**
 * Format overtime / negative count-up time with minus prefix: -MM:SS or -HH:MM:SS
 */
export function formatNegativeTime(seconds: number): {
  text: string;
  hasHours: boolean;
} {
  const { text, hasHours } = formatTime(seconds);
  return {
    text: `-${text}`,
    hasHours,
  };
}

