const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getCounter: () => ipcRenderer.invoke('get-counter'),
  incrementCounter: () => ipcRenderer.invoke('increment-counter'),
  resetCounter: () => ipcRenderer.invoke('reset-counter'),
});