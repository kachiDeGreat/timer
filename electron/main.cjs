const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const remoteServer = require('./remoteServer.cjs');

// Linux environment integration
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow = null;
let projectorWindow = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function findExternalDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const found = displays.find((d) => d.id !== primary.id);
  if (found) return found;

  // Linux fallback: parse xrandr to guarantee connected HDMI monitor is never missed
  if (process.platform === 'linux') {
    try {
      const { execSync } = require('child_process');
      const out = execSync('xrandr --listmonitors', { encoding: 'utf8' });
      const lines = out.split('\n').filter((l) => l.trim().match(/^\d+:/));
      if (lines.length > 1) {
        for (const line of lines) {
          if (!line.includes('*')) {
            const match = line.match(/\s*(\d+):\s*\+([^\s]+)\s+(\d+)\/\d+x(\d+)\/\d+\+(\d+)\+(\d+)/);
            if (match) {
              const [_, _idx, name, w, h, x, y] = match;
              const scale = primary.scaleFactor || 1;
              return {
                id: 9999,
                label: name,
                bounds: {
                  x: Math.round(parseInt(x, 10) / scale),
                  y: Math.round(parseInt(y, 10) / scale),
                  width: Math.round(parseInt(w, 10) / scale),
                  height: Math.round(parseInt(h, 10) / scale),
                },
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function getDisplaysPayload() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const external = findExternalDisplay();

  return {
    displays: displays.map((d) => ({
      id: d.id,
      label: d.label || (d.id === primary.id ? 'Main Display' : 'External Display'),
      bounds: d.bounds,
      isPrimary: d.id === primary.id,
    })),
    hasExternal: Boolean(external),
    externalDisplay: external
      ? {
          id: external.id,
          label: external.label || 'External TV / Projector',
          bounds: external.bounds,
        }
      : null,
    isProjectorOpen: Boolean(projectorWindow && !projectorWindow.isDestroyed()),
  };
}

function notifyDisplays() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('display-changed', getDisplaysPayload());
  }
}

function notifyProjectorState(isOpen) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('projector-state-changed', isOpen);
  }
}

function applyExternalPlacement(win, externalDisplay) {
  if (!win || win.isDestroyed() || !externalDisplay) return;
  const target = externalDisplay.bounds;
  const isWin = process.platform === 'win32';

  if (isWin) {
    // 1. Position window bounds strictly over the external display
    win.setBounds(target);
    win.show();

    // 2. Windows: Engage true fullscreen & topmost screen-saver level.
    // This instructs Windows DWM to completely suppress the Windows taskbar on the external display
    // and keeps it covered even when the operator clicks buttons on the laptop Control Surface.
    win.setFullScreen(true);
    win.setAlwaysOnTop(true, 'screen-saver');

    // 3. Multi-stage reinforcement to guarantee taskbar remains hidden
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setBounds(target);
        win.setFullScreen(true);
        win.setAlwaysOnTop(true, 'screen-saver');
      }
    }, 150);

    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setFullScreen(true);
        win.setAlwaysOnTop(true, 'screen-saver');
      }
    }, 400);

    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setFullScreen(true);
        win.setAlwaysOnTop(true, 'screen-saver');
      }
    }, 800);
  } else {
    // Linux (GNOME Wayland/Mutter) & macOS
    if (win.isFullScreen()) {
      win.setFullScreen(false);
    }

    win.setBounds(target);
    win.show();
    win.setAlwaysOnTop(true, 'screen-saver');

    // Multi-stage reinforcement prevents GNOME Mutter from pulling window to primary screen
    // and ensures external display covers panels/taskbars cleanly
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setBounds(target);
        win.setAlwaysOnTop(true, 'screen-saver');
      }
    }, 150);

    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setBounds(target);
        win.setAlwaysOnTop(true, 'screen-saver');
        win.focus();
      }
    }, 400);

    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setBounds(target);
        win.setAlwaysOnTop(true, 'screen-saver');
      }
    }, 800);
  }
}

function loadWithRetry(win, url, maxRetries = 20, delayMs = 400) {
  let attempts = 0;
  const tryLoad = () => {
    attempts++;
    win.loadURL(url).catch((err) => {
      if (attempts < maxRetries && !win.isDestroyed()) {
        setTimeout(tryLoad, delayMs);
      } else {
        console.error(`Failed to load ${url}:`, err.message || err);
      }
    });
  };
  tryLoad();
}

function createOrFocusProjectorWindow() {
  const externalDisplay = findExternalDisplay();
  const primaryDisplay = screen.getPrimaryDisplay();
  const isExternal = Boolean(externalDisplay);
  const targetDisplay = externalDisplay || primaryDisplay;

  if (projectorWindow && !projectorWindow.isDestroyed()) {
    if (isExternal) {
      applyExternalPlacement(projectorWindow, externalDisplay);
      if (mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.focus();
          }
        }, 200);
      }
    } else {
      projectorWindow.setBounds({
        x: primaryDisplay.bounds.x + 80,
        y: primaryDisplay.bounds.y + 80,
        width: 1280,
        height: 720,
      });
      projectorWindow.show();
      projectorWindow.focus();
    }
    return;
  }

  const appIconPath = path.join(__dirname, '../build/icon.png');

  projectorWindow = new BrowserWindow({
    x: isExternal ? targetDisplay.bounds.x : primaryDisplay.bounds.x + 80,
    y: isExternal ? targetDisplay.bounds.y : primaryDisplay.bounds.y + 80,
    width: isExternal ? targetDisplay.bounds.width : 1280,
    height: isExternal ? targetDisplay.bounds.height : 720,
    show: false,
    frame: !isExternal,
    fullscreen: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'Stage Display — StageTimer Pro',
    icon: appIconPath,
    skipTaskbar: isExternal,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  projectorWindow.setMenu(null);

  // Keyboard shortcut listener: Escape, Alt+F4, Ctrl+W, Cmd+W immediately close the projector window
  // F11 toggles fullscreen
  projectorWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (
      input.key === 'Escape' ||
      (input.alt && (input.key === 'F4' || input.key === 'f4')) ||
      ((input.control || input.meta) && (input.key === 'w' || input.key === 'W'))
    ) {
      if (projectorWindow && !projectorWindow.isDestroyed()) {
        projectorWindow.close();
      }
      event.preventDefault();
      return;
    }

    if (input.key === 'F11') {
      if (projectorWindow && !projectorWindow.isDestroyed()) {
        const isFS = projectorWindow.isFullScreen();
        const nextFS = !isFS;
        projectorWindow.setFullScreen(nextFS);
        if (nextFS) {
          projectorWindow.setAlwaysOnTop(true, 'screen-saver');
        } else {
          projectorWindow.setAlwaysOnTop(false);
        }
      }
      event.preventDefault();
      return;
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (isDev) {
    loadWithRetry(projectorWindow, `${devServerUrl}?view=projector`);
  } else {
    projectorWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { view: 'projector' },
    });
  }

  if (isExternal) {
    applyExternalPlacement(projectorWindow, targetDisplay);
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
        }
      }, 300);
    }
  } else {
    projectorWindow.show();
    projectorWindow.focus();
  }

  projectorWindow.on('closed', () => {
    projectorWindow = null;
    notifyProjectorState(false);
  });

  notifyProjectorState(true);
}


function createMainWindow() {
  const appIconPath = path.join(__dirname, '../build/icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    title: 'StageTimer Pro — Control Surface',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });


  mainWindow.setMenu(null);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (isDev) {
    loadWithRetry(mainWindow, devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.close();
    }
  });
}


app.whenReady().then(() => {
  createMainWindow();

  // Initialize Remote Control Server on port 3456
  remoteServer.init({
    port: 3456,
    distDir: path.join(__dirname, '../dist'),
    isDev,
    onAction: (action) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-action', action);
      }
    },
    onClientsChange: (count) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-clients-changed', count);
      }
    },
  }).catch((err) => {
    console.error('[main.cjs] Failed to start remote control server:', err);
  });

  // The moment the app launches, if an external display is connected,
  // immediately open the projector window on the external screen in black
  // (Standard stage/church projection behavior like VideoPsalm / EasyWorship)
  setTimeout(() => {
    const external = findExternalDisplay();
    if (external && (!projectorWindow || projectorWindow.isDestroyed())) {
      createOrFocusProjectorWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.focus();
          }
        }, 300);
      }
    }
  }, 400);

  // Screen listeners for automatic external display migration
  screen.on('display-added', (_event, newDisplay) => {
    notifyDisplays();
    // If external display was plugged in, immediately launch black projection window on it!
    if (!projectorWindow || projectorWindow.isDestroyed()) {
      createOrFocusProjectorWindow();
    } else {
      applyExternalPlacement(projectorWindow, newDisplay);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
        }
      }, 300);
    }
  });

  screen.on('display-removed', (_event, _removedDisplay) => {
    notifyDisplays();
    // If external display was unplugged, bring projector window back to primary display
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      const primary = screen.getPrimaryDisplay();
      if (projectorWindow.isFullScreen()) {
        projectorWindow.setFullScreen(false);
      }
      projectorWindow.setAlwaysOnTop(false);
      projectorWindow.setSkipTaskbar(false);
      projectorWindow.setBounds({
        x: primary.bounds.x + 80,
        y: primary.bounds.y + 80,
        width: 1280,
        height: 720,
      });
      projectorWindow.setOpacity(1);
    }
  });

  screen.on('display-metrics-changed', () => {
    notifyDisplays();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Communications
ipcMain.handle('open-projector', () => {
  createOrFocusProjectorWindow();
  return { success: true };
});

ipcMain.handle('close-projector', () => {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.close();
  }
  return { success: true };
});

ipcMain.handle('toggle-projector-fullscreen', () => {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    const isFS = projectorWindow.isFullScreen();
    const newFS = !isFS;
    projectorWindow.setFullScreen(newFS);
    if (newFS) {
      projectorWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      projectorWindow.setAlwaysOnTop(false);
    }
    return newFS;
  }
  return false;
});

ipcMain.handle('get-displays', () => {
  return getDisplaysPayload();
});

ipcMain.handle('get-remote-info', () => {
  return remoteServer.getServerInfo();
});

ipcMain.on('broadcast-state', (event, state) => {
  remoteServer.broadcastState(state);
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.webContents !== event.sender && !win.isDestroyed()) {
      win.webContents.send('timer-state-updated', state);
    }
  });
});

ipcMain.on('broadcast-tick', (event, remainingSeconds) => {
  remoteServer.broadcastTick(remainingSeconds);
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.webContents !== event.sender && !win.isDestroyed()) {
      win.webContents.send('timer-tick', remainingSeconds);
    }
  });
});

app.on('will-quit', () => {
  remoteServer.stop();
});

