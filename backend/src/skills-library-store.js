/**
 * Skills 库配置 - 委托给统一 config-store（config.json）
 */
const fs = require('fs');
const path = require('path');
const { readSection, writeSection, SECTION_DEFAULTS } = require('./config-store');

const BACKEND_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');

const DEFAULT_SKILLS_FOLDER = path.join(DATA_DIR, 'skills');
const DEFAULT_SKILLS_FOLDER_REL = 'data/skills';

function readSkillsLibraryConfig() {
  const s = readSection('skillsLibrary');
  const defaultSources = [
    { name: 'ClawHub', url: 'https://clawhub.ai/skills' },
    { name: 'GitHub Skills', url: 'https://github.com/search?q=SKILL.md+skill&type=repositories' },
  ];
  return {
    skillsFolder: s.skillsFolder ?? DEFAULT_SKILLS_FOLDER_REL,
    loadMode: s.loadMode ?? 'folder',
    manualSkills: Array.isArray(s.manualSkills) ? s.manualSkills : [],
    autoDownloadEnabled: Boolean(s.autoDownloadEnabled ?? false),
    skillSourceUrls: Array.isArray(s.skillSourceUrls) && s.skillSourceUrls.length > 0
      ? s.skillSourceUrls
      : defaultSources,
  };
}

function writeSkillsLibraryConfig(updates) {
  const next = writeSection('skillsLibrary', updates);
  return next.skillsLibrary;
}

/** 将配置的路径解析为绝对路径：相对路径基于 backend 根目录 */
function resolveSkillsFolder(folder) {
  if (!folder || typeof folder !== 'string') return DEFAULT_SKILLS_FOLDER;
  const trimmed = folder.trim();
  if (!trimmed) return DEFAULT_SKILLS_FOLDER;
  if (path.isAbsolute(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) return trimmed;
  return path.join(BACKEND_ROOT, trimmed);
}

/** 确保默认 Skills 文件夹存在 */
function ensureSkillsFolder() {
  const cfg = readSkillsLibraryConfig();
  const folder = resolveSkillsFolder(cfg.skillsFolder || DEFAULT_SKILLS_FOLDER_REL);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  return folder;
}

module.exports = {
  readSkillsLibraryConfig,
  writeSkillsLibraryConfig,
  ensureSkillsFolder,
  resolveSkillsFolder,
  DEFAULT_SKILLS_FOLDER,
  DEFAULT_SKILLS_FOLDER_REL,
};
