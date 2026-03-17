/**
 * Skills API
 * 扫描技能目录（SKILL.md 格式），返回可注入 Agent 的技能列表
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/** 解析 SKILL.md 的 YAML frontmatter 和 body */
function parseSkillMd(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content.trim() };
  const [, yamlStr, body] = match;
  const frontmatter = {};
  for (const line of yamlStr.split('\n')) {
    const m = line.match(/^(\w[\w.-]*):\s*(.*)$/);
    if (m) frontmatter[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
  }
  if (frontmatter.metadata) {
    try {
      frontmatter.metadata = JSON.parse(frontmatter.metadata);
    } catch (_) {}
  }
  return { frontmatter, body: body.trim() };
}

/** 扫描目录下的所有技能（每个子目录一个 SKILL.md） */
function scanSkillsDir(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillDir = path.join(dir, e.name);
    const skillPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    try {
      const content = fs.readFileSync(skillPath, 'utf8');
      const { frontmatter, body } = parseSkillMd(content);
      result.push({
        name: frontmatter.name || e.name,
        description: frontmatter.description || '',
        importSummary: frontmatter.importSummary || '',
        body: body.slice(0, 2000),
        location: skillDir,
      });
    } catch (err) {
      console.warn(`[Skills] 解析失败 ${skillPath}:`, err.message);
    }
  }
  return result;
}

const { readSkillsLibraryConfig, resolveSkillsFolder } = require('../skills-library-store');

/** 获取要扫描的目录列表：配置的 skillsFolder 优先（相对路径基于 backend），工作区 skills */
function getSkillDirs(workspaceRoot, customFolder) {
  const dirs = [];
  if (customFolder && typeof customFolder === 'string' && customFolder.trim()) {
    dirs.push(resolveSkillsFolder(customFolder));
  }
  if (workspaceRoot) {
    dirs.push(path.join(workspaceRoot, 'skills'));
  }
  dirs.push(resolveSkillsFolder('data/skills'));
  return dirs;
}

const { importFromUrl, autoSearch } = require('../services/skill-import');

/**
 * POST /api/skills/auto-search
 * Body: { query: string, vendorId?: string, modelId?: string, stream?: boolean }
 * 根据用户需求，从配置的 skill 源站抓取并 AI 筛选匹配的 skill 候选
 * stream=true 时返回 SSE 流式输出，展示搜索与解析过程
 */
router.post('/auto-search', async (req, res) => {
  try {
    const { query, vendorId, modelId, stream: useStream } = req.body || {};
    const q = (query || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, error: '缺少 query' });
    }

    if (useStream === true) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      const emit = (event) => {
        res.write('data: ' + JSON.stringify(event) + '\n\n');
        if (typeof res.flush === 'function') res.flush();
      };
      try {
        const result = await autoSearch(q, { vendorId, modelId, emit });
        emit({ type: 'done', candidates: result.candidates || [], error: result.error || null });
      } catch (e) {
        emit({ type: 'error', error: e?.message || String(e) });
      }
      res.write('data: [DONE]\n\n');
      if (typeof res.flush === 'function') res.flush();
      return res.end();
    }

    const result = await autoSearch(q, { vendorId, modelId });
    return res.json({
      success: true,
      candidates: result.candidates || [],
      error: result.error || null,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

/**
 * POST /api/skills/import-from-url
 * Body: { url: string, vendorId?: string, modelId?: string }
 * 从 ClawHub/GitHub 等 URL 导入 skill，分析页面、下载、解压到默认文件夹
 */
router.post('/import-from-url', async (req, res) => {
  try {
    const { url, vendorId, modelId } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 url' });
    }
    const result = await importFromUrl(url, { vendorId, modelId });
    if (result.success) {
      return res.json({ success: true, skillName: result.skillName, path: result.path });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

/**
 * POST /api/skills/delete
 * Body: { path: string } - skill 目录的完整路径（需在配置的 skills 文件夹下）
 */
router.post('/delete', (req, res) => {
  try {
    const { path: skillPath } = req.body || {};
    if (!skillPath || typeof skillPath !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 path' });
    }
    const cfg = readSkillsLibraryConfig();
    const skillsRoot = path.resolve(resolveSkillsFolder(cfg.skillsFolder || 'data/skills'));
    const resolved = path.resolve(skillPath.trim());
    const rel = path.relative(skillsRoot, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return res.status(400).json({ success: false, error: '只能删除 skills 文件夹下的 skill' });
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return res.status(400).json({ success: false, error: '路径不存在或不是目录' });
    }
    fs.rmSync(resolved, { recursive: true, force: true });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

/**
 * GET /api/skills/read
 * Query: path - skill 目录的完整路径
 * 返回该 skill 的 SKILL.md 完整内容
 */
router.get('/read', (req, res) => {
  try {
    const skillPath = (req.query.path || '').trim();
    if (!skillPath) {
      return res.status(400).json({ success: false, error: '缺少 path' });
    }
    const cfg = readSkillsLibraryConfig();
    const skillsRoot = path.resolve(resolveSkillsFolder(cfg.skillsFolder || 'data/skills'));
    const resolved = path.resolve(skillPath);
    const rel = path.relative(skillsRoot, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return res.status(400).json({ success: false, error: '路径不在 skills 文件夹下' });
    }
    const skillMd = path.join(resolved, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      return res.status(404).json({ success: false, error: '未找到 SKILL.md' });
    }
    const content = fs.readFileSync(skillMd, 'utf8');
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

/**
 * GET /api/skills/list
 * Query: workspaceRoot (可选) - 工作区根路径
 * Query: folder (可选) - 指定扫描文件夹，覆盖配置
 */
router.get('/list', (req, res) => {
  try {
    const workspaceRoot = req.query.workspaceRoot || '';
    const folderOverride = req.query.folder || '';
    const cfg = readSkillsLibraryConfig();
    const customFolder = folderOverride || cfg.skillsFolder || '';
    const dirs = getSkillDirs(workspaceRoot, customFolder);
    const byName = new Map();
    for (const dir of dirs) {
      if (!dir || !fs.existsSync(dir)) continue;
      const skills = scanSkillsDir(dir);
      for (const s of skills) {
        if (!byName.has(s.name)) byName.set(s.name, s);
      }
    }
    const list = Array.from(byName.values());
    res.json({ skills: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { router, parseSkillMd, scanSkillsDir, getSkillDirs };
