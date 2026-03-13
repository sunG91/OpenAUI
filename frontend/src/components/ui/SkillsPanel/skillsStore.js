/**
 * 技能开关状态 - 持久化到 localStorage，按技能 id 存储
 */
const STORAGE_KEY = 'openaui_skills_enabled';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function save(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

export function getSkillEnabled(id) {
  const map = load();
  if (map[id] !== undefined) return !!map[id];
  return true;
}

export function setSkillEnabled(id, enabled) {
  const map = load();
  map[id] = !!enabled;
  save(map);
}

export function getAllSkillsEnabled(moduleIds) {
  const map = load();
  return Object.fromEntries(moduleIds.map((id) => [id, map[id] !== undefined ? !!map[id] : true]));
}

export function setSkillEnabledAndReturnAll(id, enabled, moduleIds) {
  const map = load();
  map[id] = !!enabled;
  save(map);
  return Object.fromEntries(moduleIds.map((mid) => [mid, map[mid] !== undefined ? !!map[mid] : true]));
}
