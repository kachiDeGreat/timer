import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { TimerState } from '../types/timer';
import { resolveStageColor } from '../types/timer';
import { formatTime, formatNegativeTime, hasValidTimerLabel } from '../utils/time';

interface ProjectorDisplayProps {
  state: TimerState;
  isPreview?: boolean;
  onPreviewClick?: () => void;
}

function formatDeviceClock(date: Date, is24: boolean): { time: string; period?: string } {
  if (is24) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return { time: `${h}:${m}` };
  } else {
    let hours = date.getHours();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const h = String(hours); // No leading zero on 12-hour clock (e.g. 3:06 instead of 03:06)
    const m = String(date.getMinutes()).padStart(2, '0');
    return { time: `${h}:${m}`, period };
  }
}

type StageDisplayContent =
  | { type: 'timeup'; text: 'TIME UP' }
  | { type: 'conclude'; text: 'PLEASE CONCLUDE NOW' }
  | { type: 'overtime'; text: string; hasHours: boolean }
  | { type: 'clock'; timeStr: string; period?: string }
  | { type: 'countdown'; text: string; hasHours: boolean };

export const ProjectorDisplay: React.FC<ProjectorDisplayProps> = ({
  state,
  isPreview = false,
  onPreviewClick,
}) => {
  const { remainingSeconds, status, colorScheme, finishedAt } = state;
  const [now, setNow] = useState<number>(Date.now());
  const [dynamicFontSize, setDynamicFontSize] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const isClockIdle = status === 'idle' && remainingSeconds === 0 && state.idleDisplayMode === 'clock';
  const isAlerting = Boolean(
    state.upNextAlertUntil &&
    now < state.upNextAlertUntil &&
    hasValidTimerLabel(state.upNextAlertTitle)
  );

  useEffect(() => {
    if (status !== 'finished' && !isAlerting && !isClockIdle) return;

    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 200);

    return () => clearInterval(interval);
  }, [status, isAlerting, isClockIdle]);

  // 5-second prominent UP NEXT stage alert (Only if timer has a valid user-assigned label!)
  const isUpNextActive =
    Boolean(
      state.upNextAlertUntil &&
      now < state.upNextAlertUntil &&
      hasValidTimerLabel(state.upNextAlertTitle)
    ) && !state.isBlackout;

  // Cue banner rendering
  let cueBannerNode: React.ReactNode = null;
  if (isUpNextActive) {
    let clockLabel = 'COUNTDOWN:';
    let clockVal = formatTime(remainingSeconds).text;

    if (status === 'finished') {
      const finishBase = finishedAt || state.lastUpdated || now;
      const elapsedSecs = Math.max(0, Math.floor((now - finishBase) / 1000));
      if (elapsedSecs < 10) {
        clockLabel = 'STATUS:';
        clockVal = 'TIME UP';
      } else {
        const { text: formattedNegative } = formatNegativeTime(elapsedSecs + 1);
        clockLabel = 'OVERTIME:';
        clockVal = formattedNegative;
      }
    }

    cueBannerNode = (
      <div className="drift-stage-banner cue-active smooth-fade-in">
        {/* Multi-shade Red Drift Ribbons */}
        <div className="drift-layer drift-layer-deep" />
        <div className="drift-layer drift-layer-crimson" />
        <div className="drift-layer drift-layer-scarlet" />
        <div className="drift-layer drift-layer-sheen" />

        {/* Drifting Content */}
        <div className="drift-content">
          <div className="drift-badge">
            <span className="drift-badge-text">UP NEXT</span>
          </div>
          <div className="drift-title">{state.upNextAlertTitle}</div>
          <div className="drift-clock-pill">
            <span className="drift-clock-label">{clockLabel}</span>
            <span className="drift-clock-val">{clockVal}</span>
          </div>
        </div>
      </div>
    );
  }

  // Determine active display content
  let content: StageDisplayContent;
  if (status === 'finished') {
    const finishBase = finishedAt || state.lastUpdated || now;
    const elapsedSecs = Math.max(0, Math.floor((now - finishBase) / 1000));

    if (elapsedSecs < 5) {
      content = { type: 'timeup', text: 'TIME UP' };
    } else if (elapsedSecs < 10) {
      content = { type: 'conclude', text: 'PLEASE CONCLUDE NOW' };
    } else {
      const currentOvertimeSecs = elapsedSecs + 1;
      const isIntervalTimeUp =
        currentOvertimeSecs >= 20 &&
        (currentOvertimeSecs % 10 === 0 || currentOvertimeSecs % 10 === 1);

      if (isIntervalTimeUp) {
        content = { type: 'timeup', text: 'TIME UP' };
      } else {
        const { text: formattedNegative, hasHours } = formatNegativeTime(currentOvertimeSecs);
        content = { type: 'overtime', text: formattedNegative, hasHours };
      }
    }
  } else if (isClockIdle) {
    const { time: clockTimeStr, period: clockPeriod } = formatDeviceClock(
      new Date(now),
      Boolean(state.clockFormat24)
    );
    content = { type: 'clock', timeStr: clockTimeStr, period: clockPeriod };
  } else {
    const { text: formattedTime, hasHours } = formatTime(remainingSeconds);
    content = { type: 'countdown', text: formattedTime, hasHours };
  }

  // Resolve active digit color (supports all presets + custom hex codes)
  const resolvedDigitColor = resolveStageColor(colorScheme);

  // Measure and scale typography to fill external display width and height to maximum safe bounds
  const measureAndScale = () => {
    if (state.isBlackout) return;
    const container = containerRef.current;
    const ruler = rulerRef.current;
    if (!container || !ruler) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const rulerRect = ruler.getBoundingClientRect();
    const rulerWidth = rulerRect.width || ruler.offsetWidth;
    const rulerHeight = rulerRect.height || ruler.offsetHeight;
    if (rulerWidth <= 0 || rulerHeight <= 0) return;

    // Fill up to 93% of display width (leaves 3.5% safe bezel margin on each side)
    const fillWidthFactor = 0.94;
    // Fill up to 74% of display height (or 52% when UP NEXT cue banner is showing, 80% for conclude prompt)
    const fillHeightFactor = isUpNextActive ? 0.52 : (content.type === 'conclude' ? 0.80 : 0.74);

    const availableWidth = containerWidth * fillWidthFactor;
    const availableHeight = containerHeight * fillHeightFactor;

    const scaleW = availableWidth / rulerWidth;
    const scaleH = availableHeight / rulerHeight;
    const optimalScale = Math.min(scaleW, scaleH);
    const calculatedPx = Math.floor(100 * optimalScale);

    if (calculatedPx > 8) {
      setDynamicFontSize((prev) => {
        if (prev !== null && Math.abs(prev - calculatedPx) <= 1) return prev;
        return calculatedPx;
      });
    }
  };

  const contentKey = `${state.isBlackout}_${content.type}_${'timeStr' in content ? content.timeStr + (content.period || '') : content.text}_${isUpNextActive}`;

  useLayoutEffect(() => {
    measureAndScale();
  }, [contentKey, isUpNextActive, state.isBlackout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    measureAndScale();

    const ro = new ResizeObserver(() => {
      measureAndScale();
    });
    ro.observe(container);

    window.addEventListener('resize', measureAndScale);

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        measureAndScale();
      });
    }

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureAndScale);
    };
  }, [isUpNextActive]);

  const rulerStyle: React.CSSProperties = {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    top: -9999,
    left: -9999,
    fontSize: '100px',
    lineHeight: content.type === 'clock' ? 1 : 0.9,
    fontFamily: 'var(--font-family)',
    fontWeight: 950,
    letterSpacing: content.type === 'conclude' ? '0.02em' : content.type === 'clock' ? '-0.03em' : '-0.04em',
    fontVariantNumeric: 'tabular-nums',
    display: 'inline-flex',
    alignItems: 'baseline',
  };

  // Render the active stage content
  let mainVisualNode: React.ReactNode;
  if (content.type === 'timeup') {
    mainVisualNode = (
      <div className="timeup-container">
        <div
          className="timeup-text"
          style={{ fontSize: dynamicFontSize ? `${dynamicFontSize}px` : undefined }}
        >
          {content.text}
        </div>
      </div>
    );
  } else if (content.type === 'conclude') {
    mainVisualNode = (
      <div className="timeup-container">
        <div
          className="conclude-text"
          style={{ fontSize: dynamicFontSize ? `${dynamicFontSize}px` : undefined }}
        >
          <span className="conclude-line-top">PLEASE</span>
          <span className="conclude-line-bottom">CONCLUDE NOW</span>
        </div>
      </div>
    );
  } else if (content.type === 'overtime') {
    mainVisualNode = (
      <div className="stage-digits-container">
        <div
          className={`stage-digits is-negative ${content.hasHours ? 'has-hours' : ''}`}
          style={{
            fontSize: dynamicFontSize ? `${dynamicFontSize}px` : undefined,
          }}
        >
          {content.text}
        </div>
      </div>
    );
  } else if (content.type === 'clock') {
    mainVisualNode = (
      <div className="stage-digits-container">
        <div
          className={`stage-digits is-clock-digits ${content.period ? 'has-period' : 'is-24h'}`}
          style={{
            fontSize: dynamicFontSize ? `${dynamicFontSize}px` : undefined,
            color: resolvedDigitColor,
          }}
        >
          <span className="clock-digits-time">{content.timeStr}</span>
          {content.period && <span className="clock-period-tag">{content.period}</span>}
        </div>
      </div>
    );
  } else {
    mainVisualNode = (
      <div className="stage-digits-container">
        <div
          className={`stage-digits ${content.hasHours ? 'has-hours' : ''}`}
          style={{
            fontSize: dynamicFontSize ? `${dynamicFontSize}px` : undefined,
            color: resolvedDigitColor,
          }}
        >
          {content.text}
        </div>
      </div>
    );
  }

  const rootClassNames = [
    'stage-screen-root',
    status === 'finished' ? 'status-finished' : '',
    content.type === 'clock' ? 'is-device-clock' : '',
    isPreview ? 'is-preview' : 'is-projector-window',
  ]
    .filter(Boolean)
    .join(' ');

  if (state.isBlackout) {
    return (
      <div
        ref={containerRef}
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
      ref={containerRef}
      className={rootClassNames}
      onClick={isPreview ? onPreviewClick : undefined}
      title={isPreview ? (content.type === 'clock' ? 'Device Clock' : 'Click to toggle timer') : undefined}
    >
      {mainVisualNode}
      {cueBannerNode}

      {/* Hidden DOM measurement ruler for dynamic external display fill calculation */}
      <div ref={rulerRef} style={rulerStyle} aria-hidden="true">
        {content.type === 'clock' ? (
          <>
            <span className="clock-digits-time">{content.timeStr}</span>
            {content.period && (
              <span
                className="clock-period-tag"
                style={{
                  fontSize: '0.35em',
                  fontWeight: 900,
                  marginLeft: '0.28em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  verticalAlign: 'baseline',
                }}
              >
                {content.period}
              </span>
            )}
          </>
        ) : content.type === 'conclude' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0.92, textAlign: 'center' }}>
            <span style={{ whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>PLEASE</span>
            <span style={{ whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>CONCLUDE NOW</span>
          </div>
        ) : (
          <span>{content.text}</span>
        )}
      </div>
    </div>
  );
};
