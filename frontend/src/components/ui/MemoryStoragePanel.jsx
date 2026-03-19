/**
 * 记忆存储面板 - 查看本地向量数据集、关键词搜索
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listCollections,
  listCollectionItems,
  getCollectionStats,
  queryMemory,
  deleteMemoryItem,
  checkMemoryAvailable,
  getMemoryStorageInfo,
} from '../../api/memoryStorage';
import { wrapNetworkError } from '../../api/base';

export function MemoryStoragePanel({ className = '' }) {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [available, setAvailable] = useState(false);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listCollections();
      setCollections(list);
      setInfo(await getMemoryStorageInfo());
      setAvailable(await checkMemoryAvailable());
    } catch (e) {
      setError(wrapNetworkError(e)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const loadItems = useCallback(async (coll) => {
    if (!coll) return;
    setLoadingItems(true);
    setError(null);
    setSearchResults(null);
    try {
      const [itemList, stat] = await Promise.all([
        listCollectionItems(coll),
        getCollectionStats(coll),
      ]);
      setItems(itemList);
      setStats(stat?.stats || null);
    } catch (e) {
      setError(wrapNetworkError(e)?.message || '加载失败');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadItems(selectedCollection);
    } else {
      setItems([]);
      setStats(null);
      setSearchResults(null);
    }
  }, [selectedCollection, loadItems]);

  const handleSearch = async () => {
    const text = searchText.trim();
    if (!text || !selectedCollection) return;
    setSearching(true);
    setError(null);
    try {
      const res = await queryMemory(selectedCollection, text, 20);
      setSearchResults(res?.results || []);
    } catch (e) {
      setError(wrapNetworkError(e)?.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!selectedCollection || !confirm('确定删除该记忆？')) return;
    try {
      await deleteMemoryItem(selectedCollection, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSearchResults((prev) => (prev || []).filter((r) => r.item?.id !== id));
    } catch (e) {
      setError(wrapNetworkError(e)?.message || '删除失败');
    }
  };

  const displayList = searchResults != null ? searchResults : items;
  const isSearchMode = searchResults != null;

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${className}`}>
      {/* 顶部信息栏 */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-[var(--skill-btn-text)]">记忆存储</h2>
            <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
              {info?.description || '本地向量数据集'}
              {available ? (
                <span className="ml-2 text-green-600">· 可用</span>
              ) : (
                <span className="ml-2 text-amber-600">· 嵌入模型加载中</span>
              )}
            </p>
          </div>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded bg-[var(--skill-btn-bg)] hover:bg-[var(--skill-btn-hover)]"
            onClick={loadCollections}
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mx-4 mt-2 px-3 py-2 rounded bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：集合列表 */}
        <div className="flex-shrink-0 w-56 border-r border-[var(--input-bar-border)] flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-3 py-2 text-sm font-medium text-[var(--skill-btn-text)]">
            向量数据集
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-sm text-[var(--input-placeholder)]">加载中...</div>
            ) : collections.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--input-placeholder)]">暂无数据集</div>
            ) : (
              <ul className="py-1">
                {collections.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm truncate transition-colors ${
                        selectedCollection === c
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'hover:bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)]'
                      }`}
                      onClick={() => setSelectedCollection(c)}
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 右侧：文档列表 + 搜索 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedCollection ? (
            <>
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--input-bar-border)]">
                <input
                  type="text"
                  placeholder="输入关键词进行语义搜索..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[var(--input-bar-border)] text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm hover:bg-indigo-600 disabled:opacity-50"
                  onClick={handleSearch}
                  disabled={searching || !searchText.trim()}
                >
                  {searching ? '搜索中...' : '搜索'}
                </button>
                {searchResults != null && (
                  <button
                    type="button"
                    className="px-2 py-1.5 text-xs text-[var(--input-placeholder)] hover:text-[var(--skill-btn-text)]"
                    onClick={() => {
                      setSearchResults(null);
                      setSearchText('');
                    }}
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="flex-shrink-0 px-4 py-1 text-xs text-[var(--input-placeholder)]">
                {stats?.items != null && (
                  <span>
                    {isSearchMode
                      ? `语义搜索结果：${displayList.length} 条`
                      : `共 ${stats.items} 条`}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {loadingItems ? (
                  <div className="text-sm text-[var(--input-placeholder)]">加载中...</div>
                ) : displayList.length === 0 ? (
                  <div className="text-sm text-[var(--input-placeholder)] py-8">
                    {isSearchMode ? '无匹配结果' : '该数据集暂无文档'}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {displayList.map((item) => {
                      const id = item?.id;
                      const meta = item?.metadata || {};
                      const text = meta.text || meta.content || id;
                      const score = item?.score;
                      return (
                        <li
                          key={id}
                          className="group flex items-start gap-2 p-3 rounded-xl border border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--skill-btn-text)] whitespace-pre-wrap break-words">
                              {String(text).slice(0, 500)}
                              {String(text).length > 500 && '...'}
                            </p>
                            {score != null && (
                              <p className="text-xs text-[var(--input-placeholder)] mt-1">
                                相似度: {(score * 100).toFixed(1)}%
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500 text-xs"
                            title="删除"
                            onClick={() => handleDeleteItem(id)}
                          >
                            🗑
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--input-placeholder)] text-sm">
              请从左侧选择一个向量数据集
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
