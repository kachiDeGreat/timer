import React from 'react';
import { useTimer } from '../context/TimerContext';
import { formatTime } from '../utils/time';
import {
  Printer,
  Download,
  Trash2,
  X,
  FileText,
  Clock,
  FolderOpen,
} from 'lucide-react';

interface TimingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TimingReportModal: React.FC<TimingReportModalProps> = ({ isOpen, onClose }) => {
  const { state, clearTimingReport } = useTimer();

  if (!isOpen) return null;

  const entries = state.timingReport || [];

  // Calculate statistics
  let totalPlannedSecs = 0;
  let totalSegments = 0;
  let totalOvertimeSecs = 0;

  entries.forEach((e) => {
    if (e.eventType === 'START') {
      totalSegments += 1;
      totalPlannedSecs += e.plannedDurationSeconds || 0;
    }
    if (e.overtimeSeconds && e.overtimeSeconds > 0) {
      totalOvertimeSecs += e.overtimeSeconds;
    }
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
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
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all timing report records for this event?')) {
      clearTimingReport();
    }
  };

  const handleOpenFolder = () => {
    if (window.electronAPI?.openTimingReportsFolder) {
      window.electronAPI.openTimingReportsFolder();
    } else {
      fetch('/api/timing-reports/open', { method: 'POST' }).catch(() => {});
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'START':
        return 'badge-event-start';
      case 'PAUSE':
        return 'badge-event-pause';
      case 'RESUME':
        return 'badge-event-resume';
      case 'STOP':
      case 'RESET':
        return 'badge-event-neutral';
      case 'ADD_TIME':
        return 'badge-event-add';
      case 'SUBTRACT_TIME':
        return 'badge-event-sub';
      case 'TIME_UP':
        return 'badge-event-timeup';
      case 'OVERTIME':
        return 'badge-event-overtime';
      case 'CONCLUDED':
        return 'badge-event-concluded';
      default:
        return 'badge-event-neutral';
    }
  };

  const eventDateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="modal-backdrop timing-report-backdrop" onClick={onClose}>
      <div
        className="modal-container timing-report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="report-modal-title"
      >
        {/* Printable Document Root */}
        <div className="printable-report-content">
          {/* Header */}
          <div className="report-modal-header">
            <div className="report-header-titles">
              <div className="report-logo-row">
                <FileText size={22} className="text-emerald" />
                <h2 id="report-modal-title" className="report-main-title">
                  StageTimer Pro — Event Timing Report
                </h2>
              </div>
              <div className="report-date-row">
                <span>{eventDateStr}</span>
                <span className="report-dot-sep">·</span>
                <span>Active Service Run Sheet</span>
                <span className="report-dot-sep">·</span>
                <span className="report-retention-pill">Saved to <code>timing_reports/</code> (30-day retention)</span>
              </div>
            </div>

            <div className="report-header-actions no-print">
              <button
                type="button"
                className="report-btn btn-open-folder"
                onClick={handleOpenFolder}
                title="Open timing_reports log folder on your computer"
              >
                <FolderOpen size={15} />
                <span>Reports Folder</span>
              </button>

              <button
                type="button"
                className="report-btn btn-print"
                onClick={handlePrint}
                title="Print clean report or save to PDF"
              >
                <Printer size={15} />
                <span>Print Report</span>
              </button>

              <button
                type="button"
                className="report-btn btn-export"
                onClick={handleExportCSV}
                title="Download CSV spreadsheet"
                disabled={entries.length === 0}
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                className="report-btn btn-clear-danger"
                onClick={handleClear}
                title="Clear timing records"
                disabled={entries.length === 0}
              >
                <Trash2 size={15} />
                <span>Clear</span>
              </button>

              <button
                type="button"
                className="report-close-btn"
                onClick={onClose}
                aria-label="Close report modal"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Statistics Summary Cards */}
          <div className="report-stats-grid">
            <div className="report-stat-card">
              <span className="stat-label">TOTAL SEGMENTS</span>
              <span className="stat-value">{totalSegments}</span>
            </div>
            <div className="report-stat-card">
              <span className="stat-label">TOTAL PLANNED TIME</span>
              <span className="stat-value">{formatTime(totalPlannedSecs).text}</span>
            </div>
            <div className="report-stat-card">
              <span className="stat-label">OVERTIME ACCRUED</span>
              <span className={`stat-value ${totalOvertimeSecs > 0 ? 'text-red' : ''}`}>
                {totalOvertimeSecs > 0 ? `+${formatTime(totalOvertimeSecs).text}` : '00:00 (On Time)'}
              </span>
            </div>
            <div className="report-stat-card">
              <span className="stat-label">AUDIT LOG ENTRIES</span>
              <span className="stat-value">{entries.length}</span>
            </div>
          </div>

          {/* Audit Trail Timeline Table */}
          <div className="report-table-wrapper">
            {entries.length === 0 ? (
              <div className="report-empty-state">
                <Clock size={36} className="text-muted" />
                <p className="empty-title">No timing events logged yet</p>
                <p className="empty-desc">
                  Events will automatically log here as you start, pause, add/remove time, or conclude timers.
                </p>
              </div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>TIME</th>
                    <th>EVENT</th>
                    <th>SEGMENT / LABEL</th>
                    <th>PLANNED DURATION</th>
                    <th>DETAILS / ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="cell-time">{entry.timeFormatted}</td>
                      <td className="cell-event">
                        <span className={`event-badge ${getEventBadgeClass(entry.eventType)}`}>
                          {entry.eventType}
                        </span>
                      </td>
                      <td className="cell-label">{entry.label || '—'}</td>
                      <td className="cell-planned">
                        {entry.plannedDurationSeconds > 0
                          ? formatTime(entry.plannedDurationSeconds).text
                          : '—'}
                      </td>
                      <td className="cell-notes">{entry.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Printable Footer */}
          <div className="report-print-footer">
            <span>Generated by StageTimer Pro · Confidential Event Audit Trail</span>
          </div>
        </div>
      </div>
    </div>
  );
};
