import React, { useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { ProjectorDisplay } from './ProjectorDisplay';
import { launchProjectorWindow } from '../utils/screen';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Tv,
  Plus,
  Minus,
  MonitorCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

export const ControlSurface: React.FC = () => {
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
  } = useTimer();

  // Queue form inputs
  const [inputMins, setInputMins] = useState<number>(state.queuedMinutes || 10);
  const [inputSecs, setInputSecs] = useState<number>(state.queuedSeconds || 0);

  // Accordion state: 'add' | 'subtract'
  const [accordionMode, setAccordionMode] = useState<'add' | 'subtract'>('add');
  const [addMins, setAddMins] = useState<number>(2);
  const [addSecs, setAddSecs] = useState<number>(30);
  const [subMins, setSubMins] = useState<number>(1);
  const [subSecs, setSubSecs] = useState<number>(0);

  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';

  // Apply preset to queue
  const applyPreset = (minutes: number) => {
    setInputMins(minutes);
    setInputSecs(0);
    queueTime(minutes, 0);
  };

  // Submit queue form
  const handleQueueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    queueTime(inputMins, inputSecs);
  };

  // Quick chips for Add / Subtract
  const handleAddChip = (mins: number, secs: number) => {
    setAddMins(mins);
    setAddSecs(secs);
  };

  const handleSubChip = (mins: number, secs: number) => {
    setSubMins(mins);
    setSubSecs(secs);
  };

  const presets = [1, 2, 5, 10, 15, 20, 30, 45, 60];

  const queuedDisplay = `${String(state.queuedMinutes).padStart(2, '0')}:${String(state.queuedSeconds).padStart(2, '0')}`;
  const addDisplay = `+${String(addMins).padStart(2, '0')}:${String(addSecs).padStart(2, '0')}`;
  const subDisplay = `-${String(subMins).padStart(2, '0')}:${String(subSecs).padStart(2, '0')}`;

  return (
    <div className="surface-viewport">
      {/* Top Bar */}
      <header className="material-topbar">
        <div className="topbar-left">
          <span className="app-title">STAGE TIMER</span>
          <span className={`status-chip chip-${state.status}`}>
            {state.isBlackout ? 'BLACKOUT' : state.status.toUpperCase()}
          </span>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className={`material-btn ${state.isBlackout ? 'btn-blackout-active' : 'btn-secondary'}`}
            onClick={toggleBlackout}
            title={state.isBlackout ? 'Restore stage display' : 'Black out stage display (show nothing on TV)'}
            id="btn-toggle-blackout"
          >
            {state.isBlackout ? <Eye size={16} /> : <EyeOff size={16} />}
            <span>{state.isBlackout ? 'UNBLANK SCREEN' : 'BLACKOUT SCREEN'}</span>
          </button>

          <button
            type="button"
            className="material-btn btn-secondary"
            onClick={launchProjectorWindow}
            id="btn-launch-projector"
          >
            <Tv size={16} />
            <span>Open Projector Screen</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Fits cleanly on a single screen without scrolling */}
      <div className="surface-grid">
        {/* Left Column: Preview & Transport Controls */}
        <section className="preview-column">
          <div className="material-card preview-card">
            <div className="card-header">
              <span className="card-label">PROJECTOR PREVIEW</span>
              <span className="card-meta">
                {state.lastAction || 'Standard MM:SS'}
              </span>
            </div>

            <div className="preview-screen-box">
              <ProjectorDisplay
                state={state}
                isPreview={true}
                onPreviewClick={() => {
                  if (isRunning) pause();
                  else if (isPaused) resume();
                  else pushQueueToLive();
                }}
              />
            </div>
          </div>

          {/* Master Transport Controls */}
          <div className="material-card transport-card">
            <div className="transport-row">
              {!isRunning ? (
                <button
                  type="button"
                  className="material-btn btn-primary"
                  onClick={() => {
                    if (isPaused) resume();
                    else pushQueueToLive();
                  }}
                  id="btn-timer-run"
                >
                  <Play size={18} fill="currentColor" />
                  <span>{isPaused ? 'RESUME' : 'START'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="material-btn btn-warning"
                  onClick={pause}
                  id="btn-timer-pause"
                >
                  <Pause size={18} fill="currentColor" />
                  <span>PAUSE</span>
                </button>
              )}

              <button
                type="button"
                className="material-btn btn-neutral"
                onClick={stop}
                disabled={state.status === 'idle' && state.remainingSeconds === 0}
                id="btn-timer-stop"
              >
                <Square size={16} fill="currentColor" />
                <span>STOP</span>
              </button>

              <button
                type="button"
                className="material-btn btn-neutral"
                onClick={reset}
                id="btn-timer-reset"
              >
                <RotateCcw size={16} />
                <span>RESET</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Queue, Small Box & Add/Subtract Accordion */}
        <aside className="control-column">
          {/* Queue Time Card */}
          <div className="control-column">
            <div className="card-header">
              <span className="card-label">QUEUE TIME</span>
            </div>

            <form onSubmit={handleQueueSubmit} className="queue-form">
              <div className="time-input-pair">
                <div className="input-field">
                  <label htmlFor="input-minutes">MINUTES</label>
                  <input
                    id="input-minutes"
                    type="number"
                    min="0"
                    max="999"
                    value={inputMins}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      setInputMins(v);
                      queueTime(v, inputSecs);
                    }}
                  />
                </div>
                <span className="colon">:</span>
                <div className="input-field">
                  <label htmlFor="input-seconds">SECONDS</label>
                  <input
                    id="input-seconds"
                    type="number"
                    min="0"
                    max="59"
                    value={inputSecs}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      setInputSecs(v);
                      queueTime(inputMins, v);
                    }}
                  />
                </div>
              </div>
            </form>

            {/* Presets */}
            <div className="presets-block">
              <span className="sub-label">QUICK PRESETS</span>
              <div className="presets-row">
                {presets.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={`preset-chip ${state.queuedMinutes === mins && state.queuedSeconds === 0 ? 'active' : ''}`}
                    onClick={() => applyPreset(mins)}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* THE SMALL BOX FOR QUEUED TIME WITH LOAD TO STAGE AND START BUTTONS */}
            <div className="staged-small-box">
              <div className="small-box-info">
                <span className="small-box-label">STAGED DURATION</span>
                <span className="small-box-digits">{queuedDisplay}</span>
              </div>
              <div className="small-box-actions">
                <button
                  type="button"
                  className="small-box-action-btn btn-load-ready"
                  onClick={() => loadQueueToStage()}
                  title="Display this time on the stage screen in Ready state (waiting for speaker to start)"
                  id="btn-load-ready"
                >
                  <MonitorCheck size={14} />
                  <span>LOAD (READY)</span>
                </button>
                <button
                  type="button"
                  className="small-box-action-btn btn-start-live"
                  onClick={pushQueueToLive}
                  title="Immediately push to stage and begin countdown"
                  id="btn-play-queued"
                >
                  <Play size={14} fill="currentColor" />
                  <span>START</span>
                </button>
              </div>
            </div>
          </div>

          {/* Add / Subtract Accordion Card */}
          <div className="material-card accordion-card">
            <div className="accordion-tab-bar">
              <button
                type="button"
                className={`accordion-tab-btn ${accordionMode === 'add' ? 'active' : ''}`}
                onClick={() => setAccordionMode('add')}
              >
                <Plus size={14} />
                <span>ADD TIME</span>
              </button>

              <button
                type="button"
                className={`accordion-tab-btn ${accordionMode === 'subtract' ? 'active' : ''}`}
                onClick={() => setAccordionMode('subtract')}
              >
                <Minus size={14} />
                <span>REMOVE TIME</span>
              </button>
            </div>

            {/* ADD MODE CONTENT */}
            {accordionMode === 'add' && (
              <div className="accordion-content">
                <div className="time-input-pair compact">
                  <div className="input-field">
                    <label>MIN</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={addMins}
                      onChange={(e) => setAddMins(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <span className="colon">:</span>
                  <div className="input-field">
                    <label>SEC</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={addSecs}
                      onChange={(e) => setAddSecs(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>

                <div className="quick-chips-row">
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(0, 30)}>+30s</button>
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(1, 0)}>+1m</button>
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(2, 30)}>+2m 30s</button>
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(5, 0)}>+5m</button>
                </div>

                {/* SMALL BOX FOR ADD */}
                <div className="staged-small-box add-theme">
                  <div className="small-box-info">
                    <span className="small-box-label">ADD TO LIVE CLOCK</span>
                    <span className="small-box-digits">{addDisplay}</span>
                  </div>
                  <button
                    type="button"
                    className="small-box-play-btn add-btn"
                    onClick={() => addTimeToLive(addMins, addSecs)}
                    title="Add this duration to the active timer"
                    id="btn-play-add"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>APPLY</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUBTRACT MODE CONTENT */}
            {accordionMode === 'subtract' && (
              <div className="accordion-content">
                <div className="time-input-pair compact">
                  <div className="input-field">
                    <label>MIN</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={subMins}
                      onChange={(e) => setSubMins(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <span className="colon">:</span>
                  <div className="input-field">
                    <label>SEC</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={subSecs}
                      onChange={(e) => setSubSecs(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>

                <div className="quick-chips-row">
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(0, 30)}>-30s</button>
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(1, 0)}>-1m</button>
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(2, 0)}>-2m</button>
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(5, 0)}>-5m</button>
                </div>

                {/* SMALL BOX FOR SUBTRACT */}
                <div className="staged-small-box sub-theme">
                  <div className="small-box-info">
                    <span className="small-box-label">REMOVE FROM LIVE CLOCK</span>
                    <span className="small-box-digits">{subDisplay}</span>
                  </div>
                  <button
                    type="button"
                    className="small-box-play-btn sub-btn"
                    onClick={() => subtractTimeFromLive(subMins, subSecs)}
                    title="Subtract this duration from the active timer"
                    id="btn-play-subtract"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>APPLY</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Color Selection Card */}
          <div className="material-card">
            <div className="card-header">
              <span className="card-label">STAGE DISPLAY COLOR</span>
            </div>
            <div className="color-toggle-group">
              <button
                type="button"
                className={`color-toggle-btn ${state.colorScheme === 'white' ? 'active' : ''}`}
                onClick={() => setColorScheme('white')}
              >
                <span className="swatch-circle swatch-white" />
                <span>White Display</span>
              </button>

              <button
                type="button"
                className={`color-toggle-btn ${state.colorScheme === 'blue' ? 'active' : ''}`}
                onClick={() => setColorScheme('blue')}
              >
                <span className="swatch-circle swatch-blue" />
                <span>Blue Display</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
