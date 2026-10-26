import React, { useState, useEffect } from 'react';
import type { TimerState } from '../types/timer';

import { formatTime } from '../utils/time';

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
  const { remainingSeconds, status, colorScheme } = state;
  const [timeUpPhase, setTimeUpPhase] = useState<'pulse' | 'conclude'>('pulse');

  // Alternating Time Up cycle:
  // 10 heartbeat pulses of "TIME UP" (~5.5s), then big bold "PLEASE CONCLUDE NOW" (~5s)
  useEffect(() => {
    if (status !== 'finished') {
      setTimeUpPhase('pulse');
      return;
    }

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout>;

    const runCycle = () => {
      setTimeUpPhase('pulse');
      timer = setTimeout(() => {
        if (!isMounted) return;
        setTimeUpPhase('conclude');
        timer = setTimeout(() => {
          if (!isMounted) return;
          runCycle();
        }, 5000);
      }, 5500);
    };

    runCycle();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [status]);

  // Under 60 mins -> MM:SS; 60 mins and above -> HH:MM:SS
  const { text: formattedTime, hasHours } = formatTime(remainingSeconds);

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

  return (
    <div
      className={`stage-screen-root color-${colorScheme} ${
        isPreview ? 'is-preview' : 'is-projector-window'
      } ${status === 'finished' ? 'status-finished' : ''}`}
      onClick={isPreview ? onPreviewClick : undefined}
      title={isPreview ? 'Click to toggle timer' : undefined}
    >
      {status === 'finished' ? (
        <div className="timeup-container">
          {timeUpPhase === 'pulse' ? (
            <div className="timeup-text">TIME UP</div>
          ) : (
            <div className="conclude-text">PLEASE CONCLUDE NOW</div>
          )}
        </div>
      ) : (
        <div className="stage-digits-container">
          <div className={`stage-digits ${hasHours ? 'has-hours' : ''}`}>{formattedTime}</div>
        </div>
      )}
    </div>
  );
};
