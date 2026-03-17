/**
 * 语音模块设置 - 委托给统一 config-store（config.json）
 */
const { readSection, writeSection, SECTION_DEFAULTS } = require('./config-store');

const defaultVoiceSettings = SECTION_DEFAULTS.voice;

function readVoiceSettings() {
  return readSection('voice');
}

function writeVoiceSettings(updates) {
  const next = writeSection('voice', updates);
  return next.voice;
}

module.exports = {
  defaultVoiceSettings,
  readVoiceSettings,
  writeVoiceSettings,
};
