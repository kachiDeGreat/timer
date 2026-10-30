import React, { useEffect, useState } from 'react';
import { TimerProvider, useTimer } from './context/TimerContext';
import { ControlSurface } from './components/ControlSurface';
import { ProjectorDisplay } from './components/ProjectorDisplay';
import { toggleFullScreen } from './utils/screen';
import './index.css';

const MainRouter: React.FC = () => {
  const { state } = useTimer();
  const [isProjectorView, setIsProjectorView] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
    const view = params.get('view') || hashParams.get('view');
    const autoFs = params.get('autoFullscreen') || hashParams.get('autoFullscreen');

    if (view === 'projector') {
      setIsProjectorView(true);
      document.title = 'Stage Display — StageTimer Pro';

      // If auto fullscreen requested, request on first user interaction or immediately if permitted
      if (autoFs === '1' || autoFs === 'true') {
        const tryFullscreen = async () => {
          try {
            await toggleFullScreen();
          } catch {
            // User gesture may be needed
          }
        };
        tryFullscreen();

        // Also add click listener to enter fullscreen on first click
        const onFirstClick = () => {
          toggleFullScreen();
          window.removeEventListener('click', onFirstClick);
        };
        window.addEventListener('click', onFirstClick, { once: true });
      }
    } else {
      setIsProjectorView(false);
      document.title = 'StageTimer Pro — Control Surface';
    }
  }, []);

  useEffect(() => {
    if (!isProjectorView) return;

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProjectorView]);

  if (isProjectorView) {
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

  return <ControlSurface />;
};

function App() {
  return (
    <TimerProvider>
      <MainRouter />
    </TimerProvider>
  );
}

export default App;
