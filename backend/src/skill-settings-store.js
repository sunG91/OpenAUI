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

module.exports = {
  readSkillSettings,
  writeSkillSettings,
  getQuickFixedModel,
};
