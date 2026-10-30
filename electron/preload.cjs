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
  sendTick: (remainingSeconds) => ipcRenderer.send('broadcast-tick', remainingSeconds),
  onTick: (callback) => {
    const subscription = (_event, remaining) => callback(remaining);
    ipcRenderer.on('timer-tick', subscription);
    return () => {
      ipcRenderer.removeListener('timer-tick', subscription);
    };
  },
  getRemoteInfo: () => ipcRenderer.invoke('get-remote-info'),
  onRemoteAction: (callback) => {
    const subscription = (_event, action) => callback(action);
    ipcRenderer.on('remote-action', subscription);
    return () => {
      ipcRenderer.removeListener('remote-action', subscription);
    };
  },
  onRemoteClientsChange: (callback) => {
    const subscription = (_event, count) => callback(count);
    ipcRenderer.on('remote-clients-changed', subscription);
    return () => {
      ipcRenderer.removeListener('remote-clients-changed', subscription);
    };
  },
});

