import React, { useState, useEffect } from 'react';
import type { TimerState } from '../types/timer';
import { formatTime, formatNegativeTime } from '../utils/time';

interface ProjectorDisplayProps {
  state: TimerState;
  isPreview?: boolean;
  onPreviewClick?: () => void;
}

export const ProjectorDisplay: React.FC<ProjectorDisplayProps> = ({
  state,
  isPreview = false,
  onPreviewClick,
}) => {
  const { remainingSeconds, status, colorScheme, finishedAt } = state;
  const [now, setNow] = useState<number>(Date.now());

  // Real-time ticking while in finished state to drive:
  // 1. "TIME UP" for 5 seconds
  // 2. "PLEASE CONCLUDE NOW" for 5 seconds
  // 3. Count-up in minus starting fresh from -00:01
  useEffect(() => {
    if (status !== 'finished') return;

    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 200);

    return () => clearInterval(interval);
  }, [status]);

  if (state.isBlackout) {
    return (
      <div
        className={`stage-screen-root is-blackout ${
          isPreview ? 'is-preview' : 'is-projector-window'
        }`}
        onClick={isPreview ? onPreviewClick : undefined}
      >
        {isPreview && (
          <div className="blackout-preview-indicator">
            <span className="blackout-title">SCREEN BLACKOUT</span>
            <span className="blackout-sub">TV output is currently blank</span>
          </div>
        )}
      </div>
    );
  }

  // When timer has reached 0:
  // 0s to 5s: "TIME UP" in red font on black background (5 seconds)
  // 5s to 10s: "PLEASE CONCLUDE NOW" in red font on black background (5 seconds)
  // 10s and beyond: Count-up starts from 11 seconds upward in minus (-00:11, -00:12...)
  // At every 10-second interval (20s, 30s, 40s...), "TIME UP" displays for 2 seconds
  if (status === 'finished') {
    const finishBase = finishedAt || state.lastUpdated || now;
    const elapsedSecs = Math.max(0, Math.floor((now - finishBase) / 1000));

    let finishedContent: React.ReactNode;

    if (elapsedSecs < 5) {
      finishedContent = (
        <div className="timeup-container">
          <div className="timeup-text">TIME UP</div>
        </div>
      );
    } else if (elapsedSecs < 10) {
      finishedContent = (
        <div className="timeup-container">
          <div className="conclude-text">PLEASE CONCLUDE NOW</div>
        </div>
      );
    } else {
      // Overtime count-up starts from 11 seconds upward
      const currentOvertimeSecs = elapsedSecs + 1;
      const isIntervalTimeUp =
        currentOvertimeSecs >= 20 &&
        (currentOvertimeSecs % 10 === 0 || currentOvertimeSecs % 10 === 1);

      if (isIntervalTimeUp) {
        finishedContent = (
          <div className="timeup-container">
            <div className="timeup-text">TIME UP</div>
          </div>
        );
      } else {
        const { text: formattedNegative, hasHours } = formatNegativeTime(currentOvertimeSecs);
        finishedContent = (
          <div className="stage-digits-container">
            <div className={`stage-digits is-negative ${hasHours ? 'has-hours' : ''}`}>
              {formattedNegative}
            </div>
          </div>
        );
      }
    }

    return (
      <div
        className={`stage-screen-root status-finished ${
          isPreview ? 'is-preview' : 'is-projector-window'
        }`}
        onClick={isPreview ? onPreviewClick : undefined}
        title={isPreview ? 'Click to toggle timer' : undefined}
      >
        {finishedContent}
      </div>
    );
  }


  // Under 60 mins -> MM:SS; 60 mins and above -> HH:MM:SS
  const { text: formattedTime, hasHours } = formatTime(remainingSeconds);

  return (
    <div
      className={`stage-screen-root color-${colorScheme} ${
        isPreview ? 'is-preview' : 'is-projector-window'
      }`}
      onClick={isPreview ? onPreviewClick : undefined}
      title={isPreview ? 'Click to toggle timer' : undefined}
    >
      <div className="stage-digits-container">
        <div className={`stage-digits ${hasHours ? 'has-hours' : ''}`}>{formattedTime}</div>
      </div>
    </div>
  );
};

