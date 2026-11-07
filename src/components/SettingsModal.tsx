import React, { useState, useEffect } from 'react';
import { useTimer } from '../context/TimerContext';
import {
  STAGE_COLOR_PRESETS,
  resolveStageColor,
} from '../types/timer';
import {
  Settings,
  X,
  Clock,
  PlayCircle,
  Megaphone,
  Palette,
  Check,
  RotateCcw,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    setIdleDisplayMode,
    setClockFormat24,
    setAutoAdvanceMode,
    setUpNextTriggerSeconds,
    setColorScheme,
  } = useTimer();

  const activeColorHex = resolveStageColor(state.colorScheme);
  const [customHexInput, setCustomHexInput] = useState<string>(activeColorHex);

  // Sync custom hex input when state color changes externally
  useEffect(() => {
    setCustomHexInput(activeColorHex);
  }, [activeColorHex]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCustomHexChange = (val: string) => {
    setCustomHexInput(val);
    const trimmed = val.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
      setColorScheme(trimmed);
    }
  };

  const handleResetDefaults = () => {
    setIdleDisplayMode('zero');
    setClockFormat24(false);
    setAutoAdvanceMode('manual');
    setUpNextTriggerSeconds(60);
    setColorScheme('#ffffff');
    setCustomHexInput('#ffffff');
  };

  const alertTriggerOptions = [
    { value: 120, label: '2:00' },
    { value: 90, label: '1:30' },
    { value: 60, label: '1:00 (Recommended)' },
    { value: 45, label: '0:45' },
    { value: 30, label: '0:30' },
    { value: 0, label: 'Disabled' },
  ];

  return (
    <div className="modal-backdrop settings-modal-backdrop" onClick={onClose}>
      <div
        className="modal-container settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        {/* HEADER */}
        <div className="settings-header">
          <div className="settings-header-left">
            <div className="settings-icon-badge">
              <Settings size={18} />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="settings-title">
                Settings
              </h2>
              <p className="settings-subtitle">
                Stage display colors, idle screen, and playlist automation
              </p>
            </div>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close settings dialog"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="settings-scroll-body">
          {/* SECTION 1: TIMER DIGIT COLOR CUSTOMIZATION */}
          <section className="settings-card">
            <div className="card-header-row">
              <div className="card-header-title">
                <Palette size={16} />
                <h3>Stage Digit Color</h3>
              </div>
            </div>
            <p className="card-instruction">
              Choose the color used for countdown digits and clock display on the stage screens.
            </p>

            {/* Presets Grid */}
            <div className="color-presets-grid">
              {STAGE_COLOR_PRESETS.map((preset) => {
                const isSelected = activeColorHex.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`color-preset-card ${isSelected ? 'is-active' : ''}`}
                    onClick={() => {
                      setColorScheme(preset.hex);
                      setCustomHexInput(preset.hex);
                    }}
                    title={`${preset.name} (${preset.hex})`}
                  >
                    <span
                      className="preset-swatch-circle"
                      style={{ background: preset.hex }}
                    >
                      {isSelected && <Check size={13} className="swatch-check" />}
                    </span>
                    <span className="preset-name">{preset.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Color Picker */}
            <div className="custom-color-bar">
              <span className="custom-color-label">Custom Hex:</span>
              <div className="custom-color-controls">
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    className="native-color-picker"
                    value={activeColorHex}
                    onChange={(e) => {
                      setColorScheme(e.target.value);
                      setCustomHexInput(e.target.value);
                    }}
                    title="Click to pick custom color"
                  />
                  <span className="color-preview-box" style={{ background: activeColorHex }} />
                </div>
                <input
                  type="text"
                  className="hex-text-input"
                  value={customHexInput}
                  onChange={(e) => handleCustomHexChange(e.target.value)}
                  placeholder="#FFFFFF"
                  maxLength={7}
                  spellCheck={false}
                />
              </div>
            </div>
          </section>

          {/* SECTION 2: DEFAULT IDLE SCREEN DISPLAY */}
          <section className="settings-card">
            <div className="card-header-row">
              <div className="card-header-title">
                <Clock size={16} />
                <h3>Default Idle Screen</h3>
              </div>
            </div>
            <p className="card-instruction">
              Display on the stage screen when no countdown is running or screen is unblanked.
            </p>

            <div className="selection-cards-grid">
              {/* Option A: 00:00 */}
              <label
                className={`choice-card ${state.idleDisplayMode === 'zero' ? 'is-selected' : ''}`}
                onClick={() => setIdleDisplayMode('zero')}
              >
                <input
                  type="radio"
                  name="idleDisplayMode"
                  checked={state.idleDisplayMode === 'zero'}
                  onChange={() => setIdleDisplayMode('zero')}
                />
                <div className="choice-content">
                  <div className="choice-header">
                    <span className="choice-title">00:00 (Digital Zero)</span>
                    {state.idleDisplayMode === 'zero' && (
                      <span className="choice-badge-check">
                        <Check size={12} /> Active
                      </span>
                    )}
                  </div>
                  <p className="choice-desc">
                    Default stage zero digits. Clean 00:00 waiting for operator to stage or start.
                  </p>
                </div>
              </label>

              {/* Option B: Device Clock */}
              <label
                className={`choice-card ${state.idleDisplayMode === 'clock' ? 'is-selected' : ''}`}
                onClick={() => setIdleDisplayMode('clock')}
              >
                <input
                  type="radio"
                  name="idleDisplayMode"
                  checked={state.idleDisplayMode === 'clock'}
                  onChange={() => setIdleDisplayMode('clock')}
                />
                <div className="choice-content">
                  <div className="choice-header">
                    <span className="choice-title">Device Clock (Time of Day)</span>
                    {state.idleDisplayMode === 'clock' && (
                      <span className="choice-badge-check">
                        <Check size={12} /> Active
                      </span>
                    )}
                  </div>
                  <p className="choice-desc">
                    Displays current wall clock time (HH:MM without seconds) until a countdown starts.
                  </p>
                </div>
              </label>
            </div>

            {/* Sub-setting: Clock Format (12h vs 24h) */}
            {state.idleDisplayMode === 'clock' && (
              <div className="sub-settings-panel">
                <span className="sub-settings-label">Format:</span>
                <div className="segmented-toggle">
                  <button
                    type="button"
                    className={`segment-btn ${!state.clockFormat24 ? 'is-active' : ''}`}
                    onClick={() => setClockFormat24(false)}
                  >
                    12-Hour (AM/PM)
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${state.clockFormat24 ? 'is-active' : ''}`}
                    onClick={() => setClockFormat24(true)}
                  >
                    24-Hour
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 3: QUEUE TRANSITION BEHAVIOR */}
          <section className="settings-card">
            <div className="card-header-row">
              <div className="card-header-title">
                <PlayCircle size={16} />
                <h3>Queue Transition Behavior</h3>
              </div>
            </div>
            <p className="card-instruction">
              Action taken when an active countdown completes and items exist in the queue.
            </p>

            <div className="selection-cards-grid">
              {/* Auto Start */}
              <label
                className={`choice-card ${state.autoAdvanceMode === 'auto-start' ? 'is-selected' : ''}`}
                onClick={() => setAutoAdvanceMode('auto-start')}
              >
                <input
                  type="radio"
                  name="autoAdvanceMode"
                  checked={state.autoAdvanceMode === 'auto-start'}
                  onChange={() => setAutoAdvanceMode('auto-start')}
                />
                <div className="choice-content">
                  <div className="choice-header">
                    <span className="choice-title">Auto Start Next (No Overtime)</span>
                    {state.autoAdvanceMode === 'auto-start' && (
                      <span className="choice-badge-check">
                        <Check size={12} /> Active
                      </span>
                    )}
                  </div>
                  <p className="choice-desc">
                    Shows "TIME UP" (5s) and "PLEASE CONCLUDE NOW" (5s), then immediately starts the next queued item.
                  </p>
                </div>
              </label>

              {/* Auto Load */}
              <label
                className={`choice-card ${
                  state.autoAdvanceMode === 'auto-load' || (state.autoAdvanceMode as string) === 'auto-ready'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() => setAutoAdvanceMode('auto-load')}
              >
                <input
                  type="radio"
                  name="autoAdvanceMode"
                  checked={
                    state.autoAdvanceMode === 'auto-load' ||
                    (state.autoAdvanceMode as string) === 'auto-ready'
                  }
                  onChange={() => setAutoAdvanceMode('auto-load')}
                />
                <div className="choice-content">
                  <div className="choice-header">
                    <span className="choice-title">Auto Load Next (Ready Mode)</span>
                    {(state.autoAdvanceMode === 'auto-load' ||
                      (state.autoAdvanceMode as string) === 'auto-ready') && (
                      <span className="choice-badge-check">
                        <Check size={12} /> Active
                      </span>
                    )}
                  </div>
                  <p className="choice-desc">
                    Shows conclusion alert, then stages next item in Ready mode. Operator clicks Start.
                  </p>
                </div>
              </label>

              {/* Manual Operation */}
              <label
                className={`choice-card ${state.autoAdvanceMode === 'manual' ? 'is-selected' : ''}`}
                onClick={() => setAutoAdvanceMode('manual')}
              >
                <input
                  type="radio"
                  name="autoAdvanceMode"
                  checked={state.autoAdvanceMode === 'manual'}
                  onChange={() => setAutoAdvanceMode('manual')}
                />
                <div className="choice-content">
                  <div className="choice-header">
                    <span className="choice-title">Manual Operation (Standard Overtime)</span>
                    {state.autoAdvanceMode === 'manual' && (
                      <span className="choice-badge-check">
                        <Check size={12} /> Active
                      </span>
                    )}
                  </div>
                  <p className="choice-desc">
                    Shows conclusion alerts, then counts overtime in minus indefinitely until operator stops or resets.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* SECTION 4: UP NEXT STAGE ALERT */}
          <section className="settings-card">
            <div className="card-header-row">
              <div className="card-header-title">
                <Megaphone size={16} />
                <h3>Up Next Stage Alert</h3>
              </div>
            </div>
            <p className="card-instruction">
              Remaining time at which the 5-second Canva drift alert appears on stage before a timer expires.
            </p>

            <div className="trigger-pills-grid">
              {alertTriggerOptions.map((opt) => {
                const isSelected = (state.upNextTriggerSeconds ?? 60) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`trigger-pill ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setUpNextTriggerSeconds(opt.value)}
                  >
                    {isSelected && <Check size={12} className="pill-check-icon" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div className="settings-footer">
          <button
            type="button"
            className="settings-reset-btn"
            onClick={handleResetDefaults}
            title="Reset all settings to factory defaults"
          >
            <RotateCcw size={14} />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            className="settings-done-btn"
            onClick={onClose}
            title="Save and close settings"
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
