const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openProjector: () => ipcRenderer.invoke('open-projector'),
  closeProjector: () => ipcRenderer.invoke('close-projector'),
  toggleProjectorFullscreen: () => ipcRenderer.invoke('toggle-projector-fullscreen'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  onDisplayChange: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('display-changed', subscription);
    return () => {
      ipcRenderer.removeListener('display-changed', subscription);
    };
  },
  onProjectorStateChange: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('projector-state-changed', subscription);
    return () => {
      ipcRenderer.removeListener('projector-state-changed', subscription);
    };
  },
  sendState: (state) => ipcRenderer.send('broadcast-state', state),
  onStateUpdate: (callback) => {
    const subscription = (_event, state) => callback(state);
    ipcRenderer.on('timer-state-updated', subscription);
    return () => {
      ipcRenderer.removeListener('timer-state-updated', subscription);
    };
  },
});

