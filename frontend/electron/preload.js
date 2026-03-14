const { contextBridge } = require('electron');
const { desktopCapturer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  /** 获取可截取的屏幕/窗口列表，用于 getDisplayMedia 不可用时的后备截屏 */
  getDesktopSources: (opts = {}) =>
    desktopCapturer.getSources({ types: ['screen', 'window'], ...opts }),
});
