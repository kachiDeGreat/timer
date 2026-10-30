import React, { useState, useEffect } from 'react';
import { useTimer } from '../context/TimerContext';
import { formatTime, formatNegativeTime, hasValidTimerLabel } from '../utils/time';
import type { QueuedTimerItem } from '../types/timer';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Minus,
  MonitorCheck,
  Eye,
  EyeOff,
  FastForward,
  BookmarkPlus,
  Megaphone,
  BellRing,
  ListOrdered,
  Smartphone,
  Sliders,
  Tv,
  Check,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MobileRemoteViewProps {
  onSwitchToDesktop?: () => void;
}

export const MobileRemoteView: React.FC<MobileRemoteViewProps> = ({ onSwitchToDesktop }) => {
  const {
    state,
    queueTime,
    pushQueueToLive,
    loadQueueToStage,
    toggleBlackout,
    pause,
    resume,
    stop,
    reset,
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
    isWsConnected,
  } = useTimer();

  // Active Tab: 'live' | 'queue' | 'builder' | 'all'
  const [activeTab, setActiveTab] = useState<'live' | 'queue' | 'builder' | 'all'>('live');

  // Builder Form Inputs
  const [inputHours, setInputHours] = useState<number>(state.queuedHours || 0);
  const [inputMins, setInputMins] = useState<number>(state.queuedMinutes || 10);
  const [inputSecs, setInputSecs] = useState<number>(state.queuedSeconds || 0);
  const [inputTitle, setInputTitle] = useState<string>('');

  // Add / Subtract Accordion
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add');
  const [addHours, setAddHours] = useState<number>(0);
  const [addMins, setAddMins] = useState<number>(2);
  const [addSecs, setAddSecs] = useState<number>(30);

  const [subHours, setSubHours] = useState<number>(0);
  const [subMins, setSubMins] = useState<number>(1);
  const [subSecs, setSubSecs] = useState<number>(0);

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
        navigator.vibrate(30);
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

  // Up Next Alert tracking
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    if (!state.upNextAlertUntil) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [state.upNextAlertUntil]);

  const isAlertActive = Boolean(
    state.upNextAlertUntil && now < state.upNextAlertUntil && state.upNextAlertTitle
  );
  const alertSecondsLeft = isAlertActive
    ? Math.max(1, Math.ceil(((state.upNextAlertUntil || 0) - now) / 1000))
    : 0;

  // Presets
  const presets = [
    { label: '5m', h: 0, m: 5, s: 0 },
    { label: '10m', h: 0, m: 10, s: 0 },
    { label: '15m', h: 0, m: 15, s: 0 },
    { label: '20m', h: 0, m: 20, s: 0 },
    { label: '30m', h: 0, m: 30, s: 0 },
    { label: '45m', h: 0, m: 45, s: 0 },
    { label: '1h', h: 1, m: 0, s: 0 },
    { label: '1h 30m', h: 1, m: 30, s: 0 },
    { label: '2h', h: 2, m: 0, s: 0 },
  ];

  const applyPreset = (h: number, m: number, s: number) => {
    setInputHours(h);
    setInputMins(m);
    setInputSecs(s);
    queueTime(h, m, s);
    showToast(`Loaded ${h > 0 ? h + 'h ' : ''}${m}m preset`);
  };

  const handleAddToQueue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const success = addToQueue(inputHours, inputMins, inputSecs, inputTitle);
    if (success) {
      showToast(inputTitle ? `Added "${inputTitle}" to Queue` : 'Added to Queue');
      setInputTitle('');
    } else {
      showToast('Queue is full (Max 5)');
    }
  };

  const handleStartEditing = (item: QueuedTimerItem) => {
    setEditingId(item.id);
    setEditTitleText(item.title);
  };

  const handleSaveEditing = (id: string) => {
    if (editTitleText.trim()) {
      updateQueueItemTitle(id, editTitleText.trim());
      showToast('Label updated');
    }
    setEditingId(null);
  };

  const builderTotalSecs = inputHours * 3600 + inputMins * 60 + inputSecs;
  const builderDisplay = formatTime(builderTotalSecs > 0 ? builderTotalSecs : 600).text;

  const addTotalSecs = addHours * 3600 + addMins * 60 + addSecs;
  const addDisplay = `+${formatTime(addTotalSecs).text}`;

  const subTotalSecs = subHours * 3600 + subMins * 60 + subSecs;
  const subDisplay = `-${formatTime(subTotalSecs).text}`;

  const getStatusLabel = () => {
    if (state.isBlackout) return 'BLACKOUT';
    if (state.status === 'finished') {
      if (state.finishedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - state.finishedAt) / 1000));
        if (elapsed < 5) return 'TIME UP';
        if (elapsed < 10) return 'CONCLUDE NOW';
        return 'OVERTIME';
      }
      return 'TIME UP';
    }
    return state.status.toUpperCase();
  };

  const activeItem = activeIndex >= 0 ? queue[activeIndex] : null;

  const getLiveClockDisplay = () => {
    if (state.isBlackout) return 'BLACKOUT';
    if (state.status === 'finished') {
      if (state.finishedAt) {
        const elapsed = Math.max(0, Math.floor((now - state.finishedAt) / 1000));
        if (elapsed < 5) return 'TIME UP';
        if (elapsed < 10) return 'CONCLUDE NOW';
        const currentOvertime = elapsed + 1;
        if (currentOvertime >= 20 && (currentOvertime % 10 === 0 || currentOvertime % 10 === 1)) {
          return 'TIME UP';
        }
        return formatNegativeTime(currentOvertime).text;
      }
      return 'TIME UP';
    }
    return formatTime(state.remainingSeconds).text;
  };

  return (
    <div className="mobile-remote-viewport">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mobile-toast" role="status">
          <Sparkles size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="mobile-remote-topbar">
        <div className="topbar-branding">
          <Smartphone size={18} className="text-emerald" />
          <span className="brand-name">STAGE TIMER PRO</span>
          <span className="remote-pill">REMOTE</span>
        </div>

        <div className="topbar-controls">
          {/* Blackout Toggle */}
          <button
            type="button"
            className={`mobile-icon-btn ${state.isBlackout ? 'is-active-blackout' : ''}`}
            onClick={() => {
              toggleBlackout();
              showToast(state.isBlackout ? 'Screen unblanked' : 'Screen blacked out');
            }}
            title={state.isBlackout ? 'Unblank Stage Screen' : 'Blackout Stage Screen'}
          >
            {state.isBlackout ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>

          {/* Color Scheme Switcher */}
          <button
            type="button"
            className="mobile-icon-btn color-switch-btn"
            onClick={() => {
              const nextColor = state.colorScheme === 'white' ? 'blue' : 'white';
              setColorScheme(nextColor);
              showToast(`Color theme: ${nextColor.toUpperCase()}`);
            }}
            title={`Switch to ${state.colorScheme === 'white' ? 'Blue' : 'White'} color theme`}
          >
            <span className={`swatch-dot swatch-${state.colorScheme}`} />
          </button>

          {/* Desktop Switch */}
          {onSwitchToDesktop && (
            <button
              type="button"
              className="desktop-switch-btn"
              onClick={onSwitchToDesktop}
              title="Switch to full desktop control surface"
            >
              Desktop
            </button>
          )}
        </div>
      </header>

      {/* Network & Live Status Bar */}
      <div className="mobile-status-strip">
        <div className="status-strip-left">
          <span className={isWsConnected ? "pulse-dot-green" : "pulse-dot-amber"} />
          <span className="strip-text">
            {isWsConnected ? "STAGE MASTER CONNECTED" : "CONNECTING TO MASTER..."}
          </span>
        </div>
        <div className="status-strip-right">
          <span className={`status-pill chip-${state.status}`}>{getStatusLabel()}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="mobile-nav-tabs" aria-label="Sections">
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          <Tv size={15} />
          <span>Live & Controls</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <ListOrdered size={15} />
          <span>Queue ({queue.length}/5)</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          <Sliders size={15} />
          <span>Builder & Adjust</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          title="View all 3 sections in one view"
        >
          <Layers size={15} />
          <span>All</span>
        </button>
      </nav>

      {/* Scrollable Main Content */}
      <main className="mobile-content-area">
        {/* ======================================================== */}
        {/* SECTION 1: LIVE MASTER CLOCK & MASTER TRANSPORT CONTROLS */}
        {/* ======================================================== */}
        {(activeTab === 'live' || activeTab === 'all') && (
          <section className="mobile-section live-section">
            {/* Live Master Clock Card */}
            <div className="mobile-card live-master-clock-card">
              <div className="live-clock-meta-row">
                <div className="live-clock-tag">
                  {state.isBlackout ? (
                    <span className="tag-blackout">STAGE SCREEN BLACKED OUT</span>
                  ) : isAlertActive ? (
                    <span className="tag-upnext-pulse">▲ STAGE ALERT: {state.upNextAlertTitle} ({alertSecondsLeft}s)</span>
                  ) : activeItem && hasValidTimerLabel(activeItem.title) ? (
                    <span className="tag-active-item">#{activeIndex + 1} {activeItem.title}</span>
                  ) : (
                    <span className="tag-clock-status">LIVE STAGE COUNTDOWN</span>
                  )}
                </div>
                <span className={`status-pill chip-${state.status}`}>{getStatusLabel()}</span>
              </div>

              <div className="live-clock-digits-container">
                <div
                  className={`live-clock-digits ${
                    state.isBlackout
                      ? 'is-blackout'
                      : state.status === 'finished'
                      ? 'is-finished'
                      : state.colorScheme === 'blue'
                      ? 'is-blue'
                      : 'is-white'
                  }`}
                >
                  {getLiveClockDisplay()}
                </div>
              </div>
            </div>

            {/* Master Transport Controls */}
            <div className="mobile-card transport-card">
              <div className="mobile-transport-grid">
                {!isRunning ? (
                  <button
                    type="button"
                    className="mobile-btn btn-start-huge"
                    onClick={() => {
                      if (isPaused) resume();
                      else pushQueueToLive();
                      showToast(isPaused ? 'Resumed Live' : 'Started Live');
                    }}
                  >
                    <Play size={22} fill="currentColor" />
                    <span>{isPaused ? 'RESUME' : 'START LIVE'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mobile-btn btn-pause-huge"
                    onClick={() => {
                      pause();
                      showToast('Paused');
                    }}
                  >
                    <Pause size={22} fill="currentColor" />
                    <span>PAUSE</span>
                  </button>
                )}

                <div className="transport-sub-row">
                  <button
                    type="button"
                    className="mobile-btn btn-stop"
                    onClick={() => {
                      stop();
                      showToast('Timer Stopped');
                    }}
                    disabled={state.status === 'idle' && state.remainingSeconds === 0}
                  >
                    <Square size={16} fill="currentColor" />
                    <span>STOP</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-btn btn-reset"
                    onClick={() => {
                      reset();
                      showToast('Reset to Ready');
                    }}
                  >
                    <RotateCcw size={16} />
                    <span>RESET</span>
                  </button>
                </div>
              </div>
            </div>

            {/* UP NEXT Strip & Action */}
            {nextItem && (() => {
              const nextHasLabel = hasValidTimerLabel(nextItem.title);
              return (
                <div className="mobile-card next-up-card">
                  <div className="next-up-header">
                    <span className="next-badge">
                      {nextHasLabel ? '▲ UP NEXT' : 'NEXT IN QUEUE'}
                    </span>
                    <span className="next-title-text">
                      {nextHasLabel ? nextItem.title : '(Unlabeled timer)'}
                    </span>
                    <span className="next-duration-pill">
                      {formatTime(nextItem.totalSeconds).text}
                    </span>
                  </div>

                  <div className="next-actions-grid">
                    {nextHasLabel &&
                      (isAlertActive ? (
                        <button
                          type="button"
                          className="mobile-btn btn-alert-dismiss"
                          onClick={() => {
                            dismissUpNextAlert();
                            showToast('Alert Dismissed');
                          }}
                        >
                          <BellRing size={15} className="alert-pulse-icon" />
                          <span>Alerting ({alertSecondsLeft}s) · Dismiss</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mobile-btn btn-cue-alert"
                          onClick={() => {
                            triggerUpNextAlert(nextItem.title);
                            showToast(`Cued "${nextItem.title}" (5s alert)`);
                          }}
                        >
                          <Megaphone size={15} />
                          <span>Cue Up Next (5s)</span>
                        </button>
                      ))}

                    <button
                      type="button"
                      className="mobile-btn btn-load-ready"
                      onClick={() => {
                        loadNextInQueueToStage();
                        showToast(`Loaded "${nextItem.title || 'Next'}" in Ready mode`);
                      }}
                    >
                      <MonitorCheck size={15} />
                      <span>Load Ready</span>
                    </button>

                    <button
                      type="button"
                      className="mobile-btn btn-play-next"
                      onClick={() => {
                        playNextInQueue();
                        showToast(`Playing "${nextItem.title || 'Next'}"`);
                      }}
                    >
                      <FastForward size={15} />
                      <span>Play Next</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Stage Display Settings */}
            <div className="mobile-card settings-card">
              <span className="settings-label">AUTO UP NEXT STAGE ALERT:</span>
              <select
                className="mobile-select"
                value={state.upNextTriggerSeconds ?? 60}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setUpNextTriggerSeconds(val);
                  showToast(val > 0 ? `Alert at ${formatTime(val).text}` : 'Alerts Disabled');
                }}
              >
                <option value={120}>At 2:00 Remaining</option>
                <option value={90}>At 1:30 Remaining</option>
                <option value={60}>At 1:00 Remaining (Default)</option>
                <option value={45}>At 0:45 Remaining</option>
                <option value={30}>At 0:30 Remaining</option>
                <option value={0}>Disabled (Manual Only)</option>
              </select>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SECTION 2: THE 5-SLOT COUNTDOWN QUEUE                     */}
        {/* ======================================================== */}
        {(activeTab === 'queue' || activeTab === 'all') && (
          <section className="mobile-section queue-section">
            <div className="mobile-card queue-container-card">
              <div className="card-header-compact">
                <div className="header-left">
                  <ListOrdered size={16} className="text-emerald" />
                  <span className="card-badge">COUNTDOWN QUEUE</span>
                  <span className="queue-count-pill">{queue.length}/5 LOADED</span>
                </div>
                {queue.length > 0 && (
                  <button
                    type="button"
                    className="clear-queue-link"
                    onClick={() => {
                      clearQueue();
                      showToast('Queue cleared');
                    }}
                  >
                    Reset Queue
                  </button>
                )}
              </div>

              {/* Slots List */}
              <div className="mobile-slots-list">
                {Array.from({ length: 5 }).map((_, index) => {
                  const item = queue[index];
                  const slotNum = index + 1;

                  if (!item) {
                    return (
                      <div key={`empty-slot-${slotNum}`} className="mobile-slot-item is-empty">
                        <span className="slot-num">#{slotNum}</span>
                        <span className="slot-empty-label">Empty Slot</span>
                        <span className="slot-empty-tip">Use Builder or chips to fill</span>
                      </div>
                    );
                  }

                  const isActive = state.activeQueueItemId === item.id;
                  const isItemRunning = isActive && isRunning;
                  const isItemPaused = isActive && state.status === 'paused';
                  const isUpNext = !isActive && index === 0;
                  const hasLabel = hasValidTimerLabel(item.title);

                  return (
                    <div
                      key={item.id}
                      className={`mobile-slot-item ${isActive ? 'is-active-item' : ''}`}
                    >
                      {/* Top Row: Slot #, Title, and Status */}
                      <div className="slot-top-row">
                        <div className="slot-identity">
                          <span className={`slot-num ${isActive ? 'active-num' : ''}`}>
                            #{slotNum}
                          </span>

                          {editingId === item.id ? (
                            <div className="slot-inline-edit">
                              <input
                                type="text"
                                value={editTitleText}
                                onChange={(e) => setEditTitleText(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditing(item.id);
                                  else if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="inline-title-input"
                              />
                              <button
                                type="button"
                                className="inline-save-btn"
                                onClick={() => handleSaveEditing(item.id)}
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="slot-title-text"
                              onClick={() => handleStartEditing(item)}
                              title="Tap to edit title"
                            >
                              {hasLabel ? item.title : '(Tap to add title)'}
                              <Edit2 size={11} className="edit-hint-icon" />
                            </span>
                          )}
                        </div>

                        <div className="slot-time-badge">
                          {formatTime(item.totalSeconds).text}
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="slot-status-bar">
                        {isItemRunning ? (
                          <span className="tag-live">● LIVE ON STAGE</span>
                        ) : isItemPaused ? (
                          <span className="tag-paused">⏸ PAUSED</span>
                        ) : isUpNext ? (
                          <span className="tag-upnext">▲ UP NEXT</span>
                        ) : (
                          <span className="tag-queued">QUEUED</span>
                        )}
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="slot-actions-row">
                        <button
                          type="button"
                          className="slot-btn btn-play-slot"
                          onClick={() => {
                            playQueueItem(item.id);
                            showToast(`Playing #${slotNum}`);
                          }}
                          title="Start this timer immediately"
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Play</span>
                        </button>

                        <button
                          type="button"
                          className="slot-btn btn-load-slot"
                          onClick={() => {
                            loadQueueItemToStage(item.id);
                            showToast(`Loaded #${slotNum} (Ready)`);
                          }}
                          title="Load to stage in ready mode"
                        >
                          <MonitorCheck size={13} />
                          <span>Ready</span>
                        </button>

                        {hasLabel && (
                          <button
                            type="button"
                            className="slot-btn btn-cue-slot"
                            onClick={() => {
                              triggerUpNextAlert(item.title);
                              showToast(`Cued "${item.title}"`);
                            }}
                            title="Cue 5s alert on stage"
                          >
                            <Megaphone size={13} />
                            <span>Cue</span>
                          </button>
                        )}

                        {index > 0 && (
                          <button
                            type="button"
                            className="slot-btn btn-move"
                            onClick={() => reorderQueue(index, index - 1)}
                            title="Move up"
                          >
                            <ChevronUp size={14} />
                          </button>
                        )}

                        {index < queue.length - 1 && (
                          <button
                            type="button"
                            className="slot-btn btn-move"
                            onClick={() => reorderQueue(index, index + 1)}
                            title="Move down"
                          >
                            <ChevronDown size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="slot-btn btn-delete"
                          onClick={() => {
                            removeFromQueue(item.id);
                            showToast('Removed from queue');
                          }}
                          title="Delete from queue"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Add Chips */}
              <div className="queue-quick-chips">
                <span className="quick-chips-label">QUICK ADD TO QUEUE:</span>
                <div className="chips-row">
                  {[
                    { label: '+2m', m: 2 },
                    { label: '+5m', m: 5 },
                    { label: '+10m', m: 10 },
                    { label: '+15m', m: 15 },
                    { label: '+30m', m: 30 },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      className="quick-chip-btn"
                      onClick={() => {
                        const success = addToQueue(0, chip.m, 0);
                        if (success) showToast(`Added ${chip.label} to Queue`);
                        else showToast('Queue is full');
                      }}
                      disabled={queue.length >= 5}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SECTION 3: BUILDER & ADJUST TIME                         */}
        {/* ======================================================== */}
        {(activeTab === 'builder' || activeTab === 'all') && (
          <section className="mobile-section builder-section">
            {/* Timer Builder Card */}
            <div className="mobile-card builder-card">
              <div className="card-header-compact">
                <span className="card-badge">TIMER BUILDER & STAGER</span>
                <span className="card-subtext">Set duration & stage</span>
              </div>

              {/* Stepper Inputs for Hours, Minutes, Seconds */}
              <div className="mobile-stepper-grid">
                {/* Hours */}
                <div className="stepper-box">
                  <span className="stepper-label">HOURS</span>
                  <div className="stepper-controls">
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => {
                        const v = Math.max(0, inputHours - 1);
                        setInputHours(v);
                        queueTime(v, inputMins, inputSecs);
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={inputHours}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value) || 0);
                        setInputHours(v);
                        queueTime(v, inputMins, inputSecs);
                      }}
                      className="step-input"
                    />
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => {
                        const v = Math.min(99, inputHours + 1);
                        setInputHours(v);
                        queueTime(v, inputMins, inputSecs);
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Minutes */}
                <div className="stepper-box">
                  <span className="stepper-label">MINUTES</span>
                  <div className="stepper-controls">
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => {
                        const v = Math.max(0, inputMins - 1);
                        setInputMins(v);
                        queueTime(inputHours, v, inputSecs);
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={inputMins}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                        setInputMins(v);
                        queueTime(inputHours, v, inputSecs);
                      }}
                      className="step-input"
                    />
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => {
                        const v = Math.min(59, inputMins + 1);
                        setInputMins(v);
                        queueTime(inputHours, v, inputSecs);
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Seconds */}
                <div className="stepper-box">
                  <span className="stepper-label">SECONDS</span>
                  <div className="stepper-controls">
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => {
                        const v = Math.max(0, inputSecs - 5);
                        setInputSecs(v);
                        queueTime(inputHours, inputMins, v);
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={inputSecs}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                        setInputSecs(v);
                        queueTime(inputHours, inputMins, v);
                      }}
                      className="step-input"
                    />
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => {
                        const v = Math.min(59, inputSecs + 5);
                        setInputSecs(v);
                        queueTime(inputHours, inputMins, v);
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Title input */}
              <div className="mobile-input-field">
                <label>TIMER LABEL (OPTIONAL):</label>
                <input
                  type="text"
                  placeholder="e.g. Sermon, Offering, Announcements"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  maxLength={40}
                  className="mobile-text-input"
                />
              </div>

              {/* Presets Chips */}
              <div className="mobile-presets-block">
                <span className="presets-title">QUICK PRESETS:</span>
                <div className="chips-wrap">
                  {presets.map((p) => {
                    const isActive =
                      inputHours === p.h && inputMins === p.m && inputSecs === p.s;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        className={`preset-btn ${isActive ? 'is-active' : ''}`}
                        onClick={() => applyPreset(p.h, p.m, p.s)}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add to Queue Button */}
              <button
                type="button"
                className="mobile-btn btn-add-queue"
                onClick={() => handleAddToQueue()}
                disabled={queue.length >= 5 || builderTotalSecs <= 0}
              >
                <BookmarkPlus size={16} />
                <span>
                  {queue.length >= 5 ? 'QUEUE FULL (5/5)' : `+ ADD TO QUEUE (${queue.length}/5)`}
                </span>
              </button>

              {/* Direct Shoot Buttons */}
              <div className="direct-shoot-card">
                <div className="direct-info">
                  <span className="direct-label">DIRECT STAGE:</span>
                  <span className="direct-time">{builderDisplay}</span>
                </div>
                <div className="direct-buttons">
                  <button
                    type="button"
                    className="mobile-btn btn-direct-ready"
                    onClick={() => {
                      loadQueueToStage(inputHours, inputMins, inputSecs);
                      showToast(`Loaded ${builderDisplay} (Ready)`);
                    }}
                  >
                    <MonitorCheck size={14} />
                    <span>LOAD READY</span>
                  </button>
                  <button
                    type="button"
                    className="mobile-btn btn-direct-live"
                    onClick={() => {
                      pushQueueToLive();
                      showToast(`Started Live: ${builderDisplay}`);
                    }}
                  >
                    <Play size={14} fill="currentColor" />
                    <span>START LIVE</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Add / Subtract Live Time Card */}
            <div className="mobile-card adjust-card">
              <div className="adjust-segmented-control">
                <button
                  type="button"
                  className={`segment-btn ${adjustMode === 'add' ? 'active-add' : ''}`}
                  onClick={() => setAdjustMode('add')}
                >
                  <Plus size={15} />
                  <span>ADD TIME</span>
                </button>
                <button
                  type="button"
                  className={`segment-btn ${adjustMode === 'subtract' ? 'active-sub' : ''}`}
                  onClick={() => setAdjustMode('subtract')}
                >
                  <Minus size={15} />
                  <span>REMOVE TIME</span>
                </button>
              </div>

              {/* ADD MODE */}
              {adjustMode === 'add' ? (
                <div className="adjust-body">
                  <div className="quick-chips-row">
                    <button type="button" className="adjust-chip" onClick={() => { setAddHours(0); setAddMins(1); setAddSecs(0); }}>+1m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setAddHours(0); setAddMins(5); setAddSecs(0); }}>+5m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setAddHours(0); setAddMins(15); setAddSecs(0); }}>+15m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setAddHours(0); setAddMins(30); setAddSecs(0); }}>+30m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setAddHours(1); setAddMins(0); setAddSecs(0); }}>+1h</button>
                  </div>

                  <button
                    type="button"
                    className="mobile-btn btn-apply-add"
                    onClick={() => {
                      addTimeToLive(addHours, addMins, addSecs);
                      showToast(`Added ${addDisplay} to live clock`);
                    }}
                  >
                    <Plus size={16} />
                    <span>APPLY {addDisplay} TO LIVE</span>
                  </button>
                </div>
              ) : (
                /* SUBTRACT MODE */
                <div className="adjust-body">
                  <div className="quick-chips-row">
                    <button type="button" className="adjust-chip" onClick={() => { setSubHours(0); setSubMins(1); setSubSecs(0); }}>-1m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setSubHours(0); setSubMins(5); setSubSecs(0); }}>-5m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setSubHours(0); setSubMins(15); setSubSecs(0); }}>-15m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setSubHours(0); setSubMins(30); setSubSecs(0); }}>-30m</button>
                    <button type="button" className="adjust-chip" onClick={() => { setSubHours(1); setSubMins(0); setSubSecs(0); }}>-1h</button>
                  </div>

                  <button
                    type="button"
                    className="mobile-btn btn-apply-sub"
                    onClick={() => {
                      subtractTimeFromLive(subHours, subMins, subSecs);
                      showToast(`Removed ${subDisplay} from live clock`);
                    }}
                  >
                    <Minus size={16} />
                    <span>APPLY {subDisplay} TO LIVE</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
