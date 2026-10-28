import React, { useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { ProjectorDisplay } from './ProjectorDisplay';
import { launchProjectorWindow } from '../utils/screen';
import { formatTime } from '../utils/time';
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

  // Queue form inputs: Hours, Minutes, Seconds
  const [inputHours, setInputHours] = useState<number>(state.queuedHours || 0);
  const [inputMins, setInputMins] = useState<number>(state.queuedMinutes || 10);
  const [inputSecs, setInputSecs] = useState<number>(state.queuedSeconds || 0);

  // Accordion state: 'add' | 'subtract'
  const [accordionMode, setAccordionMode] = useState<'add' | 'subtract'>('add');
  const [addHours, setAddHours] = useState<number>(0);
  const [addMins, setAddMins] = useState<number>(2);
  const [addSecs, setAddSecs] = useState<number>(30);

  const [subHours, setSubHours] = useState<number>(0);
  const [subMins, setSubMins] = useState<number>(1);
  const [subSecs, setSubSecs] = useState<number>(0);

  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';

  // Apply preset to queue
  const applyPreset = (h: number, m: number, s: number) => {
    setInputHours(h);
    setInputMins(m);
    setInputSecs(s);
    queueTime(h, m, s);
  };

  // Submit queue form
  const handleQueueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    queueTime(inputHours, inputMins, inputSecs);
  };

  // Quick chips for Add / Subtract
  const handleAddChip = (h: number, m: number, s: number) => {
    setAddHours(h);
    setAddMins(m);
    setAddSecs(s);
  };

  const handleSubChip = (h: number, m: number, s: number) => {
    setSubHours(h);
    setSubMins(m);
    setSubSecs(s);
  };

  // Presets including minute and hour options
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

  // Calculate formatted display strings: MM:SS under 60m, HH:MM:SS for 1h+
  const queuedTotalSecs = (state.queuedHours || 0) * 3600 + (state.queuedMinutes || 0) * 60 + (state.queuedSeconds || 0);
  const queuedDisplay = formatTime(queuedTotalSecs).text;

  const addTotalSecs = addHours * 3600 + addMins * 60 + addSecs;
  const addDisplay = `+${formatTime(addTotalSecs).text}`;

  const subTotalSecs = subHours * 3600 + subMins * 60 + subSecs;
  const subDisplay = `-${formatTime(subTotalSecs).text}`;

  // Periodic re-render during finished phase so status chip and preview meta update in real time
  const [, setTick] = useState(0);
  React.useEffect(() => {
    if (state.status !== 'finished') return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 500);
    return () => clearInterval(interval);
  }, [state.status]);

  const getStatusLabel = () => {
    if (state.isBlackout) return 'BLACKOUT';
    if (state.status === 'finished') {
      if (state.finishedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - state.finishedAt) / 1000));
        if (elapsed < 5) return 'TIME UP';
        if (elapsed < 10) return 'CONCLUDE NOW';
        const currentOvertime = elapsed + 1;
        if (currentOvertime >= 20 && (currentOvertime % 10 === 0 || currentOvertime % 10 === 1)) {
          return 'TIME UP';
        }
        return 'OVERTIME';
      }
      return 'TIME UP';
    }
    return state.status.toUpperCase();
  };

  const getPreviewMeta = () => {
    if (state.isBlackout) return 'Stage Screen Blackout (Display Blank)';
    if (state.status === 'finished' && state.finishedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - state.finishedAt) / 1000));
      if (elapsed < 5) return 'Stage: TIME UP (5s Alert)';
      if (elapsed < 10) return 'Stage: PLEASE CONCLUDE NOW (5s Alert)';
      const currentOvertime = elapsed + 1;
      if (currentOvertime >= 20 && (currentOvertime % 10 === 0 || currentOvertime % 10 === 1)) {
        return 'Stage: TIME UP (10s Periodic Alert)';
      }
      return `Stage: Overtime Count-Up (-${formatTime(currentOvertime).text})`;
    }
    return state.lastAction || 'Standard Time Display';
  };


  return (
    <div className="surface-viewport">
      {/* Top Bar */}
      <header className="material-topbar">
        <div className="topbar-left">
          <span className="app-title">STAGE TIMER</span>
          <span className={`status-chip chip-${state.status}`}>
            {getStatusLabel()}
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
                {getPreviewMeta()}
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
          {/* Queue Time Card (with Hours : Minutes : Seconds) */}
          <div className="material-card">
            <div className="card-header">
              <span className="card-label">QUEUE TIME (HH:MM:SS)</span>
            </div>

            <form onSubmit={handleQueueSubmit} className="queue-form">
              <div className="time-input-pair three-fields">
                <div className="input-field">
                  <label htmlFor="input-hours">HOURS</label>
                  <input
                    id="input-hours"
                    type="number"
                    min="0"
                    max="99"
                    value={inputHours}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      setInputHours(v);
                      queueTime(v, inputMins, inputSecs);
                    }}
                  />
                </div>
                <span className="colon">:</span>
                <div className="input-field">
                  <label htmlFor="input-minutes">MINUTES</label>
                  <input
                    id="input-minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={inputMins}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      setInputMins(v);
                      queueTime(inputHours, v, inputSecs);
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
                      queueTime(inputHours, inputMins, v);
                    }}
                  />
                </div>
              </div>
            </form>

            {/* Presets */}
            <div className="presets-block">
              <span className="sub-label">QUICK PRESETS</span>
              <div className="presets-row">
                {presets.map((p) => {
                  const isActive =
                    (state.queuedHours || 0) === p.h &&
                    state.queuedMinutes === p.m &&
                    state.queuedSeconds === p.s;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className={`preset-chip ${isActive ? 'active' : ''}`}
                      onClick={() => applyPreset(p.h, p.m, p.s)}
                    >
                      {p.label}
                    </button>
                  );
                })}
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
                  onClick={() => loadQueueToStage(inputHours, inputMins, inputSecs)}
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
                <div className="time-input-pair compact three-fields">
                  <div className="input-field">
                    <label>HRS</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={addHours}
                      onChange={(e) => setAddHours(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <span className="colon">:</span>
                  <div className="input-field">
                    <label>MIN</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={addMins}
                      onChange={(e) => setAddMins(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
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
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(0, 1, 0)}>+1m</button>
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(0, 5, 0)}>+5m</button>
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(0, 15, 0)}>+15m</button>
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(0, 30, 0)}>+30m</button>
                  <button type="button" className="chip-btn" onClick={() => handleAddChip(1, 0, 0)}>+1h</button>
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
                    onClick={() => addTimeToLive(addHours, addMins, addSecs)}
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
                <div className="time-input-pair compact three-fields">
                  <div className="input-field">
                    <label>HRS</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={subHours}
                      onChange={(e) => setSubHours(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <span className="colon">:</span>
                  <div className="input-field">
                    <label>MIN</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={subMins}
                      onChange={(e) => setSubMins(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
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
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(0, 1, 0)}>-1m</button>
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(0, 5, 0)}>-5m</button>
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(0, 15, 0)}>-15m</button>
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(0, 30, 0)}>-30m</button>
                  <button type="button" className="chip-btn" onClick={() => handleSubChip(1, 0, 0)}>-1h</button>
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
                    onClick={() => subtractTimeFromLive(subHours, subMins, subSecs)}
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
