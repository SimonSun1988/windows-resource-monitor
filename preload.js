const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStaticData: () => ipcRenderer.invoke('get-static-data'),
  getDynamicData: () => ipcRenderer.invoke('get-dynamic-data'),
  getStartupSetting: () => ipcRenderer.invoke('get-startup-setting'),
  toggleStartup: (enable) => ipcRenderer.invoke('toggle-startup', enable),
  startResize: () => ipcRenderer.send('start-resizing'),
  stopResize: () => ipcRenderer.send('stop-resizing'),
  closeApp: () => ipcRenderer.send('close-app'),
  onDebugLog: (callback) => ipcRenderer.on('debug-log', (event, msg) => callback(msg)),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds')
});
