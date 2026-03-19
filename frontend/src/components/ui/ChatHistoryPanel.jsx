/**
 * Chat 历史记录面板
 * 展示会话列表，支持加载、删除、分页
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listChatSessions,
  getChatSession,
  deleteChatSession,
} from '../../api/chatHistory';
import { wrapNetworkError } from '../../api/base';

const PAGE_SIZE = 15;

export function ChatHistoryPanel({ onLoadSession, onSessionDeleted }) {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadSessions = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listChatSessions(p, PAGE_SIZE);
      setSessions(res.sessions || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
    } catch (e) {
      setError(wrapNetworkError(e)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions(1);
  }, []);

  useEffect(() => {
    const onDeleted = () => loadSessions(page);
    window.addEventListener('openaui:chat-session-deleted', onDeleted);
    return () => window.removeEventListener('openaui:chat-session-deleted', onDeleted);
  }, [loadSessions, page]);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    loadSessions(p);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleLoad = async (sessionId) => {
    try {
      const session = await getChatSession(sessionId);
      onLoadSession?.(session);
    } catch (e) {
      setError(wrapNetworkError(e)?.message || '加载失败');
    }
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('确定删除该会话？')) return;
    setDeletingId(sessionId);
    try {
      await deleteChatSession(sessionId);
      onSessionDeleted?.(sessionId);
      const next = sessions.filter((s) => s.id !== sessionId);
      setTotal((t) => Math.max(0, t - 1));
      if (next.length === 0 && page > 1) {
        loadSessions(page - 1);
      } else {
        setSessions(next);
      }
    } catch (e) {
      setError(wrapNetworkError(e)?.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? d.toLocaleTimeString() : d.toLocaleDateString();
  };

  const getPreview = (session) => {
    if (session.title) return session.title;
    const msgs = session.messages || [];
    const firstUser = msgs.find((m) => m.role === 'user');
    return firstUser?.content?.slice(0, 40) || '（空对话）';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--input-placeholder)] text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)]">
        <h2 className="text-base font-medium text-[var(--skill-btn-text)]">Chat 历史</h2>
        <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
          共 {total} 条 · 点击加载，支持删除
        </p>
      </div>
      {error && (
        <div className="flex-shrink-0 mx-4 mt-2 px-3 py-2 rounded bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-[var(--input-placeholder)]">暂无 Chat 历史</p>
            <p className="text-xs text-[var(--input-placeholder)] mt-1">开始对话后会自动保存</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="group flex items-center gap-2 p-3 rounded-xl border border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)] cursor-pointer transition-colors"
                onClick={() => handleLoad(s.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--skill-btn-text)] truncate">
                    {getPreview(s)}
                  </p>
                  <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
                    {formatTime(s.updatedAt || s.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500 text-sm transition-opacity disabled:opacity-50"
                  title="删除会话"
                  onClick={(e) => handleDelete(e, s.id)}
                  disabled={deletingId === s.id}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-center gap-2 py-4">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-sm bg-[var(--skill-btn-bg)] hover:bg-[var(--skill-btn-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
            >
              上一页
            </button>
            <span className="text-sm text-[var(--input-placeholder)]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-sm bg-[var(--skill-btn-bg)] hover:bg-[var(--skill-btn-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
