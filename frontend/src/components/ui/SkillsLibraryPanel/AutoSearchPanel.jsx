/**
 * AI 自动抓取弹窗 - 右侧滑出
 * 配置 skill 源站、搜索、AI 筛选、一键导入
 */
import { useState, useEffect, useRef } from 'react';
import { autoSearchSkillsStream, importSkillFromUrl, getSkillsLibraryConfig, saveSkillsLibraryConfig } from '../../../api/skills';

const iconClose = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const iconSearch = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const iconAdd = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const iconDelete = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export function AutoSearchPanel({ open, onClose, onImported }) {
  const [sources, setSources] = useState([]);
  const [newSource, setNewSource] = useState({ name: '', url: '' });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [importingUrl, setImportingUrl] = useState(null);
  const [savingSources, setSavingSources] = useState(false);
  const [searchLogs, setSearchLogs] = useState([]);
  const logEndRef = useRef(null);

  const loadSources = async () => {
    try {
      const cfg = await getSkillsLibraryConfig();
      const urls = cfg.skillSourceUrls;
      setSources(Array.isArray(urls) && urls.length > 0 ? urls : [
        { name: 'ClawHub', url: 'https://clawhub.ai/skills' },
        { name: 'GitHub Skills', url: 'https://github.com/search?q=SKILL.md&type=repositories' },
      ]);
    } catch (_) {
      setSources([
        { name: 'ClawHub', url: 'https://clawhub.ai/skills' },
        { name: 'GitHub Skills', url: 'https://github.com/search?q=SKILL.md&type=repositories' },
      ]);
    }
  };

  useEffect(() => {
    if (open) {
      loadSources();
      setCandidates([]);
      setSearchError('');
    }
  }, [open]);

  const handleAddSource = () => {
    const name = (newSource.name || '').trim();
    const url = (newSource.url || '').trim();
    if (!url) return;
    const next = [...sources, { name: name || url, url }];
    setSources(next);
    setNewSource({ name: '', url: '' });
    saveSources(next);
  };

  const handleRemoveSource = (i) => {
    const next = sources.filter((_, idx) => idx !== i);
    setSources(next);
    saveSources(next);
  };

  const saveSources = async (list) => {
    setSavingSources(true);
    try {
      await saveSkillsLibraryConfig({ skillSourceUrls: list });
    } catch (_) {}
    setSavingSources(false);
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setCandidates([]);
    setSearchLogs([]);
    try {
      const res = await autoSearchSkillsStream(q, {
        onEvent: (event) => {
          setSearchLogs((prev) => {
            const entry = { id: Date.now() + Math.random(), ...event };
            return [...prev, entry];
          });
        },
      });
      setCandidates(res.candidates || []);
      if (res.error) setSearchError(res.error);
    } catch (e) {
      setSearchError(e?.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [searchLogs]);

  const handleImport = async (candidate) => {
    const url = candidate.url;
    if (!url) return;
    setImportingUrl(url);
    try {
      const res = await importSkillFromUrl(url);
      if (res.success) {
        setCandidates((prev) => prev.filter((c) => c.url !== url));
        onImported?.();
      } else {
        setSearchError(res.error || '导入失败');
      }
    } catch (e) {
      setSearchError(e?.message || '导入失败');
    } finally {
      setImportingUrl(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-white shadow-xl z-50 flex flex-col animate-slide-in-right"
        role="dialog"
        aria-label="AI 自动抓取"
      >
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">AI 自动抓取</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            {iconClose}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 源站配置 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Skill 源站</h3>
            <p className="text-xs text-gray-500 mb-3">AI 将从以下网站抓取并筛选 skill</p>
            <div className="space-y-2">
              {sources.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200"
                >
                  <span className="flex-1 min-w-0 truncate text-sm">
                    {s.name || s.url}
                    <span className="text-gray-400 ml-1 text-xs truncate block">{s.url}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSource(i)}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                    title="移除"
                  >
                    {iconDelete}
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource((p) => ({ ...p, name: e.target.value }))}
                  placeholder="名称（可选）"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200"
                />
                <input
                  type="text"
                  value={newSource.url}
                  onChange={(e) => setNewSource((p) => ({ ...p, url: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                  placeholder="https://clawhub.ai/skills"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleAddSource}
                  disabled={savingSources || !newSource.url.trim()}
                  className="px-3 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
                  title="添加"
                >
                  {iconAdd}
                </button>
              </div>
            </div>
          </section>

          {/* 搜索 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">搜索</h3>
            <p className="text-xs text-gray-500 mb-3">描述你的需求，AI 将自动抓取并筛选匹配的 skill</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="例如：代码审查、Docker 构建、自我改进"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !query.trim() || sources.length === 0}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                {searching ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  iconSearch
                )}
                {searching ? '搜索中...' : '搜索'}
              </button>
            </div>
            {searchError && (
              <p className="mt-2 text-sm text-red-500">{searchError}</p>
            )}
            {/* 流式日志 */}
            {searchLogs.length > 0 && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-200 text-xs font-medium text-gray-600 bg-gray-100/80">
                  搜索过程
                </div>
                <div className="max-h-40 overflow-y-auto p-3 space-y-1.5 text-xs font-mono">
                  {searchLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-0.5">
                      {log.type === 'step' && (
                        <div className="text-gray-700 font-medium">
                          [{log.step}] {log.message}
                          {log.detail && <span className="text-gray-500 font-normal ml-1">— {log.detail}</span>}
                        </div>
                      )}
                      {log.type === 'log' && (
                        <div className="text-gray-600">
                          · {log.message}
                          {log.detail && <span className="text-gray-400 block mt-0.5 pl-2">{log.detail}</span>}
                        </div>
                      )}
                      {log.type === 'error' && (
                        <div className="text-red-600">{log.error}</div>
                      )}
                      {log.type === 'candidates' && log.candidates?.length > 0 && (
                        <div className="text-green-600 font-medium">
                          ✓ 筛选完成，共 {log.candidates.length} 个匹配结果
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}
          </section>

          {/* 搜索结果 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">匹配结果</h3>
            {candidates.length === 0 && !searching ? (
              <p className="text-sm text-gray-400 py-4">输入需求并点击搜索，AI 将自动抓取并筛选</p>
            ) : (
              <div className="space-y-2">
                {candidates.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {c.skillName || c.url}
                      </p>
                      {c.summary && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.summary}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1 truncate font-mono" title={c.url}>
                        {c.url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImport(c)}
                      disabled={importingUrl === c.url}
                      className="flex-shrink-0 px-3 py-1.5 text-sm rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {importingUrl === c.url ? '导入中...' : '导入'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
