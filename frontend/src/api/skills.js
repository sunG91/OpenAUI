/**
 * Skills 库 API
 */
import { API_BASE, wrapNetworkError } from './base';

export async function getSkillsList(params = {}) {
  try {
    const q = new URLSearchParams();
    if (params.workspaceRoot) q.set('workspaceRoot', params.workspaceRoot);
    if (params.folder) q.set('folder', params.folder);
    const res = await fetch(`${API_BASE}/api/skills/list?${q.toString()}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.skills || [];
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getSkillsLibraryConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/skills-library`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.config || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function saveSkillsLibraryConfig(updates) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/skills-library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data.config || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

/** 读取 skill 的 SKILL.md 完整内容 */
export async function getSkillContent(skillPath) {
  try {
    const res = await fetch(`${API_BASE}/api/skills/read?path=${encodeURIComponent(skillPath || '')}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
    const data = await res.json();
    return data.content || '';
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

/** 删除 skill（需提供目录路径，仅限 skills 文件夹下） */
export async function deleteSkill(path) {
  try {
    const res = await fetch(`${API_BASE}/api/skills/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path?.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

/** AI 自动搜索：根据需求从配置的源站抓取并筛选 skill 候选 */
export async function autoSearchSkills(query, options = {}) {
  try {
    const res = await fetch(`${API_BASE}/api/skills/auto-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: (query || '').trim(), ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

/**
 * AI 自动搜索（流式）：实时输出搜索与解析过程
 * onEvent({ type, message?, step?, detail?, candidates?, error? })
 */
export async function autoSearchSkillsStream(query, options = {}) {
  const { onEvent } = options;
  const res = await fetch(`${API_BASE}/api/skills/auto-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: (query || '').trim(), stream: true, ...options }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || res.statusText);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalCandidates = [];
  let finalError = null;
  try {
    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trimStart();
        if (!trimmed.startsWith('data: ')) continue;
        const payloadStr = trimmed.slice(6).trim();
        if (payloadStr === '[DONE]') {
          streamDone = true;
          break;
        }
        try {
          const obj = JSON.parse(payloadStr);
          if (obj.type === 'done') {
            finalCandidates = obj.candidates || [];
            finalError = obj.error || null;
          }
          onEvent?.(obj);
        } catch (_) {}
      }
    }
  } catch (e) {
    throw wrapNetworkError(e);
  }
  return { candidates: finalCandidates, error: finalError };
}

/** 从 URL 导入 skill（ClawHub、GitHub 等） */
export async function importSkillFromUrl(url, options = {}) {
  try {
    const res = await fetch(`${API_BASE}/api/skills/import-from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url?.trim(), ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}
