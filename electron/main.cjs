const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

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
              const [_, idx, name, w, h, x, y] = match;
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
  if (win.isFullScreen()) {
    win.setFullScreen(false);
  }

  win.setBounds(target);
  win.show();

  // Multi-stage reinforcement prevents GNOME Mutter from pulling window to primary screen
  setTimeout(() => {
    if (!win.isDestroyed()) win.setBounds(target);
  }, 150);

  setTimeout(() => {
    if (!win.isDestroyed()) {
      win.setBounds(target);
      win.focus();
    }
  }, 400);

  setTimeout(() => {
    if (!win.isDestroyed()) win.setBounds(target);
  }, 800);
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
    } else {
      projectorWindow.setBounds({
        x: primaryDisplay.bounds.x + 80,
        y: primaryDisplay.bounds.y + 80,
        width: 1280,
        height: 720,
      });
      projectorWindow.show();
    }
    projectorWindow.focus();
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  projectorWindow.setMenu(null);

  // Keyboard shortcut listener: Escape, Alt+F4, Ctrl+W, Cmd+W immediately close the projector window
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
  } else {
    projectorWindow.show();
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

  // The moment the app launches, if an external display is connected,
  // immediately open the projector window on the external screen in black
  // (Standard stage/church projection behavior like VideoPsalm / EasyWorship)
  setTimeout(() => {
    const external = findExternalDisplay();
    if (external && (!projectorWindow || projectorWindow.isDestroyed())) {
      createOrFocusProjectorWindow();
    }
  }, 350);

  // Screen listeners for automatic external display migration
  screen.on('display-added', (_event, newDisplay) => {
    notifyDisplays();
    // If external display was plugged in, immediately launch black projection window on it!
    if (!projectorWindow || projectorWindow.isDestroyed()) {
      createOrFocusProjectorWindow();
    } else {
      applyExternalPlacement(projectorWindow, newDisplay);
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
    projectorWindow.setFullScreen(!isFS);
    return !isFS;
  }
  return false;
});

ipcMain.handle('get-displays', () => {
  return getDisplaysPayload();
});

ipcMain.on('broadcast-state', (event, state) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.webContents !== event.sender && !win.isDestroyed()) {
      win.webContents.send('timer-state-updated', state);
    }
  });
});

