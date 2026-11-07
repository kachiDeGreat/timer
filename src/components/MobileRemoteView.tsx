import React, { useState, useEffect, useRef } from 'react';
import { useTimer } from '../context/TimerContext';
import { formatTime, formatNegativeTime, hasValidTimerLabel } from '../utils/time';
import type { QueuedTimerItem, AutoAdvanceMode } from '../types/timer';
import { resolveStageColor, STAGE_COLOR_PRESETS } from '../types/timer';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  MonitorCheck,
  Eye,
  EyeOff,
  FastForward,
  BookmarkPlus,
  Megaphone,
  BellRing,
  ListOrdered,
  Smartphone,
  Tv,
  Check,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  FileText,
  Settings,
  Printer,
  Download,
  Clock,
} from 'lucide-react';

interface MobileRemoteViewProps {
  onSwitchToDesktop?: () => void;
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
    const h = String(hours).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return { time: `${h}:${m}`, period };
  }
}

export const MobileRemoteView: React.FC<MobileRemoteViewProps> = ({ onSwitchToDesktop }) => {
  const {
  state,
  pushQueueToLive,
  toggleBlackout,
    pause,
    resume,
    stop,
    reset,
    setIdle,
    addTimeToLive,
    subtractTimeFromLive,
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
    triggerUpNextAlert,
    dismissUpNextAlert,
    setUpNextTriggerSeconds,
    setAutoAdvanceMode,
    setIdleDisplayMode,
    setClockFormat24,
    clearTimingReport,
    isWsConnected,
  } = useTimer();

  // Active Tab: 'live' | 'queue' | 'report'
  const [activeTab, setActiveTab] = useState<'live' | 'queue' | 'report'>('live');

  // Quick Queue Builder Inputs
  const [inputHours, setInputHours] = useState<number>(0);
  const [inputMins, setInputMins] = useState<number>(5);
  const [inputSecs, setInputSecs] = useState<number>(0);
  const [inputTitle, setInputTitle] = useState<string>('');

  // Client-side action lock to prevent rapid double-clicks on mobile touchscreens
  const actionLockRef = useRef<number>(0);
  const withActionLock = (fn: () => void, cooldownMs = 350) => {
    const nowMs = Date.now();
    if (nowMs - actionLockRef.current < cooldownMs) return;
    actionLockRef.current = nowMs;
    fn();
  };

  // Queue editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState<string>('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
    // Haptic feedback if supported by mobile device
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch {
        // ignore
      }
    }
  };

  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';
  const queue = state.timerQueue || [];

  const activeIndex = queue.findIndex((item) => item.id === state.activeQueueItemId);
  const nextItem =
    activeIndex >= 0 && activeIndex < queue.length - 1
      ? queue[activeIndex + 1]
      : queue.length > 0 && (activeIndex === -1 || queue.length > 1)
      ? queue[activeIndex === 0 ? 1 : 0]
      : queue.length === 1 && activeIndex === -1
      ? queue[0]
      : null;

  // Real-time second tick for finished overtime, cue alerts, and device clock
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const isClockIdle = state.status === 'idle' && state.remainingSeconds === 0 && state.idleDisplayMode === 'clock';
    const isAlerting = Boolean(state.upNextAlertUntil && now < state.upNextAlertUntil);
    const isFinished = state.status === 'finished';

    if (!isClockIdle && !isAlerting && !isFinished) return;

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state.status, state.remainingSeconds, state.idleDisplayMode, state.upNextAlertUntil]);

  const isAlertActive = Boolean(
    state.upNextAlertUntil && now < state.upNextAlertUntil && state.upNextAlertTitle
  );
  const alertSecondsLeft = isAlertActive
    ? Math.max(1, Math.ceil((state.upNextAlertUntil! - now) / 1000))
    : 0;

  // Presets for quick builder
  const presets = [
    { label: '5m', h: 0, m: 5, s: 0 },
    { label: '10m', h: 0, m: 10, s: 0 },
    { label: '15m', h: 0, m: 15, s: 0 },
    { label: '20m', h: 0, m: 20, s: 0 },
    { label: '30m', h: 0, m: 30, s: 0 },
    { label: '45m', h: 0, m: 45, s: 0 },
    { label: '1h', h: 1, m: 0, s: 0 },
  ];

  const applyPreset = (h: number, m: number, s: number) => {
    setInputHours(h);
    setInputMins(m);
    setInputSecs(s);
  };

  const handleAddToQueue = () => {
    const total = inputHours * 3600 + inputMins * 60 + inputSecs;
    if (total <= 0) {
      showToast('Set duration first');
      return;
    }
    const success = addToQueue(inputHours, inputMins, inputSecs, inputTitle);
    if (success) {
      showToast(inputTitle ? `Added "${inputTitle}" to Queue` : `Added ${formatTime(total).text} to Queue`);
      setInputTitle('');
    }
  };

  const handleStartEditing = (item: QueuedTimerItem) => {
    setEditingId(item.id);
    setEditTitleText(item.title);
  };

  const handleSaveEditing = (id: string) => {
    if (editTitleText.trim()) {
      updateQueueItemTitle(id, editTitleText.trim());
      showToast('Title updated');
    }
    setEditingId(null);
  };

  const activeItem = activeIndex >= 0 ? queue[activeIndex] : null;

  // Determine what to display on the master clock card
  const getLiveClockDisplay = () => {
    if (state.isBlackout) return { main: 'BLACKOUT', sub: 'TV OUTPUT BLANK' };

    if (state.status === 'finished') {
      if (state.finishedAt) {
        const elapsed = Math.max(0, Math.floor((now - state.finishedAt) / 1000));
        if (elapsed < 5) return { main: 'TIME UP', sub: 'PLEASE CONCLUDE' };
        if (elapsed < 10) return { main: 'CONCLUDE NOW', sub: 'WRAP UP STAGE' };
        const currentOvertime = elapsed + 1;
        if (currentOvertime >= 20 && (currentOvertime % 10 === 0 || currentOvertime % 10 === 1)) {
          return { main: 'TIME UP', sub: 'OVERTIME ALERT' };
        }
        return { main: formatNegativeTime(currentOvertime).text, sub: 'OVERTIME' };
      }
      return { main: 'TIME UP', sub: 'FINISHED' };
    }

    if (state.status === 'idle' && state.remainingSeconds === 0 && state.idleDisplayMode === 'clock') {
      const { time: clockStr, period } = formatDeviceClock(new Date(now), Boolean(state.clockFormat24));
      return { main: clockStr, sub: period || '' };
    }

    return {
      main: formatTime(state.remainingSeconds).text,
      sub: state.status === 'running' ? 'LIVE ON STAGE' : state.status === 'paused' ? 'PAUSED' : 'READY ON STAGE',
    };
  };

  const clockInfo = getLiveClockDisplay();

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const entries = state.timingReport || [];
    if (entries.length === 0) return;
    const headers = ['Time', 'Event', 'Segment / Label', 'Planned Duration', 'Actual Duration', 'Overtime', 'Notes'];
    const rows = entries.map((e) => [
      `"${e.timeFormatted}"`,
      `"${e.eventType}"`,
      `"${(e.label || '').replace(/"/g, '""')}"`,
      `"${formatTime(e.plannedDurationSeconds || 0).text}"`,
      `"${e.actualDurationSeconds ? formatTime(e.actualDurationSeconds).text : '-'}"`,
      `"${e.overtimeSeconds ? formatTime(e.overtimeSeconds).text : '-'}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StageTimer_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded report CSV');
  };

  return (
    <div className="mobile-remote-viewport modern-controller">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mobile-toast" role="status">
          <Sparkles size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sleek Top Navigation Bar */}
      <header className="mobile-topbar-sleek">
        <div className="topbar-left-brand">
          <Smartphone size={17} className="brand-icon" />
          <span className="brand-text">STAGE REMOTE</span>
          <span className={`connection-pill ${isWsConnected ? 'is-connected' : 'is-connecting'}`}>
            <span className="dot" />
            {isWsConnected ? 'LIVE' : 'SYNCING'}
          </span>
        </div>

        <div className="topbar-right-controls">
          {/* Blackout Toggle */}
          <button
            type="button"
            className={`sleek-icon-btn ${state.isBlackout ? 'is-blackout-on' : ''}`}
            onClick={() => {
              toggleBlackout();
              showToast(state.isBlackout ? 'Stage unblanked' : 'Stage blacked out');
            }}
            title={state.isBlackout ? 'Unblank Stage Screen' : 'Blackout Stage Screen'}
          >
            {state.isBlackout ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>

          {/* Color Scheme Switcher */}
          <button
            type="button"
            className="sleek-icon-btn color-switch"
            onClick={() => {
              const currentHex = resolveStageColor(state.colorScheme).toLowerCase();
              const presets = STAGE_COLOR_PRESETS.map((p) => p.hex.toLowerCase());
              const currentIndex = presets.indexOf(currentHex);
              const nextPreset = STAGE_COLOR_PRESETS[(currentIndex + 1) % STAGE_COLOR_PRESETS.length];
              setColorScheme(nextPreset.hex);
              showToast(`Color: ${nextPreset.name}`);
            }}
            title="Cycle stage color theme"
          >
            <span
              className="swatch-circle"
              style={{ background: resolveStageColor(state.colorScheme) }}
            />
          </button>

          {/* Switch to Desktop */}
          {onSwitchToDesktop && (
            <button
              type="button"
              className="desktop-pill-btn"
              onClick={onSwitchToDesktop}
              title="Switch to full desktop view"
            >
              Desktop
            </button>
          )}
        </div>
      </header>

      {/* Main Tab Switcher Bar */}
      <nav className="mobile-tab-bar" aria-label="Sections">
        <button
          type="button"
          className={`tab-item ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          <Tv size={16} />
          <span>Live Control</span>
        </button>

        <button
          type="button"
          className={`tab-item ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <ListOrdered size={16} />
          <span>Queue ({queue.length})</span>
        </button>

        <button
          type="button"
          className={`tab-item ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <FileText size={16} />
          <span>Report & Config</span>
        </button>
      </nav>

      {/* Content Area */}
      <main className="mobile-main-container">
        {/* ======================================================== */}
        {/* TAB 1: LIVE CONTROL & QUICK ACTIONS                      */}
        {/* ======================================================== */}
        {activeTab === 'live' && (
          <div className="tab-pane pane-live">
            {/* Master Clock Display Card */}
            <div className="hero-clock-card">
              <div className="hero-meta-row">
                <span className={`hero-status-tag ${state.isBlackout ? 'tag-blackout' : isRunning ? 'tag-running' : isPaused ? 'tag-paused' : 'tag-idle'}`}>
                  {clockInfo.sub}
                </span>

                {isAlertActive && (
                  <span className="hero-alert-chip">
                    ▲ UP NEXT: {state.upNextAlertTitle} ({alertSecondsLeft}s)
                  </span>
                )}
              </div>

              <div
                className={`hero-digits ${
                  state.isBlackout
                    ? 'digits-blackout'
                    : state.status === 'finished'
                    ? 'digits-finished'
                    : ''
                }`}
                style={
                  !state.isBlackout && state.status !== 'finished'
                    ? { color: resolveStageColor(state.colorScheme) }
                    : undefined
                }
              >
                {clockInfo.main}
              </div>

              {activeItem && hasValidTimerLabel(activeItem.title) && (
                <div className="hero-active-title">
                  #{activeIndex + 1} {activeItem.title}
                </div>
              )}
            </div>

            {/* Primary Transport Controls */}
            <div className="primary-transport-box">
              {!isRunning ? (
                <button
                  type="button"
                  className="big-action-btn btn-start"
                  onClick={() => {
                    withActionLock(() => {
                      if (isPaused) {
                        resume();
                        showToast('Timer Resumed');
                      } else if (state.status === 'idle' && state.remainingSeconds > 0) {
                        resume();
                        showToast('Started Staged Timer');
                      } else {
                        pushQueueToLive();
                        showToast('Started Live');
                      }
                    });
                  }}
                >
                  <Play size={22} fill="currentColor" />
                  <span>{isPaused ? 'RESUME COUNTDOWN' : 'START LIVE'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="big-action-btn btn-pause"
                  onClick={() => {
                    withActionLock(() => {
                      pause();
                      showToast('Timer Paused');
                    });
                  }}
                >
                  <Pause size={22} fill="currentColor" />
                  <span>PAUSE COUNTDOWN</span>
                </button>
              )}

              <div className="secondary-transport-row">
                <button
                  type="button"
                  className="sub-btn btn-stop"
                  onClick={() => {
                    withActionLock(() => {
                      stop();
                      showToast('Stopped');
                    });
                  }}
                  disabled={state.status === 'idle' && state.remainingSeconds === 0}
                >
                  <Square size={16} fill="currentColor" />
                  <span>STOP</span>
                </button>

                <button
                  type="button"
                  className="sub-btn btn-reset"
                  onClick={() => {
                    withActionLock(() => {
                      reset();
                      showToast('Reset to Original Duration');
                    });
                  }}
                >
                  <RotateCcw size={16} />
                  <span>RESET</span>
                </button>

                <button
                  type="button"
                  className="sub-btn btn-idle"
                  onClick={() => {
                    withActionLock(() => {
                      setIdle();
                      showToast('Stage set to Idle');
                    });
                  }}
                  disabled={state.status === 'idle' && state.remainingSeconds === 0 && !state.activeQueueItemId}
                >
                  <Clock size={16} />
                  <span>SET IDLE</span>
                </button>
              </div>
            </div>

            {/* 1-Tap Quick Adjust Nudge Chips */}
            <div className="quick-nudge-section">
              <span className="nudge-label">QUICK LIVE TIME ADJUST:</span>
              <div className="nudge-chips-row">
                <button
                  type="button"
                  className="nudge-chip sub"
                  onClick={() => {
                    withActionLock(() => {
                      subtractTimeFromLive(0, 1, 0);
                      showToast('-1m from Live Clock');
                    });
                  }}
                >
                  -1m
                </button>
                <button
                  type="button"
                  className="nudge-chip sub"
                  onClick={() => {
                    withActionLock(() => {
                      subtractTimeFromLive(0, 0, 30);
                      showToast('-30s from Live Clock');
                    });
                  }}
                >
                  -30s
                </button>
                <button
                  type="button"
                  className="nudge-chip add"
                  onClick={() => {
                    withActionLock(() => {
                      addTimeToLive(0, 0, 30);
                      showToast('+30s to Live Clock');
                    });
                  }}
                >
                  +30s
                </button>
                <button
                  type="button"
                  className="nudge-chip add"
                  onClick={() => {
                    withActionLock(() => {
                      addTimeToLive(0, 1, 0);
                      showToast('+1m to Live Clock');
                    });
                  }}
                >
                  +1m
                </button>
                <button
                  type="button"
                  className="nudge-chip add"
                  onClick={() => {
                    withActionLock(() => {
                      addTimeToLive(0, 5, 0);
                      showToast('+5m to Live Clock');
                    });
                  }}
                >
                  +5m
                </button>
              </div>
            </div>

            {/* Up Next Strip */}
            {nextItem && (() => {
              const nextHasLabel = hasValidTimerLabel(nextItem.title);
              return (
                <div className="up-next-compact-card">
                  <div className="up-next-info">
                    <span className="up-next-badge">
                      {nextHasLabel ? 'UP NEXT:' : 'NEXT IN QUEUE:'}
                    </span>
                    <span className="up-next-title">
                      {nextHasLabel ? nextItem.title : '(Unlabeled)'}
                    </span>
                    <span className="up-next-time">{formatTime(nextItem.totalSeconds).text}</span>
                  </div>

                  <div className="up-next-buttons">
                    {nextHasLabel && (
                      isAlertActive ? (
                        <button
                          type="button"
                          className="next-btn btn-dismiss-alert"
                          onClick={() => {
                            dismissUpNextAlert();
                            showToast('Alert Dismissed');
                          }}
                        >
                          <BellRing size={14} />
                          <span>Dismiss ({alertSecondsLeft}s)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="next-btn btn-cue"
                          onClick={() => {
                            triggerUpNextAlert(nextItem.title);
                            showToast(`Cued "${nextItem.title}"`);
                          }}
                        >
                          <Megaphone size={14} />
                          <span>Cue Up Next</span>
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      className="next-btn btn-load"
                      onClick={() => {
                        loadNextInQueueToStage();
                        showToast('Loaded in Ready mode');
                      }}
                    >
                      <MonitorCheck size={14} />
                      <span>Ready</span>
                    </button>

                    <button
                      type="button"
                      className="next-btn btn-play"
                      onClick={() => {
                        playNextInQueue();
                        showToast('Playing next');
                      }}
                    >
                      <FastForward size={14} />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PLAYLIST QUEUE & QUICK ADD                        */}
        {/* ======================================================== */}
        {activeTab === 'queue' && (
          <div className="tab-pane pane-queue">
            {/* Quick Add Form */}
            <div className="queue-quick-builder">
              <div className="builder-header-row">
                <span className="builder-title">+ ADD TIMER TO QUEUE</span>
                <span className="builder-queue-count">{queue.length} Timers Enqueued</span>
              </div>

              {/* Presets Row */}
              <div className="builder-presets-row">
                {presets.map((p) => {
                  const isActive = inputHours === p.h && inputMins === p.m && inputSecs === p.s;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className={`builder-preset-chip ${isActive ? 'is-active' : ''}`}
                      onClick={() => applyPreset(p.h, p.m, p.s)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Input Form Row */}
              <div className="builder-inputs-row">
                <div className="builder-time-group">
                  <div className="time-field">
                    <label>HRS</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={inputHours}
                      onChange={(e) => setInputHours(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <span className="time-sep">:</span>
                  <div className="time-field">
                    <label>MIN</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={inputMins}
                      onChange={(e) => setInputMins(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                  <span className="time-sep">:</span>
                  <div className="time-field">
                    <label>SEC</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={inputSecs}
                      onChange={(e) => setInputSecs(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>

                <div className="builder-title-group">
                  <input
                    type="text"
                    placeholder="Label (e.g. Sermon, Praise)"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    maxLength={40}
                  />
                </div>
              </div>

              <button
                type="button"
                className="builder-add-btn"
                onClick={handleAddToQueue}
              >
                <BookmarkPlus size={16} />
                <span>Add to Queue</span>
              </button>
            </div>

            {/* Queue List */}
            <div className="queue-items-container">
              <div className="queue-list-header">
                <span className="list-title">PLAYLIST QUEUE (UNLIMITED)</span>
                {queue.length > 0 && (
                  <button
                    type="button"
                    className="clear-queue-link"
                    onClick={() => {
                      clearQueue();
                      showToast('Queue cleared');
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {queue.length === 0 ? (
                <div className="queue-empty-mobile">
                  <Clock size={32} className="text-muted" />
                  <p>Queue is currently empty</p>
                  <span>Select a preset above and tap "Add to Queue"</span>
                </div>
              ) : (
                <div className="queue-cards-stack">
                  {queue.map((item, index) => {
                    const slotNum = index + 1;
                    const isActive = state.activeQueueItemId === item.id;
                    const isItemRunning = isActive && isRunning;
                    const isItemPaused = isActive && state.status === 'paused';
                    const hasLabel = hasValidTimerLabel(item.title);

                    return (
                      <div
                        key={item.id}
                        className={`queue-mobile-card ${isActive ? 'is-active-card' : ''}`}
                      >
                        <div className="card-top-line">
                          <span className="slot-idx">#{slotNum}</span>
                          {isItemRunning ? (
                            <span className="queue-status-tag live">LIVE</span>
                          ) : isItemPaused ? (
                            <span className="queue-status-tag paused">PAUSED</span>
                          ) : isActive ? (
                            <span className="queue-status-tag ready">READY</span>
                          ) : null}
                          {editingId === item.id ? (
                            <div className="inline-edit-box">
                              <input
                                type="text"
                                value={editTitleText}
                                onChange={(e) => setEditTitleText(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditing(item.id);
                                  else if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <button
                                type="button"
                                className="save-btn"
                                onClick={() => handleSaveEditing(item.id)}
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`slot-title ${!hasLabel ? 'is-unlabeled' : ''}`}
                              onClick={() => handleStartEditing(item)}
                            >
                              {hasLabel ? item.title : '(Tap to add title)'}
                              <Edit2 size={11} className="edit-icon" />
                            </span>
                          )}
                          <span className="slot-time">{formatTime(item.totalSeconds).text}</span>
                        </div>

                        <div className="card-actions-line">
                          <button
                            type="button"
                            className="card-action-btn play"
                            onClick={() => {
                              playQueueItem(item.id);
                              showToast(`Playing #${slotNum}`);
                            }}
                          >
                            <Play size={13} fill="currentColor" />
                            <span>Play</span>
                          </button>

                          <button
                            type="button"
                            className="card-action-btn ready"
                            onClick={() => {
                              loadQueueItemToStage(item.id);
                              showToast(`Loaded #${slotNum} (Ready)`);
                            }}
                          >
                            <MonitorCheck size={13} />
                            <span>Ready</span>
                          </button>

                          {hasLabel && (
                            <button
                              type="button"
                              className="card-action-btn cue"
                              onClick={() => {
                                triggerUpNextAlert(item.title);
                                showToast(`Cued "${item.title}"`);
                              }}
                            >
                              <Megaphone size={13} />
                              <span>Cue</span>
                            </button>
                          )}

                          {index > 0 && (
                            <button
                              type="button"
                              className="card-action-btn icon-only"
                              onClick={() => reorderQueue(index, index - 1)}
                              title="Move up"
                            >
                              <ChevronUp size={15} />
                            </button>
                          )}

                          {index < queue.length - 1 && (
                            <button
                              type="button"
                              className="card-action-btn icon-only"
                              onClick={() => reorderQueue(index, index + 1)}
                              title="Move down"
                            >
                              <ChevronDown size={15} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="card-action-btn delete"
                            onClick={() => {
                              removeFromQueue(item.id);
                              showToast('Removed item');
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: EVENT TIMING REPORT & APP CONFIG                  */}
        {/* ======================================================== */}
        {activeTab === 'report' && (
          <div className="tab-pane pane-report">
            {/* Report Section */}
            <div className="mobile-report-card">
              <div className="report-card-header">
                <div className="title-row">
                  <FileText size={18} className="text-emerald" />
                  <span className="card-title">EVENT TIMING REPORT</span>
                </div>
                <div className="report-action-buttons">
                  <button
                    type="button"
                    className="report-small-btn"
                    onClick={handlePrintReport}
                    title="Print report"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    className="report-small-btn"
                    onClick={handleExportCSV}
                    title="Export CSV"
                    disabled={!state.timingReport || state.timingReport.length === 0}
                  >
                    <Download size={13} />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    className="report-small-btn danger"
                    onClick={() => {
                      if (window.confirm('Clear all event timing records?')) {
                        clearTimingReport();
                        showToast('Timing report cleared');
                      }
                    }}
                    disabled={!state.timingReport || state.timingReport.length === 0}
                  >
                    <Trash2 size={13} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="mobile-stats-row">
                <div className="stat-pill">
                  <span className="num">{state.timingReport ? state.timingReport.filter(e => e.eventType === 'START').length : 0}</span>
                  <span className="lbl">Segments</span>
                </div>
                <div className="stat-pill">
                  <span className="num">{state.timingReport ? state.timingReport.length : 0}</span>
                  <span className="lbl">Audit Logs</span>
                </div>
              </div>

              {/* Scrollable Audit Log Table */}
              <div className="mobile-audit-table-wrap">
                {!state.timingReport || state.timingReport.length === 0 ? (
                  <p className="no-logs-text">No timing events logged yet.</p>
                ) : (
                  <table className="mobile-audit-table">
                    <thead>
                      <tr>
                        <th>TIME</th>
                        <th>EVENT</th>
                        <th>LABEL / DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.timingReport.map((entry) => (
                        <tr key={entry.id}>
                          <td className="time-col">{entry.timeFormatted}</td>
                          <td className="event-col">
                            <span className={`event-pill pill-${entry.eventType.toLowerCase()}`}>
                              {entry.eventType}
                            </span>
                          </td>
                          <td className="details-col">
                            <div className="entry-label">{entry.label}</div>
                            {entry.notes && <div className="entry-notes">{entry.notes}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Settings Section */}
            <div className="mobile-settings-card">
              <div className="settings-card-header">
                <Settings size={18} className="text-emerald" />
                <span className="card-title">APP CONFIGURATION</span>
              </div>

              {/* Idle Display Mode */}
              <div className="setting-block">
                <label className="setting-block-label">DEFAULT IDLE SCREEN DISPLAY:</label>
                <div className="toggle-options-group">
                  <button
                    type="button"
                    className={`toggle-option-btn ${state.idleDisplayMode === 'zero' ? 'active' : ''}`}
                    onClick={() => {
                      setIdleDisplayMode('zero');
                      showToast('Idle Mode: 00:00');
                    }}
                  >
                    00:00 (Digital Zero)
                  </button>
                  <button
                    type="button"
                    className={`toggle-option-btn ${state.idleDisplayMode === 'clock' ? 'active' : ''}`}
                    onClick={() => {
                      setIdleDisplayMode('clock');
                      showToast('Idle Mode: Device Clock');
                    }}
                  >
                    Device Clock (Local Time)
                  </button>
                </div>

                {state.idleDisplayMode === 'clock' && (
                  <div className="clock-format-row">
                    <span className="sub-lbl">Format:</span>
                    <button
                      type="button"
                      className={`format-btn ${!state.clockFormat24 ? 'active' : ''}`}
                      onClick={() => setClockFormat24(false)}
                    >
                      12-Hour (AM/PM)
                    </button>
                    <button
                      type="button"
                      className={`format-btn ${state.clockFormat24 ? 'active' : ''}`}
                      onClick={() => setClockFormat24(true)}
                    >
                      24-Hour
                    </button>
                  </div>
                )}
              </div>

              {/* Queue Transition Mode */}
              <div className="setting-block">
                <label className="setting-block-label">QUEUE TRANSITION BEHAVIOR:</label>
                <div className="select-wrap">
                  <select
                    value={state.autoAdvanceMode}
                    onChange={(e) => {
                      const mode = e.target.value as AutoAdvanceMode;
                      setAutoAdvanceMode(mode);
                      showToast(`Transition: ${mode}`);
                    }}
                  >
                    <option value="auto-start">Auto Start Next (No Overtime Count-Up)</option>
                    <option value="auto-load">Auto Load Next (Ready Mode)</option>
                    <option value="manual">Manual Operation (Standard Overtime)</option>
                  </select>
                </div>
                <span className="setting-hint">
                  Active when queue has items. Shows TIME UP (5s) + CONCLUDE NOW (5s), then transitions.
                </span>
              </div>

              {/* Up Next Alert Trigger */}
              <div className="setting-block">
                <label className="setting-block-label">AUTO UP NEXT STAGE ALERT:</label>
                <div className="select-wrap">
                  <select
                    value={state.upNextTriggerSeconds ?? 60}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setUpNextTriggerSeconds(v);
                      showToast(v > 0 ? `Alert at ${formatTime(v).text}` : 'Alerts Disabled');
                    }}
                  >
                    <option value={120}>At 2:00 Remaining</option>
                    <option value={90}>At 1:30 Remaining</option>
                    <option value={60}>At 1:00 Remaining (Recommended)</option>
                    <option value={45}>At 0:45 Remaining</option>
                    <option value={30}>At 0:30 Remaining</option>
                    <option value={0}>Disabled (Manual Only)</option>
                  </select>
                </div>
              </div>

              {/* Stage Digit Color */}
              <div className="setting-block">
                <label className="setting-block-label">STAGE DIGIT COLOR:</label>
                <div className="mobile-color-chips-grid">
                  {STAGE_COLOR_PRESETS.map((preset) => {
                    const isSelected =
                      resolveStageColor(state.colorScheme).toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`mobile-color-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setColorScheme(preset.hex);
                          showToast(`Color: ${preset.name}`);
                        }}
                      >
                        <span className="chip-color-dot" style={{ background: preset.hex }} />
                        <span>{preset.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
