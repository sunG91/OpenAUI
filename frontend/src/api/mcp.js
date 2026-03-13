import { API_BASE, wrapNetworkError } from './base';

export async function getMcpBaseDir() {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/base-dir`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.baseDir || '';
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getMcpStatus(serverId) {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/${encodeURIComponent(serverId)}/status`);
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || res.statusText);
    }
    return { running: !!data.running, pid: data.pid ?? null };
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function startMcpServer(serverId) {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/${encodeURIComponent(serverId)}/start`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || res.statusText);
    }
    return { running: !!data.running, pid: data.pid ?? null };
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function stopMcpServer(serverId) {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/${encodeURIComponent(serverId)}/stop`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || res.statusText);
    }
    return true;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getMcpServers() {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/servers`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return Array.isArray(data.servers) ? data.servers : [];
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function listMcpTools(serverId) {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/${encodeURIComponent(serverId)}/tools`);
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || res.statusText);
    }
    return Array.isArray(data.tools) ? data.tools : [];
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function callMcpTool(serverId, toolName, args) {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/${encodeURIComponent(serverId)}/tools/${encodeURIComponent(toolName)}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || res.statusText);
    }
    return data.result;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getMcpHttpCredentials() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/mcp-http-credentials`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.credentials || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function saveMcpHttpCredential(serverId, authorization) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/mcp-http-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, authorization: authorization || '' }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || res.statusText);
    }
    return data.credentials || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getMcpVendors() {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/vendors`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.vendors || { httpVendors: [] };
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

