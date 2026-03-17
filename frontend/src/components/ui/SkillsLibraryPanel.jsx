/**
 * Skills 库面板 - 仓库风格
 * - 卡片网格展示已加载的 skills，点击进入测试
 * - 选中时：左侧列表 + 右侧模型测试区
 */
import { useEffect, useState } from 'react';
import { getSkillsList, getSkillsLibraryConfig, saveSkillsLibraryConfig, importSkillFromUrl, deleteSkill } from '../../api/skills';
import { SkillTestArea } from './SkillsLibraryPanel/SkillTestArea';
import { AutoSearchPanel } from './SkillsLibraryPanel/AutoSearchPanel';

const iconSkill = (
  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const iconSettings = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const iconRefresh = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const iconEmpty = (
  <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

export function SkillsLibraryPanel({ className = '' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState({
    skillsFolder: '',
    loadMode: 'folder',
    manualSkills: [],
    autoDownloadEnabled: false,
  });
  const [skillsFromFolder, setSkillsFromFolder] = useState([]);
  const [folderInput, setFolderInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [autoSearchOpen, setAutoSearchOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cfg, skills] = await Promise.all([
        getSkillsLibraryConfig(),
        getSkillsList({ folder: '' }),
      ]);
      setConfig({
        skillsFolder: cfg.skillsFolder || '',
        loadMode: cfg.loadMode || 'folder',
        manualSkills: Array.isArray(cfg.manualSkills) ? cfg.manualSkills : [],
        autoDownloadEnabled: Boolean(cfg.autoDownloadEnabled),
      });
      setFolderInput(cfg.skillsFolder || '');
      setSkillsFromFolder(skills || []);
    } catch (e) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await saveSkillsLibraryConfig({
        skillsFolder: folderInput.trim() || config.skillsFolder,
        loadMode: config.loadMode,
        manualSkills: config.manualSkills,
        autoDownloadEnabled: config.autoDownloadEnabled,
      });
      setConfig(next);
      setFolderInput(next.skillsFolder || '');
      setSkillsFromFolder(await getSkillsList({ folder: next.skillsFolder }));
    } catch (e) {
      setError(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshFolder = async () => {
    setLoading(true);
    setError('');
    try {
      const skills = await getSkillsList({ folder: folderInput.trim() || config.skillsFolder });
      setSkillsFromFolder(skills);
    } catch (e) {
      setError(e?.message || '刷新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadModeChange = (mode) => {
    setConfig((prev) => ({ ...prev, loadMode: mode }));
  };

  const handleAutoSearchImported = () => {
    load();
  };

  const handleDeleteSkill = async (e, skill) => {
    e?.stopPropagation?.();
    const loc = skill.location || skill.path;
    if (!loc) return;
    if (!window.confirm(`确定删除「${skill.name || '未命名'}」？此操作不可恢复。`)) return;
    setDeletingId(loc);
    setError('');
    try {
      await deleteSkill(loc);
      load();
    } catch (e) {
      setError(e?.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportFromUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setError('');
    setImportSuccess('');
    try {
      const res = await importSkillFromUrl(url);
      if (res.success) {
        setImportSuccess(`已导入: ${res.skillName}`);
        setImportUrl('');
        load();
        setTimeout(() => setImportSuccess(''), 3000);
      } else {
        setError(res.error || '导入失败');
      }
    } catch (e) {
      setError(e?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const displaySkills = config.loadMode === 'folder' ? skillsFromFolder : config.manualSkills;
  const filteredSkills = searchQuery.trim()
    ? displaySkills.filter((s) => {
        const q = searchQuery.toLowerCase();
        const name = (s.name || s.id || '').toLowerCase();
        const desc = (s.description || s.importSummary || '').toLowerCase();
        const body = (s.body || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || body.includes(q);
      })
    : displaySkills;

  return (
    <div className={`flex-1 w-full flex flex-col min-h-0 overflow-hidden bg-[#f6f8fa] ${className}`}>
      {/* 顶部栏：标题 + 搜索 + 操作 */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200/80 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">Skills 库</h1>
              <p className="text-xs text-gray-500">
                {displaySkills.length} 个 skill · {config.loadMode === 'folder' ? '文件夹加载' : '手动配置'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-2xl justify-end">
            <div className="flex-1 flex gap-2 min-w-0">
              <input
                type="text"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
                placeholder="粘贴 ClawHub/GitHub 地址，从 URL 导入..."
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50/80 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <button
                type="button"
                onClick={handleImportFromUrl}
                disabled={importing || !importUrl.trim()}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
              >
                {importing ? '导入中...' : '导入'}
              </button>
            </div>
            <div className="relative w-56 flex-shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索 skills..."
                className="w-full pl-3 pr-9 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50/80 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {importSuccess && (
              <span className="text-xs text-green-600">{importSuccess}</span>
            )}
            <button
              type="button"
              onClick={() => setAutoSearchOpen(true)}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              AI 自动抓取
            </button>
            <button
              type="button"
              onClick={handleRefreshFolder}
              disabled={loading}
              title="刷新"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              {iconRefresh}
            </button>
            <button
              type="button"
              onClick={() => setConfigOpen((o) => !o)}
              title="配置"
              className={`p-2 rounded-lg transition-colors ${
                configOpen ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {iconSettings}
            </button>
          </div>
        </div>
        {error && !configOpen && (
          <div className="mt-2 text-sm text-red-500">{error}</div>
        )}

        {/* 可折叠配置区 */}
        {configOpen && (
          <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-4 animate-fade-in">
            {error && (
              <div className="text-sm text-red-500 px-3 py-1.5 rounded-lg bg-red-50">{error}</div>
            )}
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">加载方式</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="loadMode"
                      checked={config.loadMode === 'folder'}
                      onChange={() => handleLoadModeChange('folder')}
                      className="w-4 h-4 text-gray-600"
                    />
                    <span className="text-sm text-gray-700">从文件夹加载</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="loadMode"
                      checked={config.loadMode === 'manual'}
                      onChange={() => handleLoadModeChange('manual')}
                      className="w-4 h-4 text-gray-600"
                    />
                    <span className="text-sm text-gray-700">手动配置</span>
                  </label>
                </div>
              </div>
              {config.loadMode === 'folder' && (
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Skills 文件夹</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={folderInput}
                      onChange={(e) => setFolderInput(e.target.value)}
                      placeholder="data/skills（相对 backend 根目录）"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 主内容：选中时左侧列表 + 右侧测试，否则网格 */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {selectedSkill ? (
          <>
            {/* 左侧：Skills 列表（紧凑） */}
            <aside className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200/80 bg-white overflow-hidden">
              <div className="flex-shrink-0 px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-500">
                Skills 列表
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredSkills.map((s, i) => {
                  const isSelected = (selectedSkill?.location || selectedSkill?.path) === (s.location || s.path);
                  const canTest = s.location || s.path;
                  return (
                    <div
                      key={i}
                      onClick={() => canTest && setSelectedSkill(s)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-gray-200 text-gray-800' : 'hover:bg-gray-100 text-gray-600'
                      } ${!canTest ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex-1 min-w-0 truncate text-sm font-medium">
                        {s.name || s.id || '未命名'}
                      </div>
                      {config.loadMode === 'folder' && (s.location || s.path) && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSkill(e, s)}
                          disabled={deletingId === (s.location || s.path)}
                          title="删除"
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
            {/* 右侧：模型测试区 */}
            <div className="flex-1 min-w-0 p-4 overflow-hidden">
              <SkillTestArea
                skill={selectedSkill}
                onBack={() => setSelectedSkill(null)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading && displaySkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="w-12 h-12 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-4" />
                <p className="text-sm">加载 skills 中...</p>
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                {iconEmpty}
                <p className="mt-4 text-sm font-medium text-gray-500">
                  {searchQuery.trim()
                    ? '未找到匹配的 skill'
                    : config.loadMode === 'folder'
                      ? '文件夹下暂无有效 skills'
                      : '暂无手动配置的 skills'}
                </p>
                <p className="mt-1 text-xs text-gray-400 max-w-sm text-center">
                  {config.loadMode === 'folder'
                    ? '将包含 SKILL.md 的子目录放入配置的文件夹，点击刷新即可'
                    : '在配置文件中添加 manualSkills 数组'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSkills.map((s, i) => {
                  const canDelete = config.loadMode === 'folder' && (s.location || s.path);
                  const canTest = s.location || s.path;
                  const isDeleting = deletingId === (s.location || s.path);
                  return (
                    <div
                      key={i}
                      onClick={() => canTest && setSelectedSkill(s)}
                      className={`group relative flex flex-col p-4 rounded-xl bg-white border border-gray-200/80 transition-all duration-200 ${
                        canTest ? 'cursor-pointer hover:border-gray-300 hover:shadow-md' : 'opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">{iconSkill}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-800 truncate group-hover:text-gray-600 transition-colors">
                            {s.name || s.id || '未命名'}
                            {canTest && (
                              <span className="ml-1 text-[10px] text-gray-400 font-normal">点击测试</span>
                            )}
                          </h3>
                          {(s.description || s.importSummary) ? (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-2" title={s.importSummary ? `导入摘要：${s.importSummary}` : undefined}>
                              {s.description || s.importSummary}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-gray-400 italic">无描述</p>
                          )}
                          {(s.location || s.path) && (
                            <p className="mt-2 text-[11px] font-mono text-gray-400 truncate" title={s.location || s.path}>
                              {s.location || s.path}
                            </p>
                          )}
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSkill(e, s)}
                            disabled={isDeleting}
                            title="删除"
                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <AutoSearchPanel
        open={autoSearchOpen}
        onClose={() => setAutoSearchOpen(false)}
        onImported={handleAutoSearchImported}
      />
    </div>
  );
}
