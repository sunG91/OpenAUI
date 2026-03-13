/**
 * 技能设置 - 存到 backend/data/skill-settings.json
 * 快速：固定模型（用户选择快速标签时仅使用此处配置的厂商+模型）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'skill-settings.json');

const defaults = {
  quick: { vendorId: '', modelId: '' },
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSkillSettings() {
  ensureDir();
  let stored = {};
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(defaults, null, 2), 'utf8');
    return { quick: { ...defaults.quick } };
  }
  if (fs.existsSync(FILE_PATH)) {
    try {
      stored = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) || {};
    } catch {
      stored = {};
    }
  }
  return {
    quick: { ...defaults.quick, ...(stored.quick || {}) },
  };
}

function writeSkillSettings(updates) {
  ensureDir();
  const next = { ...readSkillSettings(), ...(updates || {}) };
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
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
