const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nodeDownloadAPI', {
  onProgress: (cb) => ipcRenderer.on('node-download-progress', (_, data) => cb(data)),
  onDone: (cb) => ipcRenderer.on('node-download-done', () => cb()),
  onError: (cb) => ipcRenderer.on('node-download-error', (_, err) => cb(err)),
});
