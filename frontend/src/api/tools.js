/**
 * 系统工具 API：
 * - 控制台 / Shell
 * - 结构化系统操作（文件 / 进程）
 */
import { API_BASE } from './base';

/** 安全解析 JSON 响应，避免 HTML 404 等导致 "Unexpected token '<'" */
async function parseJsonResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (text.trimStart().startsWith('<')) {
      throw new Error(`接口返回了 HTML 而非 JSON，可能是后端未启动或地址错误（${API_BASE}）`);
    }
    throw new Error(`接口返回了无效 JSON：${text.slice(0, 80)}...`);
  }
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

/** 获取服务端系统（win32/darwin/linux），用于提示模型输出对应平台命令 */
export async function getToolsPlatform() {
  const res = await fetch(`${API_BASE}/api/tools/platform`);
  const data = await parseJsonResponse(res);
  return data.platform;
}

/** 获取项目根路径，供 AI 生成正确文件路径（系统操作工具仅允许操作此目录内） */
export async function getToolsProjectRoot() {
  const res = await fetch(`${API_BASE}/api/tools/project-root`);
  const data = await parseJsonResponse(res);
  return data.projectRoot;
}

/** 任意 Shell 命令执行（控制台工具使用） */
export async function runShell(command, options = {}) {
  const { cwd, timeout } = options;
  const res = await fetch(`${API_BASE}/api/tools/shell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: String(command).trim(), cwd, timeout }),
  });
  const data = await parseJsonResponse(res);
  return data;
}

// ------- 结构化系统操作：文件 / 进程 -------

/** 列出目录内容（仅限项目目录内） */
export async function systemFsList(path) {
  const res = await fetch(`${API_BASE}/api/tools/system/fs/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return parseJsonResponse(res);
}

/** 读取文本文件（1MB 以内，仅限项目目录内） */
export async function systemFsReadText(path) {
  const res = await fetch(`${API_BASE}/api/tools/system/fs/readText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return parseJsonResponse(res);
}

/** 写入文本文件（1MB 以内，仅限项目目录内） */
export async function systemFsWriteText(path, content) {
  const res = await fetch(`${API_BASE}/api/tools/system/fs/writeText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  return parseJsonResponse(res);
}

/** 获取进程列表（原始字符串，由前端/模型解析） */
export async function systemProcessList() {
  const res = await fetch(`${API_BASE}/api/tools/system/process/list`);
  return parseJsonResponse(res);
}

/** 杀死指定 PID 进程（高危操作，前端需二次确认） */
export async function systemProcessKill(pid) {
  const res = await fetch(`${API_BASE}/api/tools/system/process/kill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  });
  return parseJsonResponse(res);
}

// ------- GUI 模拟（nut.js）-------

/** 鼠标移动到 (x, y) */
export async function guiMouseMove(x, y) {
  const res = await fetch(`${API_BASE}/api/tools/gui/mouse/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y }),
  });
  return parseJsonResponse(res);
}

/** 鼠标点击（button: left|right，可选 x,y 先移动再点） */
export async function guiMouseClick(options = {}) {
  const res = await fetch(`${API_BASE}/api/tools/gui/mouse/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  return parseJsonResponse(res);
}

/** 键盘输入文本 */
export async function guiKeyboardType(text) {
  const res = await fetch(`${API_BASE}/api/tools/gui/keyboard/type`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return parseJsonResponse(res);
}

/** 截屏（region 可选 "x,y,w,h"） */
export async function guiScreenCapture(region) {
  const url = region ? `${API_BASE}/api/tools/gui/screen/capture?region=${encodeURIComponent(region)}` : `${API_BASE}/api/tools/gui/screen/capture`;
  const res = await fetch(url);
  return parseJsonResponse(res);
}

// ------- 浏览器自动化（playwright）-------

/** 打开页面 */
export async function browserNavigate(url) {
  const res = await fetch(`${API_BASE}/api/tools/browser/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return parseJsonResponse(res);
}

/** 点击元素 */
export async function browserClick(url, selector) {
  const res = await fetch(`${API_BASE}/api/tools/browser/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, selector }),
  });
  return parseJsonResponse(res);
}

/** 在元素内输入 */
export async function browserType(url, selector, text) {
  const res = await fetch(`${API_BASE}/api/tools/browser/type`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, selector, text }),
  });
  return parseJsonResponse(res);
}

/** 页面截屏 */
export async function browserScreenshot(url) {
  const res = await fetch(`${API_BASE}/api/tools/browser/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return parseJsonResponse(res);
}
