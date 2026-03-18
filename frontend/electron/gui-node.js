/**
 * GUI 节点执行器 — 在 Electron 主进程运行 nut/robotjs
 * 参考 OpenClaw 节点执行：GUI 操作在设备端执行，便于未来后端远程部署
 */
const path = require('path');

let nut = null;
let robotjs = null;
let screenshotDesktop = null;
let provider = 'nut';

function loadProvider() {
  try {
    nut = require('@nut-tree/nut-js');
  } catch (_) {}
  try {
    robotjs = require('robotjs');
  } catch (_) {}
  try {
    screenshotDesktop = require('screenshot-desktop');
  } catch (_) {}
}

function setProvider(p) {
  provider = (p || 'nut').toLowerCase() === 'robotjs' ? 'robotjs' : 'nut';
}

async function mouseMove(x, y) {
  loadProvider();
  if (provider === 'robotjs' && robotjs) {
    robotjs.moveMouse(x, y);
    return { x, y };
  }
  if (nut) {
    const { mouse, straightTo, Point } = nut;
    await mouse.move(straightTo(new Point(x, y)));
    return { x, y };
  }
  throw new Error('GUI 模块未安装');
}

async function mouseClick(opts = {}) {
  loadProvider();
  const button = (opts.button || 'left').toLowerCase();
  const doubleClick = opts.doubleClick === true;
  const x = opts.x;
  const y = opts.y;

  if (provider === 'robotjs' && robotjs) {
    if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
      robotjs.moveMouse(x, y);
    }
    robotjs.mouseClick(button, doubleClick);
    return { success: true, button, doubleClick };
  }
  if (nut) {
    const { mouse, straightTo, Point, Button } = nut;
    if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
      await mouse.move(straightTo(new Point(x, y)));
    }
    const btn = button === 'right' ? Button.RIGHT : Button.LEFT;
    if (doubleClick) await mouse.doubleClick(btn);
    else await mouse.click(btn);
    return { success: true, button, doubleClick };
  }
  throw new Error('GUI 模块未安装');
}

async function keyboardType(text) {
  loadProvider();
  if (provider === 'robotjs' && robotjs) {
    robotjs.typeString(String(text || ''));
    return { length: String(text || '').length };
  }
  if (nut) {
    const { keyboard } = nut;
    await keyboard.type(String(text || ''));
    return { length: String(text || '').length };
  }
  throw new Error('GUI 模块未安装');
}

async function screenCapture() {
  if (!screenshotDesktop) screenshotDesktop = require('screenshot-desktop');
  const buf = await screenshotDesktop({ format: 'png' });
  const base64 = buf.toString('base64');
  let screenWidth, screenHeight;
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) {
    screenWidth = buf.readUInt32BE(16);
    screenHeight = buf.readUInt32BE(20);
  }
  return {
    image: `data:image/png;base64,${base64}`,
    ...(screenWidth && screenHeight ? { screenWidth, screenHeight } : {}),
  };
}

async function screenSize() {
  loadProvider();
  if (provider === 'robotjs' && robotjs) {
    const size = robotjs.getScreenSize();
    return { width: size.width, height: size.height };
  }
  if (nut) {
    const { screen } = nut;
    const width = await screen.width();
    const height = await screen.height();
    return { width, height };
  }
  throw new Error('GUI 模块未安装');
}

module.exports = {
  setProvider,
  mouseMove,
  mouseClick,
  keyboardType,
  screenCapture,
  screenSize,
};
