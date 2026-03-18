const { contextBridge, ipcRenderer } = require('electron');
const { desktopCapturer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  /** 获取可截取的屏幕/窗口列表，用于 getDisplayMedia 不可用时的后备截屏 */
  getDesktopSources: (opts = {}) =>
    desktopCapturer.getSources({ types: ['screen', 'window'], ...opts }),
  /** GUI 节点执行（当 tools.guiExecutor === 'node' 时使用） */
  guiNode: {
    setProvider: (p) => ipcRenderer.invoke('gui:setProvider', p),
    mouseMove: (x, y) => ipcRenderer.invoke('gui:mouseMove', x, y),
    mouseClick: (opts) => ipcRenderer.invoke('gui:mouseClick', opts),
    keyboardType: (text) => ipcRenderer.invoke('gui:keyboardType', text),
    screenCapture: () => ipcRenderer.invoke('gui:screenCapture'),
    screenSize: () => ipcRenderer.invoke('gui:screenSize'),
  },
});
