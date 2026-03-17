/**
 * Skill 从 URL 导入服务
 * 支持 ClawHub、GitHub 等地址，调用模型分析网页，下载并解压到默认 skills 文件夹
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { readSkillsLibraryConfig, resolveSkillsFolder } = require('../../skills-library-store');
const { readApiKeys } = require('../../apikeys-store');
const { getProvider } = require('../modelProviders');
const { readSection } = require('../../config-store');

/** 使用 Playwright 渲染 ClawHub 等 SPA 页面，返回 { html, downloadUrl? } */
async function fetchClawhubWithPlaywright(pageUrl) {
  let sessionManager;
  try {
    sessionManager = require('../../browser/sessionManager');
  } catch (_) {
    return null;
  }
  const { launchBrowser, BROWSER_TIMEOUT_MS } = sessionManager;
  if (!sessionManager?.playwright) return null;
  let browser;
  try {
    browser = await launchBrowser();
    if (!browser) return null;
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT_MS });
    await new Promise((r) => setTimeout(r, 1500));
    const { html, downloadUrl } = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const as = document.querySelectorAll('a[href]');
      let url = null;
      for (const a of as) {
        const href = (a.getAttribute('href') || '').trim();
        const text = (a.textContent || '').trim();
        if ((href.includes('download') || href.includes('convex')) && /download\s*zip/i.test(text)) {
          url = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
          break;
        }
      }
      return { html, downloadUrl: url };
    });
    return { html, downloadUrl };
  } catch (e) {
    console.warn('[SkillImport] Playwright 渲染 ClawHub 页面失败:', e.message);
    return null;
  } finally {
    if (browser) browser.close().catch(() => {});
  }
}

/** 从页面 HTML 中提取下载 URL 和 skill 名称（正则 + 启发式） */
function extractFromPage(html, pageUrl) {
  const result = { skillName: null, downloadUrl: null };
  if (!html || typeof html !== 'string') return result;

  // ClawHub: [Download zip](https://...) 或 <a href="...">Download zip</a>
  const clawhubZip = html.match(/\[Download zip\]\s*\(\s*(https?:\/\/[^\s)]+)\s*\)/i);
  if (clawhubZip) result.downloadUrl = clawhubZip[1].trim();
  if (!result.downloadUrl) {
    const aTag = html.match(/<a[^>]+href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>[\s\S]*?Download\s*zip/i)
      || html.match(/Download\s*zip[\s\S]*?<a[^>]+href\s*=\s*["'](https?:\/\/[^"']+(?:download|convex)[^"']*)["']/i);
    if (aTag) result.downloadUrl = aTag[1].trim();
  }

  // GitHub clone: git clone https://github.com/owner/repo.git
  const githubClone = html.match(/git\s+clone\s+(https?:\/\/github\.com\/[^\s]+\.git)/i);
  if (githubClone) {
    const repoUrl = githubClone[1].replace(/\.git$/, '');
    const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (m) {
      result.downloadUrl = `https://github.com/${m[1]}/${m[2]}/archive/refs/heads/main.zip`;
      result.skillName = result.skillName || m[2];
    }
  }

  // 从 URL 提取 skill 名：clawhub.ai/owner/skill-name 或 github.com/owner/repo
  const urlMatch = pageUrl.match(/\/([^/]+)(?:\?|$)/);
  if (urlMatch) result.skillName = result.skillName || urlMatch[1];

  return result;
}

/** 使用 LLM 分析页面，提取 skillName 和 downloadUrl */
async function analyzeWithLLM(html, pageUrl, options = {}) {
  const { vendorId, modelId, apiKey } = options;
  if (!vendorId || !modelId || !apiKey) {
    return extractFromPage(html, pageUrl);
  }
  const provider = getProvider(vendorId);
  if (!provider || typeof provider.chat !== 'function') {
    return extractFromPage(html, pageUrl);
  }

  const truncated = html.slice(0, 12000);
  const prompt = `你是一个技能解析助手。根据以下网页内容，提取 skill 的下载信息及功能摘要。

【网页 URL】${pageUrl}

【网页内容（截断）】
${truncated}

请以 JSON 格式回复，且仅回复 JSON，不要其他文字：
{
  "skillName": "技能文件夹名，如 my-custom-skill、docker-m1-fixes、code-reviewer 等，根据页面推断",
  "downloadUrl": "zip 或源码的直链下载地址，优先使用 Download zip 链接，其次 GitHub archive（如 https://github.com/owner/repo/archive/refs/heads/main.zip）",
  "summary": "该 skill 的功能核心摘要，1-2 句中文，说明它能做什么、适用场景"
}

如果无法确定 downloadUrl，可留空。summary 尽量根据页面内容推断。`;

  try {
    const res = await provider.chat({
      apiKey: apiKey.trim(),
      modelId,
      messages: [
        { role: 'system', content: '你只输出合法 JSON，不要 markdown 代码块包裹。' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    });
    const text = (res.content || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.skillName) parsed.skillName = String(parsed.skillName).replace(/[\\/:*?"<>|]/g, '-');
      if (parsed.downloadUrl) parsed.downloadUrl = String(parsed.downloadUrl).trim();
      if (parsed.summary) parsed.summary = String(parsed.summary).trim();
      return parsed;
    }
  } catch (e) {
    console.warn('[SkillImport] LLM 分析失败，使用正则回退:', e.message);
  }
  return extractFromPage(html, pageUrl);
}

/** 下载文件到临时路径 */
async function downloadFile(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OpenAUI-SkillImport/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`下载失败: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

/** 解压 zip 到目标目录，删除 zip，规范化结构（GitHub 解压为 repo-main/ 时上移一层） */
function extractAndNormalize(zipBuffer, targetDir) {
  const parentDir = path.dirname(targetDir);
  const tempDir = path.join(parentDir, `_skill_tmp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const zipPath = path.join(tempDir, 'archive.zip');
  fs.writeFileSync(zipPath, zipBuffer);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tempDir, true);
  fs.unlinkSync(zipPath);

  const entries = fs.readdirSync(tempDir, { withFileTypes: true });
  let contentDir = tempDir;
  if (entries.length === 1 && entries[0].isDirectory()) {
    contentDir = path.join(tempDir, entries[0].name);
  }

  const items = fs.readdirSync(contentDir, { withFileTypes: true });
  for (const item of items) {
    const src = path.join(contentDir, item.name);
    const dest = path.join(targetDir, item.name);
    if (fs.existsSync(dest)) {
      if (item.isDirectory()) fs.rmSync(dest, { recursive: true });
      else fs.unlinkSync(dest);
    }
    fs.renameSync(src, dest);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
}

/** 将导入时 LLM 总结的功能摘要写入 SKILL.md frontmatter */
function appendImportSummary(skillDir, summary) {
  if (!summary || typeof summary !== 'string' || !summary.trim()) return;
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return;
  let content = fs.readFileSync(skillMd, 'utf8');
  const escaped = summary.replace(/\n/g, ' ').replace(/'/g, "''");
  const newLine = `importSummary: '${escaped}'`;
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (fmMatch) {
    const [, yamlStr, body] = fmMatch;
    if (/^importSummary:\s/m.test(yamlStr)) return;
    const updatedYaml = yamlStr.trimEnd() + '\n' + newLine + '\n';
    content = '---\n' + updatedYaml + '---\n' + body;
  } else {
    content = '---\n' + newLine + '\n---\n\n' + content;
  }
  fs.writeFileSync(skillMd, content, 'utf8');
}

/** 检查目录结构，必要时用 shell 修正 */
function ensureSkillStructure(skillDir) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillMd)) return true;

  const entries = fs.readdirSync(skillDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const subSkillMd = path.join(skillDir, e.name, 'SKILL.md');
      if (fs.existsSync(subSkillMd)) {
        try {
          const subPath = path.join(skillDir, e.name);
          const files = fs.readdirSync(subPath);
          for (const f of files) {
            fs.renameSync(path.join(subPath, f), path.join(skillDir, f));
          }
          fs.rmdirSync(subPath);
          return true;
        } catch (err) {
          console.warn('[SkillImport] 移动子目录失败:', err.message);
        }
      }
    }
  }
  return false;
}

/**
 * 从 URL 导入 skill
 * @param {string} url - ClawHub/GitHub 等页面 URL
 * @param {object} options - { vendorId, modelId } 可选，用于 LLM 分析
 * @returns {{ success: boolean, skillName?: string, path?: string, error?: string }}
 */
async function importFromUrl(url, options = {}) {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return { success: false, error: '请提供有效的 URL' };
  }

  let pageUrl = trimmed;
  if (!/^https?:\/\//i.test(pageUrl)) pageUrl = 'https://' + pageUrl;

  const cfg = readSkillsLibraryConfig();
  const skillsDir = resolveSkillsFolder(cfg.skillsFolder || 'data/skills');
  if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });

  try {
    let skillName = null;
    let downloadUrl = null;
    let extracted = null;

    if (/github\.com\/[^/]+\/[^/]+/i.test(pageUrl) && !/archive.*\.zip/i.test(pageUrl)) {
      const m = pageUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
      if (m) {
        skillName = m[2].replace(/\.git$/, '');
        let res = await fetch(`https://github.com/${m[1]}/${m[2]}/archive/refs/heads/main.zip`, { method: 'HEAD' });
        downloadUrl = res.ok
          ? `https://github.com/${m[1]}/${m[2]}/archive/refs/heads/main.zip`
          : `https://github.com/${m[1]}/${m[2]}/archive/refs/heads/master.zip`;
      }
    }

    if (!downloadUrl) {
      let html = null;
      let playwrightDownloadUrl = null;
      const isClawhub = /clawhub\.ai/i.test(pageUrl);

      if (isClawhub) {
        const pw = await fetchClawhubWithPlaywright(pageUrl);
        if (pw) {
          html = pw.html;
          playwrightDownloadUrl = pw.downloadUrl;
        }
      }
      if (!html) {
        const res = await fetch(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenAUI/1.0)' },
          redirect: 'follow',
        });
        if (!res.ok) throw new Error(`获取页面失败: ${res.status}`);
        html = await res.text();
      }

      const modelCfg = options.vendorId && options.modelId
        ? { vendorId: options.vendorId, modelId: options.modelId, apiKey: readApiKeys()[options.vendorId] }
        : readSection('skill')?.quick
          ? (() => {
              const q = readSection('skill').quick;
              const v = q?.vendorId;
              const m = q?.modelId;
              const k = v ? readApiKeys()[v] : null;
              return v && m && k ? { vendorId: v, modelId: m, apiKey: k } : null;
            })()
          : null;

      extracted = await analyzeWithLLM(html, pageUrl, modelCfg);
      skillName = extracted.skillName || skillName;
      downloadUrl = playwrightDownloadUrl || extracted.downloadUrl || downloadUrl;

      if (!downloadUrl && isClawhub) {
        throw new Error(
          '无法从 ClawHub 页面解析下载地址。ClawHub 为 SPA，需 Playwright 渲染。请执行：cd backend && npm run playwright:install'
        );
      }
    }

    if (!downloadUrl) throw new Error('无法从页面解析出下载地址，请确认 URL 有效或提供直链');

    skillName = (skillName || 'skill-' + Date.now()).replace(/[\\/:*?"<>|]/g, '-');
    const targetDir = path.join(skillsDir, skillName);

    if (fs.existsSync(targetDir)) {
      const existing = fs.readdirSync(targetDir);
      if (existing.length > 0) {
        const backup = targetDir + '.bak.' + Date.now();
        fs.renameSync(targetDir, backup);
      }
    }
    fs.mkdirSync(targetDir, { recursive: true });

    const zipBuffer = await downloadFile(downloadUrl);
    extractAndNormalize(zipBuffer, targetDir);

    if (!ensureSkillStructure(targetDir)) {
      if (!fs.existsSync(path.join(targetDir, 'SKILL.md'))) {
        return { success: false, error: '解压后未找到 SKILL.md，请检查下载源' };
      }
    }

    if (extracted?.summary) {
      appendImportSummary(targetDir, extracted.summary);
    }

    return { success: true, skillName, path: targetDir };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

/** 判断 URL 是否为有效 skill 链接（排除 assets、.js、.css 等） */
function isSkillUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const path = u.pathname || '';
    if (u.hostname.includes('clawhub.ai')) {
      if (path.includes('/assets/') || path.includes('/upload') || path.match(/\/skills\?/)) return false;
      if (/\.(js|css|map|json|ico|png|jpg|svg|woff2?)$/i.test(path)) return false;
      return /^\/[^/]+\/[^/]+/.test(path);
    }
    if (u.hostname.includes('github.com')) {
      if (path.includes('/blob/') || path.includes('/tree/') || path.includes('/search')) return false;
      return /^\/[^/]+\/[^/]+$/.test(path.replace(/\/$/, ''));
    }
  } catch (_) {}
  return false;
}

/** 从 HTML 或链接列表中过滤出有效 skill 链接 */
function filterSkillLinks(urls) {
  return (urls || []).filter((u) => isSkillUrl(u));
}

/**
 * 从 HTML 中提取 skill 相关链接（ClawHub、GitHub 等），排除 assets/.js/.css
 */
function extractSkillLinksFromHtml(html, baseUrl) {
  const links = new Set();
  if (!html || typeof html !== 'string') return [];
  let baseOrigin = 'https://clawhub.ai';
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch (_) {}
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    try {
      const u = href.startsWith('http') ? new URL(href) : new URL(href, baseOrigin + '/');
      if (isSkillUrl(u.href)) links.add(u.href);
    } catch (_) {}
  }
  const urlRe = /https?:\/\/(?:clawhub\.ai\/[^/]+\/[^\s"'<>)]+|github\.com\/[^/]+\/[^\s"'<>)]+)/gi;
  let urlMatch;
  while ((urlMatch = urlRe.exec(html)) !== null) {
    let u = urlMatch[0].replace(/[)\]\}>"']+$/, '');
    if (u.includes('github.com')) u = u.replace(/\/blob\/[^/]+/, '').replace(/\/tree\/[^/]+/, '');
    if (isSkillUrl(u)) links.add(u);
  }
  return filterSkillLinks(Array.from(links));
}

/**
 * 发送流式事件（若提供了 emit）
 */
function emitEvent(emit, event) {
  if (emit && typeof emit === 'function') {
    try {
      emit(event);
    } catch (_) {}
  }
}

/** 获取 LLM 配置 */
function getLLMOptions(options) {
  const { readApiKeys } = require('../../apikeys-store');
  return options.vendorId && options.modelId
    ? { ...options, apiKey: options.apiKey || readApiKeys()[options.vendorId] }
    : (() => {
        const q = readSection('skill')?.quick;
        const v = q?.vendorId;
        const m = q?.modelId;
        const k = v ? readApiKeys()[v] : null;
        return v && m && k ? { vendorId: v, modelId: m, apiKey: k } : null;
      })();
}

/** 检测是否包含中文字符 */
function hasChinese(str) {
  return /[\u4e00-\u9fff]/.test(str || '');
}

/** 中文→英文关键词兜底映射（LLM 不可用时仍能执行英文搜索） */
function fallbackZhToEn(query) {
  const map = {
    自媒体: ['media', 'content'],
    运营: ['marketing', 'operation'],
    内容: ['content'],
    创作: ['create', 'creative'],
    社交: ['social'],
    媒体: ['media'],
    营销: ['marketing'],
    视频: ['video'],
    写作: ['writing', 'write'],
    剪辑: ['edit', 'video'],
  };
  const q = (query || '').trim();
  const out = new Set();
  for (const [zh, enList] of Object.entries(map)) {
    if (q.includes(zh)) enList.forEach((e) => out.add(e));
  }
  return out.size > 0 ? [...out].slice(0, 3) : ['media', 'content', 'social'];
}

/** LLM 解析用户需求 → 关键词数组（每词 2-3 字，逐个搜索） */
async function extractKeywordsFromQuery(query, options = {}) {
  const llm = getLLMOptions(options);
  const q = query.trim().slice(0, 20);
  const fallback = q ? [q] : [];
  if (!llm?.vendorId || !llm?.modelId || !llm?.apiKey) return fallback;
  const provider = getProvider(llm.vendorId);
  if (!provider?.chat) return fallback;
  try {
    const res = await provider.chat({
      apiKey: llm.apiKey.trim(),
      modelId: llm.modelId,
      messages: [
        { role: 'system', content: '你只输出搜索关键词，不要其他文字。从用户需求提取 1-3 个关键词，每个 strictly 2-3 个汉字（或英文 2-4 字母），用空格分隔。将逐个单独搜索。' },
        { role: 'user', content: `用户需求：${query}\n\n请输出 1-3 个简短关键词（每词2-3字，空格分隔）：` },
      ],
      stream: false,
    });
    const kw = (res.content || '').trim().replace(/\s+/g, ' ');
    const list = kw.split(/\s+/).filter((s) => s.length > 0 && s.length <= 6).map((s) => s.slice(0, 6)).slice(0, 3);
    return list.length > 0 ? list : fallback;
  } catch (e) {
    console.warn('[SkillImport] 关键词解析失败:', e.message);
    return fallback;
  }
}

/** LLM 将中文需求转为英文关键词数组（用于无结果时重试，逐个搜索） */
async function extractKeywordsAsEnglish(query, options = {}) {
  const llm = getLLMOptions(options);
  if (!llm?.vendorId || !llm?.modelId || !llm?.apiKey) return null;
  const provider = getProvider(llm.vendorId);
  if (!provider?.chat) return null;
  try {
    const res = await provider.chat({
      apiKey: llm.apiKey.trim(),
      modelId: llm.modelId,
      messages: [
        { role: 'system', content: '你只输出英文搜索关键词，不要其他文字。将用户需求转化为 1-3 个英文关键词，用空格分隔，每个不超过 15 字符。将逐个单独搜索。' },
        { role: 'user', content: `用户需求：${query}\n\n请输出 1-3 个英文关键词（空格分隔）：` },
      ],
      stream: false,
    });
    const kw = (res.content || '').trim().replace(/\s+/g, ' ');
    const list = kw.split(/\s+/).filter((s) => s.length > 0).map((s) => s.slice(0, 15)).slice(0, 3);
    return list.length > 0 ? list : null;
  } catch (e) {
    console.warn('[SkillImport] 英文关键词解析失败:', e.message);
    return null;
  }
}

/** 2-3 字中文关键词（无结果时最后重试） */
async function extractKeywordsShortZh(query, options = {}) {
  const llm = getLLMOptions(options);
  if (!llm?.vendorId || !llm?.modelId || !llm?.apiKey) return null;
  const provider = getProvider(llm.vendorId);
  if (!provider?.chat) return null;
  try {
    const res = await provider.chat({
      apiKey: llm.apiKey.trim(),
      modelId: llm.modelId,
      messages: [
        { role: 'system', content: '你只输出搜索关键词，不要其他文字。从用户需求提取 1-3 个关键词，每个 strictly 2-3 个汉字，用空格分隔。' },
        { role: 'user', content: `用户需求：${query}\n\n请输出 1-3 个关键词（每词2-3字，空格分隔）：` },
      ],
      stream: false,
    });
    const kw = (res.content || '').trim().replace(/\s+/g, ' ');
    const list = kw.split(/\s+/).filter((s) => /^[\u4e00-\u9fff]{2,3}$/.test(s)).slice(0, 3);
    return list.length > 0 ? list : null;
  } catch (e) {
    console.warn('[SkillImport] 短中文关键词解析失败:', e.message);
    return null;
  }
}

/** 2-3 字符英文关键词（无结果时最后重试） */
async function extractKeywordsShortEn(query, options = {}) {
  const llm = getLLMOptions(options);
  if (!llm?.vendorId || !llm?.modelId || !llm?.apiKey) return null;
  const provider = getProvider(llm.vendorId);
  if (!provider?.chat) return null;
  try {
    const res = await provider.chat({
      apiKey: llm.apiKey.trim(),
      modelId: llm.modelId,
      messages: [
        { role: 'system', content: '你只输出英文搜索关键词，不要其他文字。从用户需求提取 1-3 个极短英文关键词，每个 2-4 个字母（如 media->med, skill->sk），用空格分隔。' },
        { role: 'user', content: `用户需求：${query}\n\n请输出 1-3 个极短英文关键词（2-4字母，空格分隔）：` },
      ],
      stream: false,
    });
    const kw = (res.content || '').trim().replace(/\s+/g, ' ');
    const list = kw.split(/\s+/).filter((s) => /^[a-zA-Z]{2,6}$/.test(s)).slice(0, 3);
    return list.length > 0 ? list : null;
  } catch (e) {
    console.warn('[SkillImport] 短英文关键词解析失败:', e.message);
    return null;
  }
}

/** 使用 Playwright 在单个源站执行搜索：打开页面 → 找搜索框 → 输入关键词 → 提取结果 */
async function searchOneSourceWithBrowser(src, keywords, options = {}) {
  const emit = options.emit;
  let sessionManager;
  try {
    sessionManager = require('../../browser/sessionManager');
  } catch (_) {
    return [];
  }
  const { launchBrowser, BROWSER_TIMEOUT_MS, playwright } = sessionManager;
  if (!playwright) return [];

  const url = (src.url || src).trim();
  if (!url) return [];
  const fullUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  const srcName = src.name || fullUrl;

  let browser;
  try {
    browser = await launchBrowser();
    if (!browser) return [];
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    emitEvent(emit, { type: 'log', message: `[${srcName}] 打开页面`, detail: fullUrl });
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT_MS });

    const { extractInteractiveElements, buildSelector } = require('../../browser/domParser');
    const elements = await extractInteractiveElements(page);
    const searchInput = elements.find(
      (el) =>
        (el.tag === 'input' && (el.type === 'text' || el.type === 'search' || !el.type)) &&
        (/search|搜索|查找|keyword|skill|skills/i.test(el.placeholder || '') || /search|q|keyword/i.test(el.name || ''))
    ) || elements.find((el) => el.tag === 'input' && (el.type === 'text' || el.type === 'search'));

    if (searchInput) {
      emitEvent(emit, { type: 'log', message: `[${srcName}] 找到搜索框`, detail: `placeholder="${searchInput.placeholder || ''}"，输入关键词` });
      const selector = buildSelector ? buildSelector(searchInput) : (searchInput.selector || `input[type="${searchInput.type || 'text'}"]`);
      try {
        const loc = page.locator(selector).first();
        await loc.waitFor({ state: 'visible', timeout: 5000 });
        await loc.fill(keywords);
        await loc.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1500));
        emitEvent(emit, { type: 'log', message: `[${srcName}] 执行搜索完成`, detail: `关键词：${keywords}` });
      } catch (fillErr) {
        try {
          const byPlaceholder = page.getByPlaceholder(/search|搜索|skill/i).first();
          await byPlaceholder.fill(keywords);
          await byPlaceholder.press('Enter');
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 1500));
          emitEvent(emit, { type: 'log', message: `[${srcName}] 执行搜索完成（备用）`, detail: `关键词：${keywords}` });
        } catch (_) {
          emitEvent(emit, { type: 'log', message: `[${srcName}] 搜索框输入失败，使用当前列表`, detail: fillErr?.message || '' });
        }
      }
    } else {
      emitEvent(emit, { type: 'log', message: `[${srcName}] 未找到搜索框，使用当前列表页`, detail: 'extractInteractiveElements 未匹配到搜索输入' });
    }

    const links = await page.evaluate(() => {
      const as = document.querySelectorAll('a[href]');
      const out = [];
      const base = window.location.origin;
      for (const a of as) {
        let href = (a.getAttribute('href') || '').trim();
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
        try {
          const u = href.startsWith('http') ? new URL(href) : new URL(href, base);
          const path = u.pathname || '';
          if (u.hostname.includes('clawhub.ai') && !path.includes('/assets/') && !/\.(js|css|map)$/i.test(path) && /^\/[^/]+\/[^/]+/.test(path)) {
            out.push(u.href);
          }
          if (u.hostname.includes('github.com') && !path.includes('/blob/') && !path.includes('/tree/') && !path.includes('/search') && /^\/[^/]+\/[^/]+$/.test(path.replace(/\/$/, ''))) {
            out.push(u.href);
          }
        } catch (_) {}
      }
      return [...new Set(out)];
    });

    emitEvent(emit, { type: 'log', message: `[${srcName}] 解析完成`, detail: `从渲染 DOM 提取到 ${links.length} 个 skill 链接` });
    return links;
  } catch (e) {
    emitEvent(emit, { type: 'log', message: `[${srcName}] 浏览器搜索异常`, detail: e?.message || String(e) });
    console.warn('[SkillImport] 浏览器搜索失败:', fullUrl, e.message);
    return [];
  } finally {
    if (browser) browser.close().catch(() => {});
  }
}

/** 使用 fetch 抓取（GitHub 搜索等无需渲染的页面） */
async function searchOneSourceWithFetch(src, keywords, options = {}) {
  const emit = options.emit;
  const url = (src.url || src).trim();
  if (!url) return [];
  const fullUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  const srcName = src.name || fullUrl;

  let fetchUrl = fullUrl;
  if (fullUrl.includes('github.com')) {
    const q = encodeURIComponent(`SKILL.md ${keywords}`);
    fetchUrl = `https://github.com/search?q=${q}&type=repositories`;
    emitEvent(emit, { type: 'log', message: `[${srcName}] GitHub 搜索`, detail: `fetch(${fetchUrl})` });
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenAUI-SkillImport/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) {
      emitEvent(emit, { type: 'log', message: `[${srcName}] 抓取失败 ${res.status}` });
      return [];
    }
    const html = await res.text();
    const links = extractSkillLinksFromHtml(html, fetchUrl);
    emitEvent(emit, { type: 'log', message: `[${srcName}] 解析完成`, detail: `extractSkillLinksFromHtml 提取到 ${links.length} 个 skill 链接` });
    return links;
  } catch (e) {
    emitEvent(emit, { type: 'log', message: `[${srcName}] 抓取异常`, detail: e?.message || String(e) });
    return [];
  }
}

/**
 * AI 自动搜索：根据用户需求，从配置的 skill 源站抓取并返回匹配的 skill 候选
 * 流程：LLM 解析关键词 → 并发打开各源站 → 找搜索框执行搜索 → 提取链接 → LLM 筛选
 * @param {string} query - 用户需求描述
 * @param {object} options - { vendorId, modelId, emit?: (event) => void }
 * @param {Function} options.emit - 流式输出回调，接收 { type, message?, step?, detail?, candidates?, error? }
 * @returns {{ candidates: Array<{ url, skillName?, summary? }> }}
 */
async function autoSearch(query, options = {}) {
  const emit = options.emit;

  const cfg = readSkillsLibraryConfig();
  const sources = cfg.skillSourceUrls || [];
  if (sources.length === 0) {
    emitEvent(emit, { type: 'error', error: '请先配置 skill 源站（在 AI 自动抓取弹窗中）' });
    return { candidates: [], error: '请先配置 skill 源站（在 AI 自动抓取弹窗中）' };
  }

  emitEvent(emit, { type: 'step', step: 'init', message: '开始搜索', detail: `用户需求：${query}；流程：LLM 解析关键词 → 并发打开 ${sources.length} 个源站 → 找搜索框执行搜索 → 提取 skill 链接 → LLM 筛选` });

  emitEvent(emit, { type: 'step', step: 'keywords', message: '解析搜索关键词', detail: 'extractKeywordsFromQuery 返回 1-3 个关键词，每个将单独搜索' });
  const keywordList = await extractKeywordsFromQuery(query, options);
  emitEvent(emit, { type: 'log', message: `关键词（逐个搜索）：${keywordList.join('、')}` });

  emitEvent(emit, { type: 'step', step: 'browser', message: '逐个关键词搜索', detail: `每个源站 × 每个关键词，共 ${sources.length}×${keywordList.length} 次搜索` });

  let sessionManager;
  try {
    sessionManager = require('../../browser/sessionManager');
  } catch (_) {}
  const hasPlaywright = !!(sessionManager?.playwright);

  const allLinks = [];
  for (const src of sources) {
    const url = (src.url || src).trim();
    if (!url) continue;
    const fullUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    const srcName = src.name || fullUrl;
    for (const kw of keywordList) {
      emitEvent(emit, { type: 'log', message: `[${srcName}] 搜索「${kw}」`, detail: fullUrl });
      let links = [];
      if (hasPlaywright && fullUrl.includes('clawhub.ai')) {
        links = await searchOneSourceWithBrowser(src, kw, options);
      } else if (fullUrl.includes('github.com')) {
        links = await searchOneSourceWithFetch(src, kw, options);
      } else if (hasPlaywright) {
        links = await searchOneSourceWithBrowser(src, kw, options);
      } else {
        links = await searchOneSourceWithFetch(src, kw, options);
      }
      for (const link of links) allLinks.push({ url: link, source: srcName });
    }
  }

  const usedKeywords = new Set(keywordList.map((k) => String(k).trim().toLowerCase()));
  let uniqueUrls = [...new Set(allLinks.map((x) => x.url))];

  async function runSearchWithKeywords(kwList, roundLabel) {
    if (!kwList || kwList.length === 0) return;
    const toSearch = kwList.filter((k) => {
      const key = String(k).trim().toLowerCase();
      if (usedKeywords.has(key)) return false;
      usedKeywords.add(key);
      return true;
    });
    if (toSearch.length === 0) {
      emitEvent(emit, { type: 'log', message: `${roundLabel} 关键词已全部搜索过，跳过`, detail: '' });
      return;
    }
    if (toSearch.length < kwList.length) {
      const skipped = kwList.filter((k) => !toSearch.includes(k));
      emitEvent(emit, { type: 'log', message: `去重后搜索：${toSearch.join('、')}`, detail: skipped.length ? `跳过重复：${skipped.join('、')}` : '' });
    }
    for (const src of sources) {
      const url = (src.url || src).trim();
      if (!url) continue;
      const fullUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
      const srcName = src.name || fullUrl;
      for (const kw of toSearch) {
        emitEvent(emit, { type: 'log', message: `${roundLabel}[${srcName}] 搜索「${kw}」`, detail: fullUrl });
        let links = [];
        if (hasPlaywright && fullUrl.includes('clawhub.ai')) {
          links = await searchOneSourceWithBrowser(src, kw, options);
        } else if (fullUrl.includes('github.com')) {
          links = await searchOneSourceWithFetch(src, kw, options);
        } else if (hasPlaywright) {
          links = await searchOneSourceWithBrowser(src, kw, options);
        } else {
          links = await searchOneSourceWithFetch(src, kw, options);
        }
        for (const link of links) allLinks.push({ url: link, source: srcName });
      }
    }
  }

  if (hasChinese(query)) {
    emitEvent(emit, { type: 'log', message: 'Round 2：英文关键词补充', detail: '' });
    let enKeywordList = await extractKeywordsAsEnglish(query, options);
    if (!enKeywordList?.length) {
      enKeywordList = fallbackZhToEn(query);
      emitEvent(emit, { type: 'log', message: `LLM 英文解析失败，使用兜底：${enKeywordList.join('、')}` });
    } else {
      emitEvent(emit, { type: 'log', message: `英文：${enKeywordList.join('、')}` });
    }
    await runSearchWithKeywords(enKeywordList, '英文');
  }

  emitEvent(emit, { type: 'log', message: 'Round 3：2-3 字中文补充', detail: '' });
  let shortZhList = await extractKeywordsShortZh(query, options);
  if (!shortZhList?.length) {
    const zhMatch = (query || '').match(/[\u4e00-\u9fff]{2,3}/g);
    shortZhList = zhMatch ? [...new Set(zhMatch)].slice(0, 3) : [];
    if (shortZhList.length) emitEvent(emit, { type: 'log', message: `LLM 短中文解析失败，使用兜底：${shortZhList.join('、')}` });
  } else {
    emitEvent(emit, { type: 'log', message: `短中文：${shortZhList.join('、')}` });
  }
  await runSearchWithKeywords(shortZhList, '短中文');

  emitEvent(emit, { type: 'log', message: 'Round 4：2-4 字母英文补充', detail: '' });
  let shortEnList = await extractKeywordsShortEn(query, options);
  if (!shortEnList?.length) {
    shortEnList = fallbackZhToEn(query).map((w) => w.slice(0, 4)).filter((w) => w.length >= 2);
    shortEnList = [...new Set(shortEnList)].slice(0, 3);
    if (shortEnList.length) emitEvent(emit, { type: 'log', message: `LLM 短英文解析失败，使用兜底：${shortEnList.join('、')}` });
  } else {
    emitEvent(emit, { type: 'log', message: `短英文：${shortEnList.join('、')}` });
  }
  await runSearchWithKeywords(shortEnList, '短英文');

  uniqueUrls = [...new Set(allLinks.map((x) => x.url))];
  emitEvent(emit, { type: 'step', step: 'parse', message: '链接去重', detail: `共 ${uniqueUrls.length} 个唯一 skill 链接` });

  if (uniqueUrls.length === 0) {
    const hint = hasPlaywright
      ? '已尝试中文、英文、短中文、短英文关键词，均无结果。请检查源站或换其他需求。'
      : 'ClawHub 等 SPA 需 Playwright 渲染，请执行：cd backend && npm run playwright:install';
    emitEvent(emit, { type: 'error', error: `未从配置的源站解析到 skill 链接。${hint}` });
    return { candidates: [], error: `未解析到 skill 链接。${hint}` };
  }

  const llm = getLLMOptions(options);
  if (!llm?.vendorId || !llm?.modelId || !llm?.apiKey) {
    emitEvent(emit, { type: 'log', message: '未配置模型 API，跳过 AI 筛选', detail: '使用前 10 个链接作为候选' });
    const candidates = uniqueUrls.slice(0, 10).map((url) => ({ url, skillName: null, summary: '需配置模型 API 以启用 AI 筛选' }));
    emitEvent(emit, { type: 'candidates', candidates });
    return { candidates, error: null };
  }

  const provider = getProvider(llm.vendorId);
  if (!provider || typeof provider.chat !== 'function') {
    const candidates = uniqueUrls.slice(0, 10).map((url) => ({ url, skillName: null, summary: null }));
    emitEvent(emit, { type: 'candidates', candidates });
    return { candidates, error: null };
  }

  emitEvent(emit, { type: 'step', step: 'llm', message: 'AI 筛选', detail: `getProvider().chat() 调用 ${llm.vendorId}/${llm.modelId}，根据用户需求与链接列表筛选最匹配的 skill` });
  emitEvent(emit, { type: 'log', message: '调用 LLM 分析', detail: 'provider.chat({ apiKey, modelId, messages }) 非流式调用，解析返回的 JSON 数组' });

  const urlList = uniqueUrls.slice(0, 30).join('\n');
  const prompt = `用户需求：${query}

以下是从 skill 源站抓取到的链接（每行一个）：
${urlList}

请根据用户需求，筛选最匹配的 skill，按相关度排序，最多返回 5 个。
以 JSON 数组回复，且仅回复 JSON，不要其他文字：
[
  { "url": "完整 URL", "skillName": "技能名", "summary": "与用户需求的匹配说明，1 句中文" },
  ...
]`;

  try {
    const res = await provider.chat({
      apiKey: llm.apiKey.trim(),
      modelId: llm.modelId,
      messages: [
        { role: 'system', content: '你只输出合法 JSON 数组，不要 markdown 代码块包裹。' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    });
    emitEvent(emit, { type: 'log', message: 'LLM 返回完成', detail: '解析 JSON 数组' });
    const text = (res.content || '').trim();
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const parsed = JSON.parse(arrMatch[0]);
      const candidates = (Array.isArray(parsed) ? parsed : [])
        .filter((x) => x && x.url && isSkillUrl(x.url))
        .slice(0, 5)
        .map((x) => ({
          url: String(x.url).trim(),
          skillName: x.skillName ? String(x.skillName).trim() : null,
          summary: x.summary ? String(x.summary).trim() : null,
        }));
      emitEvent(emit, { type: 'log', message: `AI 筛选完成，共 ${candidates.length} 个匹配结果` });
      emitEvent(emit, { type: 'candidates', candidates });
      return { candidates, error: null };
    }
  } catch (e) {
    emitEvent(emit, { type: 'log', message: 'AI 筛选失败，使用前 5 个链接', detail: e?.message || String(e) });
    console.warn('[SkillImport] AI 筛选失败:', e.message);
  }

  const candidates = uniqueUrls.slice(0, 5).filter((u) => isSkillUrl(u)).map((url) => ({ url, skillName: null, summary: null }));
  emitEvent(emit, { type: 'candidates', candidates });
  return { candidates, error: null };
}

module.exports = { importFromUrl, extractFromPage, analyzeWithLLM, autoSearch };
