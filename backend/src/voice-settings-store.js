/**
 * 语音模块设置本地存储 - 存到 backend/data/voice-settings.json
 */
const fs = require('fs');
const path = require('path');
const { defaultConfig } = require('./config/loadConfig');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'voice-settings.json');

const defaultVoiceSettings = {
  enabled: true,
  // 录音/存储
  saveAudioToLocal: true,
  // 唤醒词
  wakeWordEnabled: false,
  wakeWord: '小寒',
  wakeWordMode: 'push-to-talk', // push-to-talk | always
  // STT
  sttEnabled: true,
  sttEngine: 'whisper.cpp', // whisper.cpp | vosk
  autoSendAfterStt: true,
  // TTS
  ttsEnabled: true,
  ttsEngine: 'sapi', // sapi | piper | gptsovits
  autoReadAssistant: false,
  // ttsVoice: SAPI 为 voiceName；Piper 为模型 id（如 zh_CN-huayan-medium）
  ttsVoice: '',
  ttsRate: 0,
  // GPT-SoVITS（可选）：音色由 backend/data/runtime/gptsovits/voices.json 定义
  // 说明：这里保留扩展字段，便于后续做“服务自带 + 一键启动 + 参数可调”
  gptsovitsApiUrl: 'http://127.0.0.1:9880',
  gptsovitsTextLang: 'zh',
  gptsovitsPromptLang: 'zh'
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readVoiceSettings() {
  ensureDir();
  let stored = {};
  if (fs.existsSync(FILE_PATH)) {
    try {
      stored = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) || {};
    } catch {
      stored = {};
    }
  }
  return { ...defaultVoiceSettings, ...stored };
}

function writeVoiceSettings(updates) {
  ensureDir();
  const next = { ...readVoiceSettings(), ...(updates || {}) };
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = {
  defaultVoiceSettings,
  readVoiceSettings,
  writeVoiceSettings
};

