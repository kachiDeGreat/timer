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
    const view = params.get('view');
    const autoFs = params.get('autoFullscreen');

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

  if (isProjectorView) {
    return (
      <div className="projector-page-container">
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
