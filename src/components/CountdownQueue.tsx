import React, { useState } from "react";
import { useTimer } from "../context/TimerContext";
import { formatTime } from "../utils/time";
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
    addToQueue,
    pause,
    resume,
  } = useTimer();

  const queue = state.timerQueue || [];
  const maxSlots = 5;
  const isRunning = state.status === "running";

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
    { label: "+2m", h: 0, m: 2, s: 0, title: "2m Countdown" },
    { label: "+5m", h: 0, m: 5, s: 0, title: "5m Countdown" },
    { label: "+10m", h: 0, m: 10, s: 0, title: "10m Countdown" },
    { label: "+15m", h: 0, m: 15, s: 0, title: "15m Countdown" },
    { label: "+30m", h: 0, m: 30, s: 0, title: "30m Countdown" },
  ];

  return (
    <div className="material-card countdown-queue-card">
      {/* Header */}
      <div className="card-header queue-header">
        <div className="queue-title-wrap">
          <ListOrdered size={16} className="header-icon" />
          <span className="card-label">COUNTDOWN QUEUE</span>
          <span
            className={`queue-badge ${queue.length >= maxSlots ? "is-full" : ""}`}
          >
            {queue.length} / {maxSlots} LOADED
          </span>
        </div>

        {queue.length > 0 && (
          <button
            type="button"
            className="queue-clear-btn"
            onClick={clearQueue}
            title="Clear all queued timers"
          >
            <RotateCcw size={12} />
            <span>Reset Queue</span>
          </button>
        )}
      </div>

      {/* The 5-Slot Queue List */}
      <div className="queue-slots-list">
        {Array.from({ length: maxSlots }).map((_, index) => {
          const item = queue[index];
          const slotNum = index + 1;

          if (!item) {
            // Empty Slot Placeholder
            return (
              <div
                key={`empty-slot-${slotNum}`}
                className="queue-slot-item is-empty"
              >
                <div className="slot-empty-left">
                  <span className="slot-num-badge">#{slotNum}</span>
                  <span className="slot-empty-text">Empty Slot</span>
                </div>
                <div className="slot-empty-actions">
                  <span className="slot-empty-hint">
                    Use Builder or chips below to fill
                  </span>
                </div>
              </div>
            );
          }

          const isActive = state.activeQueueItemId === item.id;
          const isItemRunning = isActive && isRunning;
          const isItemPaused = isActive && state.status === "paused";
          const isItemReady = isActive && state.status === "idle";
          const isItemFinished = isActive && state.status === "finished";

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
                      className="slot-title-display"
                      onClick={() => startEditing(item)}
                      title="Click to rename"
                    >
                      <span className="slot-title-text">{item.title}</span>
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
                  className={`slot-action-btn ${isItemRunning ? "btn-live-pulse" : "btn-queue-play"}`}
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

                {/* Load (Ready) Button */}
                <button
                  type="button"
                  className={`slot-action-btn btn-queue-load ${isItemReady ? "active-ready" : ""}`}
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
        })}
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
              onClick={() => addToQueue(chip.h, chip.m, chip.s, chip.title)}
              disabled={queue.length >= maxSlots}
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
