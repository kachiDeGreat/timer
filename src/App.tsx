import React, { useEffect, useState } from 'react';
import { TimerProvider, useTimer } from './context/TimerContext';
import { ControlSurface } from './components/ControlSurface';
import { ProjectorDisplay } from './components/ProjectorDisplay';
import { MobileRemoteView } from './components/MobileRemoteView';
import { toggleFullScreen } from './utils/screen';
import './index.css';

const MainRouter: React.FC = () => {
  const { state } = useTimer();
  const [viewMode, setViewMode] = useState<'projector' | 'remote' | 'control'>('control');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
    const view = params.get('view') || hashParams.get('view');
    const autoFs = params.get('autoFullscreen') || hashParams.get('autoFullscreen');

    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      /Mobile|Android|iP(hone|od|ad)|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    const isRemotePort = window.location.port === '3456';
    const isElectron = Boolean(window.electronAPI?.isElectron);

    if (view === 'projector') {
      setViewMode('projector');
      document.title = 'Stage Display — StageTimer Pro';

      if (autoFs === '1' || autoFs === 'true') {
        const tryFullscreen = async () => {
          try {
            await toggleFullScreen();
          } catch {
            // User gesture may be needed
          }
        };
        tryFullscreen();

        const onFirstClick = () => {
          toggleFullScreen();
          window.removeEventListener('click', onFirstClick);
        };
        window.addEventListener('click', onFirstClick, { once: true });
      }
    } else if (view === 'control' || view === 'desktop') {
      setViewMode('control');
      document.title = 'StageTimer Pro — Control Surface';
    } else if (view === 'remote') {
      setViewMode('remote');
      document.title = 'Mobile Remote — StageTimer Pro';
    } else if (!isElectron && (isMobileDevice || isRemotePort)) {
      setViewMode('remote');
      document.title = 'Mobile Remote — StageTimer Pro';
    } else {
      setViewMode('control');
      document.title = 'StageTimer Pro — Control Surface';
    }
  }, []);

  useEffect(() => {
    if (viewMode !== 'projector') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape, Alt+F4, or Ctrl+W / Cmd+W closes the projector window
      if (
        e.key === 'Escape' ||
        (e.altKey && (e.key === 'F4' || e.key === 'f4')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W'))
      ) {
        e.preventDefault();
        if (window.electronAPI?.closeProjector) {
          window.electronAPI.closeProjector();
        } else {
          window.close();
        }
        return;
      }

      // F11 toggles fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        if (window.electronAPI?.toggleProjectorFullscreen) {
          window.electronAPI.toggleProjectorFullscreen();
        } else {
          toggleFullScreen();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  if (viewMode === 'projector') {
    return (
      <div
        className="projector-page-container"
        onDoubleClick={() => {
          if (window.electronAPI?.toggleProjectorFullscreen) {
            window.electronAPI.toggleProjectorFullscreen();
          } else {
            toggleFullScreen();
          }
        }}
        title="Stage Display Output (Double-click to toggle fullscreen, press Esc or Alt+F4 to close)"
      >
        <button
          type="button"
          className="projector-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (window.electronAPI?.closeProjector) {
              window.electronAPI.closeProjector();
            } else {
              window.close();
            }
          }}
          title="Close Stage Display (Escape / Alt+F4)"
        >
          ✕ Close Stage Display (Esc)
        </button>
        <ProjectorDisplay state={state} isPreview={false} />
      </div>
    );
  }

  if (viewMode === 'remote') {
    return <MobileRemoteView onSwitchToDesktop={() => setViewMode('control')} />;
  }

  return <ControlSurface onSwitchToRemote={() => setViewMode('remote')} />;
};

function App() {
  return (
    <TimerProvider>
      <MainRouter />
    </TimerProvider>
  );
}

export default App;
