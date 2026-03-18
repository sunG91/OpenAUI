/**
 * 统一配置存储 - 本地数据库式
 * 所有配置（MCP、Skills、SkillsLibrary、模型、语音等）集中到 backend/data/config.json
 * 用户每次修改都通过 config 操作
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

/** 各模块默认配置 */
const SECTION_DEFAULTS = {
  mcp: {
    servers: [],
  },
  skill: {
    quick: { vendorId: '', modelId: '' },
    mcp: { enabledServerIds: [] },
  },
  skillsLibrary: {
    skillsFolder: 'data/skills',
    loadMode: 'folder',
    manualSkills: [],
    autoDownloadEnabled: false,
    skillSourceUrls: [
      { name: 'ClawHub', url: 'https://clawhub.ai/skills' },
      { name: 'GitHub Skills', url: 'https://github.com/search?q=SKILL.md+skill&type=repositories' },
    ],
  },
  voice: {
    enabled: true,
    saveAudioToLocal: true,
    wakeWordEnabled: false,
    wakeWord: '小寒',
    wakeWordMode: 'push-to-talk',
    sttEnabled: true,
    sttEngine: 'whisper.cpp',
    autoSendAfterStt: true,
    ttsEnabled: true,
    ttsEngine: 'sapi',
    autoReadAssistant: false,
    ttsVoice: '',
    ttsRate: 0,
    gptsovitsApiUrl: 'http://127.0.0.1:9880',
    gptsovitsTextLang: 'zh',
    gptsovitsPromptLang: 'zh',
  },
  model: {
    quick: { vendorId: '', modelId: '' },
  },
  tools: {
    guiProvider: 'nut', // 'nut' | 'robotjs'
    guiExecutor: 'backend', // 'backend' | 'node' — 节点执行时 GUI 在 Electron 主进程运行，便于未来远程后端
  },
  aui: {
    architectureId: 'tianshu', // 当前选中的 AUI 架构 id
  },
};

const LEGACY_FILES = {
  mcp: path.join(DATA_DIR, 'mcp-settings.json'),
  skill: path.join(DATA_DIR, 'skill-settings.json'),
  skillsLibrary: path.join(DATA_DIR, 'skills-library.json'),
  voice: path.join(DATA_DIR, 'voice-settings.json'),
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

/** 从旧文件迁移数据 */
function migrateFromLegacy() {
  const config = {};
  for (const [section, filePath] of Object.entries(LEGACY_FILES)) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        if (section === 'skill' && data.quick) {
          config.skill = { quick: data.quick, mcp: data.mcp || { enabledServerIds: [] } };
        } else if (section === 'skillsLibrary') {
          config.skillsLibrary = data;
        } else {
          config[section] = data;
        }
      } catch {
        // 忽略解析失败
      }
    }
  }
  return config;
}

function readConfig() {
  ensureDir();
  let stored = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      stored = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {};
    } catch {
      stored = {};
    }
  } else {
    stored = migrateFromLegacy();
    if (Object.keys(stored).length > 0) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(stored, null, 2), 'utf8');
    }
  }
  const result = {};
  for (const [section, defaults] of Object.entries(SECTION_DEFAULTS)) {
    result[section] = deepMerge({ ...defaults }, stored[section] || {});
  }
  return result;
}

function writeConfig(full) {
  ensureDir();
  const current = readConfig();
  const next = deepMerge(current, full || {});
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** 读取指定 section */
function readSection(section) {
  const full = readConfig();
  return full[section] ?? SECTION_DEFAULTS[section];
}

/** 更新指定 section，返回更新后的完整 config */
function writeSection(section, updates) {
  ensureDir();
  const current = readConfig();
  const sectionData = current[section] || SECTION_DEFAULTS[section];
  const nextSection = deepMerge(sectionData, updates || {});
  const next = { ...current, [section]: nextSection };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = {
  readConfig,
  writeConfig,
  readSection,
  writeSection,
  SECTION_DEFAULTS,
  CONFIG_FILE,
};
