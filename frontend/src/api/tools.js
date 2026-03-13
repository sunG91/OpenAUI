/**
 * 系统工具 API：控制台/Shell 等
 */
import { API_BASE } from './base';

/** 获取服务端系统（win32/darwin/linux），用于提示模型输出对应平台命令 */
export async function getToolsPlatform() {
  const res = await fetch(`${API_BASE}/api/tools/platform`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data.platform;
}

export async function runShell(command, options = {}) {
  const { cwd, timeout } = options;
  const res = await fetch(`${API_BASE}/api/tools/shell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: String(command).trim(), cwd, timeout }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
