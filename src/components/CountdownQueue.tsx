import React, { useState } from "react";
import { useTimer } from "../context/TimerContext";
import { formatTime, hasValidTimerLabel } from "../utils/time";
import type { QueuedTimerItem } from "../types/timer";
import {
  Play,
  Pause,
  MonitorCheck,
  Trash2,
  ChevronUp,
  ChevronDown,
  ListOrdered,
  Plus,
  Edit2,
  Check,
  RotateCcw,
  Megaphone,
  Save,
  FolderOpen,
} from "lucide-react";

export const CountdownQueue: React.FC = () => {
  const {
    state,
    playQueueItem,
    loadQueueItemToStage,
    removeFromQueue,
    reorderQueue,
    updateQueueItemTitle,
    clearQueue,
    replaceQueue,
    addToQueue,
    pause,
    resume,
    triggerUpNextAlert,
  } = useTimer();

  const queue = state.timerQueue || [];
  const isRunning = state.status === "running";

  const activeIndex = queue.findIndex((item) => item.id === state.activeQueueItemId);
  const nextItemIndex =
    activeIndex >= 0 && activeIndex < queue.length - 1
      ? activeIndex + 1
      : queue.length > 0 && (activeIndex === -1 || queue.length > 1)
      ? (activeIndex === 0 ? 1 : 0)
      : queue.length === 1 && activeIndex === -1
      ? 0
      : -1;

  // Inline title editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState<string>("");

  const startEditing = (item: QueuedTimerItem) => {
    setEditingId(item.id);
    setEditTitleText(item.title);
  };

  const saveEditing = (id: string) => {
    if (editTitleText.trim()) {
      updateQueueItemTitle(id, editTitleText.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      saveEditing(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const quickAddChips = [
    { label: "+2m", h: 0, m: 2, s: 0 },
    { label: "+5m", h: 0, m: 5, s: 0 },
    { label: "+10m", h: 0, m: 10, s: 0 },
    { label: "+15m", h: 0, m: 15, s: 0 },
    { label: "+30m", h: 0, m: 30, s: 0 },
    { label: "+1h", h: 1, m: 0, s: 0 },
  ];

  // Manual Save Queue: opens desktop file manager or browser save dialog
  const handleSaveQueue = async () => {
    if (queue.length === 0) return;

    // 1. Electron Desktop Native Save Dialog
    if (window.electronAPI?.exportQueueDialog) {
      try {
        const res = await window.electronAPI.exportQueueDialog(queue);
        if (res?.success) {
          console.log(`Queue saved to: ${res.filePath}`);
        }
      } catch (err) {
        console.warn('Failed to export queue via Electron:', err);
      }
      return;
    }

    // 2. Modern Web File System Access API (Native desktop file picker)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'stagetimer-queue.json',
          types: [
            {
              description: 'StageTimer Queue Playlist (*.json)',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(queue, null, 2));
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('showSaveFilePicker error, falling back:', err);
      }
    }

    // 3. Fallback browser download trigger
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stagetimer-queue.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Manual Load Queue: opens desktop file manager or browser file picker
  const handleLoadQueue = async () => {
    // 1. Electron Native Open Dialog
    if (window.electronAPI?.importQueueDialog) {
      try {
        const res = await window.electronAPI.importQueueDialog();
        if (res?.success && Array.isArray(res.queue)) {
          replaceQueue(res.queue);
        }
      } catch (err) {
        console.warn('Failed to import queue via Electron:', err);
      }
      return;
    }

    // 2. Web Browser File Input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target?.result as string);
            const list = Array.isArray(parsed) ? parsed : (parsed.timerQueue || []);
            if (Array.isArray(list)) {
              replaceQueue(list);
            }
          } catch (err) {
            alert('Invalid queue JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="material-card countdown-queue-card">
      {/* Header */}
      <div className="card-header queue-header">
        <div className="queue-title-wrap">
          <ListOrdered size={16} className="header-icon" />
          <span className="card-label">COUNTDOWN PLAYLIST QUEUE</span>
          <span className="queue-badge">
            {queue.length} {queue.length === 1 ? "TIMER" : "TIMERS"}
          </span>
        </div>

        <div className="queue-header-actions">
          {queue.length > 0 && (
            <button
              type="button"
              className="queue-tool-btn save-btn"
              onClick={handleSaveQueue}
              title="Save Queue file to your computer (Choose folder in file manager)"
            >
              <Save size={13} />
              <span>Save Queue</span>
            </button>
          )}

          <button
            type="button"
            className="queue-tool-btn load-btn"
            onClick={handleLoadQueue}
            title="Open / Import queue playlist from file"
          >
            <FolderOpen size={13} />
            <span>Load Queue</span>
          </button>

          {queue.length > 0 && (
            <button
              type="button"
              className="queue-clear-btn"
              onClick={clearQueue}
              title="Clear all queued timers"
            >
              <RotateCcw size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Queue List (Unlimited Items) */}
      <div className="queue-slots-list">
        {queue.length === 0 ? (
          <div className="queue-slot-item is-empty queue-empty-state">
            <div className="slot-empty-left">
              <div className="slot-empty-text-group">
                <span className="slot-empty-title">Queue is empty</span>
                <span className="slot-empty-hint">
                  Add countdowns from Builder or 1-tap quick chips below. Unlimited queues supported.
                </span>
              </div>
            </div>
          </div>
        ) : (
          queue.map((item, index) => {
            const slotNum = index + 1;
            const isActive = state.activeQueueItemId === item.id;
            const isItemRunning = isActive && isRunning;
            const isItemPaused = isActive && state.status === "paused";
            const isItemReady = isActive && state.status === "idle";
            const isItemFinished = isActive && state.status === "finished";

            const hasLabel = hasValidTimerLabel(item.title);
            const isUpNext = !isActive && index === nextItemIndex;

            let statusClass = "status-queued";
            let statusText = "QUEUED";
            if (isItemRunning) {
              statusClass = "status-live";
              statusText = "LIVE ON STAGE";
            } else if (isItemPaused) {
              statusClass = "status-paused";
              statusText = "PAUSED";
            } else if (isItemReady) {
              statusClass = "status-ready";
              statusText = "READY ON STAGE";
            } else if (isItemFinished) {
              statusClass = "status-finished";
              statusText = "TIME UP";
            } else if (isUpNext && hasLabel) {
              statusClass = "status-upnext";
              statusText = "UP NEXT";
            }

            const isEditingThis = editingId === item.id;

            return (
              <div
                key={item.id}
                className={`queue-slot-item ${isActive ? "is-active-slot" : ""} ${
                  isItemRunning ? "is-live-slot" : ""
                }`}
              >
                {/* Left Column: Number, Title, Digits */}
                <div className="slot-info-col">
                  <div className="slot-top-row">
                    <span className="slot-num-badge">#{slotNum}</span>
                    <span className={`slot-status-pill ${statusClass}`}>
                      {isItemRunning && <span className="pulse-dot" />}
                      {statusText}
                    </span>

                    {/* Reorder Buttons */}
                    <div className="slot-reorder-group">
                      <button
                        type="button"
                        className="slot-reorder-btn"
                        onClick={() => reorderQueue(index, index - 1)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="slot-reorder-btn"
                        onClick={() => reorderQueue(index, index + 1)}
                        disabled={index === queue.length - 1}
                        title="Move down"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="slot-bottom-row">
                    {isEditingThis ? (
                      <div className="slot-title-edit-wrap">
                        <input
                          type="text"
                          className="slot-title-input"
                          placeholder="e.g. Sermon, Offering..."
                          value={editTitleText}
                          onChange={(e) => setEditTitleText(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="slot-save-btn"
                          onClick={() => saveEditing(item.id)}
                          title="Save title"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`slot-title-display ${!hasLabel ? "is-unlabeled" : ""}`}
                        onClick={() => startEditing(item)}
                        title={
                          hasLabel
                            ? "Click to rename"
                            : "Click to add label (required for Up Next cues)"
                        }
                      >
                        <span className="slot-title-text">
                          {hasLabel ? item.title : "(Click to add label)"}
                        </span>
                        <Edit2 size={11} className="slot-edit-icon" />
                      </div>
                    )}

                    <span className="slot-duration-digits">
                      {formatTime(item.totalSeconds).text}
                    </span>
                  </div>
                </div>

                {/* Right Column: Actions (Play, Load Ready, Delete) */}
                <div className="slot-actions-col">
                  {/* Direct Play / Pause / Start Button */}
                  <button
                    type="button"
                    className={`slot-action-btn ${
                      isItemRunning ? "btn-live-pulse" : "btn-queue-play"
                    }`}
                    onClick={() => {
                      if (isItemRunning) {
                        pause();
                      } else if (isItemPaused) {
                        resume();
                      } else {
                        playQueueItem(item.id);
                      }
                    }}
                    title={
                      isItemRunning
                        ? "Click to pause active timer"
                        : isItemPaused
                        ? "Click to resume active timer"
                        : "Push directly to projector screen and START countdown now"
                    }
                    id={`btn-play-slot-${slotNum}`}
                  >
                    {isItemRunning ? (
                      <>
                        <Pause size={13} fill="currentColor" />
                        <span>PAUSE</span>
                      </>
                    ) : isItemPaused ? (
                      <>
                        <Play size={13} fill="currentColor" />
                        <span>RESUME</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} fill="currentColor" />
                        <span>PLAY</span>
                      </>
                    )}
                  </button>

                  {/* Direct Cue Button for Up Next Slot - ONLY IF IT HAS A VALID TIMER LABEL */}
                  {isUpNext && hasLabel && (
                    <button
                      type="button"
                      className="slot-action-btn btn-queue-cue"
                      onClick={() => triggerUpNextAlert(item.title)}
                      title={`Flash 'UP NEXT: ${item.title}' red drift animation on stage for 5s`}
                      id={`btn-cue-slot-${slotNum}`}
                    >
                      <Megaphone size={12} />
                      <span>CUE</span>
                    </button>
                  )}

                  {/* Load (Ready) Button */}
                  <button
                    type="button"
                    className={`slot-action-btn btn-queue-load ${
                      isItemReady ? "active-ready" : ""
                    }`}
                    onClick={() => loadQueueItemToStage(item.id)}
                    title="Load this timer to stage in READY mode (standby, waiting for speaker)"
                    id={`btn-load-slot-${slotNum}`}
                  >
                    <MonitorCheck size={13} />
                    <span>LOAD</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    className="slot-delete-btn"
                    onClick={() => removeFromQueue(item.id)}
                    title="Remove from queue"
                    id={`btn-delete-slot-${slotNum}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Add Chips Footer */}
      <div className="queue-quick-add-footer">
        <span className="quick-add-label">QUICK ADD TO QUEUE:</span>
        <div className="quick-add-chips">
          {quickAddChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="quick-chip-pill"
              onClick={() => addToQueue(chip.h, chip.m, chip.s, "")}
              title={`Add ${chip.label} countdown to queue`}
            >
              <Plus size={11} />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
