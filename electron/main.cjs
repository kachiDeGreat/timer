const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

// Disable Linux sandbox requirements if running as unprivileged user
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow = null;
let projectorWindow = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function findExternalDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.find((d) => d.id !== primary.id) || null;
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

function moveProjectorToDisplay(win, targetDisplay, makeFullscreen = true) {
  if (!win || win.isDestroyed()) return;

  const bounds = targetDisplay.bounds;
  if (win.isFullScreen()) {
    win.setFullScreen(false);
  }

  win.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });

  if (makeFullscreen) {
    // Small delay ensures Linux X11/Wayland window manager has updated geometry before fullscreen
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setFullScreen(true);
      }
    }, 60);
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
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    const externalDisplay = findExternalDisplay();
    if (externalDisplay) {
      moveProjectorToDisplay(projectorWindow, externalDisplay, true);
    }
    projectorWindow.focus();
    return;
  }

  const externalDisplay = findExternalDisplay();
  const primaryDisplay = screen.getPrimaryDisplay();
  const isExternal = Boolean(externalDisplay);
  const targetDisplay = externalDisplay || primaryDisplay;

  projectorWindow = new BrowserWindow({
    x: isExternal ? targetDisplay.bounds.x : primaryDisplay.bounds.x + 80,
    y: isExternal ? targetDisplay.bounds.y : primaryDisplay.bounds.y + 80,
    width: isExternal ? targetDisplay.bounds.width : 1280,
    height: isExternal ? targetDisplay.bounds.height : 720,
    fullscreen: isExternal,
    frame: !isExternal,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'Stage Display — StageTimer Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  projectorWindow.setMenu(null);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (isDev) {
    loadWithRetry(projectorWindow, `${devServerUrl}?view=projector`);
  } else {
    projectorWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { view: 'projector' },
    });
  }

  if (isExternal) {
    setTimeout(() => {
      if (projectorWindow && !projectorWindow.isDestroyed()) {
        projectorWindow.setFullScreen(true);
      }
    }, 60);
  }

  projectorWindow.on('closed', () => {
    projectorWindow = null;
    notifyProjectorState(false);
  });

  notifyProjectorState(true);
}


function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    title: 'StageTimer Pro — Control Surface',
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

  // Screen listeners for automatic external display migration
  screen.on('display-added', (_event, newDisplay) => {
    notifyDisplays();
    // If projector window is open, immediately switch it to the newly plugged external display!
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      moveProjectorToDisplay(projectorWindow, newDisplay, true);
    }
  });

  screen.on('display-removed', (_event, _removedDisplay) => {
    notifyDisplays();
    // If external display was unplugged, bring projector window back to primary display
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      const primary = screen.getPrimaryDisplay();
      projectorWindow.setFullScreen(false);
      projectorWindow.setBounds({
        x: primary.bounds.x + 80,
        y: primary.bounds.y + 80,
        width: 1280,
        height: 720,
      });
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

