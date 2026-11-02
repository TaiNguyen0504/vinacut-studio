const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vinacut', {
  platform: process.platform,
  version: '0.2.0',
  chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  testConnection: (payload) => ipcRenderer.invoke('ai:test', payload),
  listModels: (payload) => ipcRenderer.invoke('ai:list-models', payload),
  computerUseTest: (payload) => ipcRenderer.invoke('ai:computer-use-test', payload),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
  listRecentDwgs: () => ipcRenderer.invoke('dwg:list-recent'),
  pickDwg: () => ipcRenderer.invoke('dwg:pick'),
  vinacadPrepare: (payload) => ipcRenderer.invoke('vinacad:prepare', payload),
  vinacadClose: () => ipcRenderer.invoke('vinacad:close'),
  captureSources: () => ipcRenderer.invoke('capture:sources'),
  nativeCaptureStart: () => ipcRenderer.invoke('capture:native-start'),
  nativeCaptureStop: () => ipcRenderer.invoke('capture:native-stop'),
  vinacadCaptureStart: (payload) => ipcRenderer.invoke('capture:vinacad-start', payload),
  vinacadCaptureStop: () => ipcRenderer.invoke('capture:vinacad-stop'),
  renderEditedVideo: (payload) => ipcRenderer.invoke('video:render', payload),
  planVideo: (payload) => ipcRenderer.invoke('production:plan', payload),
  recordPlan: (payload) => ipcRenderer.invoke('production:record', payload),
  renderSession: (payload) => ipcRenderer.invoke('production:render', payload),
  exportSession: (payload) => ipcRenderer.invoke('production:export', payload),
  cancelProduction: () => ipcRenderer.invoke('production:cancel'),
  onProductionProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('production:progress', listener);
    return () => ipcRenderer.removeListener('production:progress', listener);
  },
});
