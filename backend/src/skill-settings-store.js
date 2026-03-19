/**
 * 技能设置 - 委托给统一 config-store（config.json）
 * 快速：固定模型（用户选择快速标签时仅使用此处配置的厂商+模型）
 */
const { readSection, writeSection } = require('./config-store');

function readSkillSettings() {
  const s = readSection('skill');
  return {
    quick: s.quick || { vendorId: '', modelId: '' },
    mcp: s.mcp || { enabledServerIds: [] },
  };
}

function writeSkillSettings(updates) {
  const next = writeSection('skill', updates);
  return { quick: next.skill.quick, mcp: next.skill.mcp };
}

/** 快速技能使用的固定模型，供 WS 处理 quick 消息时调用 */
function getQuickFixedModel() {
  const s = readSkillSettings().quick;
  const vendorId = (s.vendorId && String(s.vendorId).trim()) || '';
  const modelId = (s.modelId && String(s.modelId).trim()) || '';
  return vendorId && modelId ? { vendorId, modelId } : null;
}

/** 对话中启用 MCP 时使用的服务 ID 列表；若未配置则用所有已启用的 MCP 服务 */
function getMcpEnabledServerIdsForChat() {
  const { readSection } = require('./config-store');
  const skillMcp = (readSection('skill') || {}).mcp || {};
  const ids = Array.isArray(skillMcp.enabledServerIds) ? skillMcp.enabledServerIds.filter((id) => id && String(id).trim()) : [];
  if (ids.length > 0) return ids;
  const mcpServers = (readSection('mcp') || {}).servers || [];
  return mcpServers.filter((s) => s && s.id && s.enabled !== false).map((s) => String(s.id).trim());
}

module.exports = {
  readSkillSettings,
  writeSkillSettings,
  getQuickFixedModel,
  getMcpEnabledServerIdsForChat,
};
