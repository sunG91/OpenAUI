import { useState, useRef, useEffect } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';
import { AIAvatar, MessageBubble, ChatInputBar, Sidebar, SettingsPanel, ModelTestPanel, SkillsPanel, ToolsPanel, McpPanel, SkillsLibraryPanel, AuiPanel, MemoryStoragePanel, ChatHistoryPanel, ChangelogModal } from './ui';
import { getVoiceSettings, sttFromAudioBlob, ttsFromText } from '../api/client';
import {
  createChatSession,
  appendChatMessage,
  deepenMemory,
  deleteChatSession,
  getChatSession,
  rollbackChatMessage,
  getLastSelectedSessionId,
  saveLastSelectedSessionId,
} from '../api/chatHistory';
import { stripEmojisForSpeech } from '../utils/speechText';

const STORAGE_LAST_SESSION = 'openaui_last_chat_session';

export function MainLayout() {
  const [sidebarActive, setSidebarActive] = useState(() => {
    try {
      const lastSession = window.localStorage.getItem(STORAGE_LAST_SESSION);
      if (lastSession) return 'chat';
      return window.localStorage.getItem('openaui_sidebar_active') || 'chat';
    } catch {
      return 'chat';
    }
  });
  const [mode, setMode] = useState('chat');
  const [voiceActive, setVoiceActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [restoringSession, setRestoringSession] = useState(() => {
    try {
      return !!window.localStorage.getItem(STORAGE_LAST_SESSION);
    } catch {
      return false;
    }
  });
  const [changelogOpen, setChangelogOpen] = useState(false);
  const sessionIdRef = useRef(null);
  const awaitingAiResponseRef = useRef(false);
  const lastProcessedEchoRef = useRef(null);
  const streamingAssistantIdRef = useRef(null);
  const [quickMode, setQuickMode] = useState(true);
  const [mcpMode, setMcpMode] = useState(false);
  const [mcpDetail, setMcpDetail] = useState(null); // { call, mcpCalls, messageId, sessionId }
  const [mcpPanelClosing, setMcpPanelClosing] = useState(false); // 关闭动画中
  const [mcpTabType, setMcpTabType] = useState('mcp'); // 第一层：MCP | Agent
  const [mcpTabIndex, setMcpTabIndex] = useState(0); // 第二层：选中的第几个
  const [suiMode, setSuiMode] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const { send, lastMessage, clearLastMessage, authenticated } = useWebSocketContext();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  const appLicense = typeof __APP_LICENSE__ !== 'undefined' ? __APP_LICENSE__ : '未设置';
  const companyName = '盐城小寒科技有限责任公司';
  const email = 'sunr20050503@163.com';

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 });

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
    try {
      if (currentSessionId) {
        window.localStorage.setItem(STORAGE_LAST_SESSION, currentSessionId);
      } else {
        window.localStorage.removeItem(STORAGE_LAST_SESSION);
      }
    } catch {}
    // 持久化到 config.json，刷新后恢复选中状态
    saveLastSelectedSessionId(currentSessionId).catch(() => {});
  }, [currentSessionId]);

  // 刷新页面时加载上次的对话历史，并回到聊天视图（优先从 config.json 读取，其次 localStorage）
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setRestoringSession(false);
    }, 8000);
    (async () => {
      try {
        let lastId = null;
        try {
          lastId = await getLastSelectedSessionId();
        } catch {}
        if (!lastId) {
          try {
            lastId = window.localStorage.getItem(STORAGE_LAST_SESSION);
          } catch {}
        }
        if (!lastId) {
          setRestoringSession(false);
          clearTimeout(timeout);
          return;
        }
        const session = await getChatSession(lastId);
        if (cancelled) return;
        clearTimeout(timeout);
        setMessages(session.messages || []);
        setCurrentSessionId(session.id);
        setSidebarActive('chat');
        try {
          window.localStorage.setItem('openaui_sidebar_active', 'chat');
        } catch {}
      } catch {
        try {
          window.localStorage.removeItem(STORAGE_LAST_SESSION);
          saveLastSelectedSessionId(null).catch(() => {});
        } catch {}
      } finally {
        if (!cancelled) {
          clearTimeout(timeout);
          setRestoringSession(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const handleSidebarSelect = (id) => {
    handleCloseContextMenu();
    if (id === 'new') {
      setMessages([]);
      setCurrentSessionId(null);
      setInputValue('');
      return;
    }
    setSidebarActive(id);
    try {
      window.localStorage.setItem('openaui_sidebar_active', id);
    } catch {}
    // 历史、设置 后续可打开对应面板或路由
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    setContextMenu({ open: true, x, y });
  };

  const handleCloseContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, open: false }));
  };

  const handleRefreshCurrentView = () => {
    setContextMenu((prev) => ({ ...prev, open: false }));
    // 使用完整刷新，但通过 localStorage 保持当前 sidebarActive
    window.location.reload();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (
      sidebarActive === 'chat' &&
      lastMessage?.type === 'echo' &&
      awaitingAiResponseRef.current &&
      (lastMessage?.content != null || lastMessage?.reasoning_content != null || Array.isArray(lastMessage?.mcp_calls))
    ) {
      const reasoning = lastMessage.reasoning_content ?? '';
      const text = lastMessage.content ?? '';
      const content = reasoning ? `思考：${reasoning}\n\n回答：${text}` : text;
      const isStreaming = lastMessage.streaming === true;
      const mcpStatus = lastMessage.status === 'mcp_retrieving' ? 'mcp_retrieving' : lastMessage.status === 'mcp_done' ? 'mcp_done' : lastMessage.status === 'mcp_summarizing' ? 'mcp_summarizing' : undefined;
      const mcpToolName = lastMessage.mcp_tool_name || undefined;
      const mcpCalls = Array.isArray(lastMessage.mcp_calls) ? lastMessage.mcp_calls : undefined;
      const fullContent = content || '（无内容）';

      const echoSig = `${text}|${reasoning}|${isStreaming}|${mcpStatus ?? ''}|${mcpToolName ?? ''}|${JSON.stringify(mcpCalls || [])}|${lastMessage?.timestamp ?? 0}`;
      // 流式时始终处理，确保每帧内容都能更新；非流式才做去重
      if (!isStreaming && lastProcessedEchoRef.current === echoSig) return;
      lastProcessedEchoRef.current = echoSig;
      if (!isStreaming) awaitingAiResponseRef.current = false;

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const existingId = streamingAssistantIdRef.current;
        const target = existingId ? prev.find((m) => m.id === existingId) : null;

        if (target && (target.streaming || isStreaming)) {
          const updated = { ...target, content: fullContent, streaming: isStreaming, status: mcpStatus, mcpToolName: mcpToolName ?? target.mcpToolName, mcpCalls: mcpCalls ?? target.mcpCalls };
          if (!isStreaming) streamingAssistantIdRef.current = null;
          if (!isStreaming && mode === 'chat' && sessionIdRef.current) {
            appendChatMessage(sessionIdRef.current, { ...updated, id: target.id }).catch(() => {});
          }
          return prev.map((m) => (m.id === target.id ? updated : m));
        }
        if (last?.role === 'assistant' && (last.streaming || isStreaming)) {
          const updated = { ...last, content: fullContent, streaming: isStreaming, status: mcpStatus, mcpToolName: mcpToolName ?? last.mcpToolName, mcpCalls: mcpCalls ?? last.mcpCalls };
          if (!streamingAssistantIdRef.current) streamingAssistantIdRef.current = last.id;
          if (!isStreaming) streamingAssistantIdRef.current = null;
          if (!isStreaming && mode === 'chat' && sessionIdRef.current) {
            appendChatMessage(sessionIdRef.current, { ...updated, id: last.id }).catch(() => {});
          }
          return [...prev.slice(0, -1), updated];
        }
        if (streamingAssistantIdRef.current && !target) {
          streamingAssistantIdRef.current = null;
        }
        const lastAssistant = prev[prev.length - 1];
        if (lastAssistant?.role === 'assistant' && !lastAssistant.streaming && lastAssistant.content === fullContent) {
          return prev;
        }
        const assistantMsg = {
          id: lastMessage.messageId || crypto.randomUUID(),
          role: 'assistant',
          content: fullContent,
          time: new Date().toLocaleTimeString(),
          streaming: isStreaming,
          status: mcpStatus,
          mcpToolName,
          mcpCalls,
        };
        streamingAssistantIdRef.current = assistantMsg.id;
        if (!isStreaming) streamingAssistantIdRef.current = null;
        if (!isStreaming && mode === 'chat' && sessionIdRef.current) {
          appendChatMessage(sessionIdRef.current, assistantMsg).catch(() => {});
        }
        return [...prev, assistantMsg];
      });

      if (!isStreaming) {
        (async () => {
          try {
            const s = await getVoiceSettings();
            if (!s?.enabled || !s?.ttsEnabled || s?.autoReadAssistant === false) return;
            const toRead = lastMessage.content ?? '';
            const t = stripEmojisForSpeech(toRead);
            if (!t) return;
            const r = await ttsFromText(t, { voice: s.ttsVoice || '', rate: typeof s.ttsRate === 'number' ? s.ttsRate : 0 });
            if (r?.audioUrl) {
              const url = `http://localhost:${new URLSearchParams(window.location.search).get('backendPort') || '9527'}${r.audioUrl}`;
              const audio = new Audio(url);
              audio.play().catch(() => {});
            }
          } catch {}
        })();
      }
    }
  }, [lastMessage, mode, sidebarActive]);

  useEffect(() => scrollToBottom(), [messages]);

  // 左右同步：当 mcpDetail 对应的消息的 mcpCalls 更新时，同步右侧面板并自动切到最新；MCP 检索时自动打开右侧面板
  useEffect(() => {
    const last = messages[messages.length - 1];
    const streamingWithMcp = last?.role === 'assistant' && last?.streaming && Array.isArray(last?.mcpCalls) && last.mcpCalls.length > 0;
    if (streamingWithMcp) {
      const list = last.mcpCalls;
      if (mcpDetail?.messageId === last.id) {
        if (JSON.stringify(list) !== JSON.stringify(mcpDetail.mcpCalls)) {
          setMcpDetail((prev) => (prev ? { ...prev, mcpCalls: list } : null));
          setMcpTabIndex(list.length > 0 ? list.length - 1 : 0);
        }
      } else {
        setMcpDetail({ call: list[list.length - 1], mcpCalls: list, messageId: last.id, sessionId: currentSessionId });
        setMcpTabIndex(list.length - 1);
      }
    }
  }, [messages, mcpDetail?.messageId, mcpDetail?.mcpCalls, currentSessionId]);

  // 当对应消息被清空、会话切换或回退时，关闭 MCP 面板，避免出现“孤儿”数据
  useEffect(() => {
    if (!mcpDetail) return;
    const msgExists = messages.some((m) => m.id === mcpDetail.messageId);
    const sessionMatch = mcpDetail.sessionId === currentSessionId;
    if (messages.length === 0 || !sessionMatch || !msgExists) {
      setMcpDetail(null);
      setMcpTabType('mcp');
      setMcpTabIndex(0);
      setMcpPanelClosing(false);
    }
  }, [messages, currentSessionId, mcpDetail]);

  const handleCloseMcpPanel = () => setMcpPanelClosing(true);
  const handleMcpPanelTransitionEnd = (e) => {
    if (e.propertyName === 'width' && mcpPanelClosing) {
      setMcpDetail(null);
      setMcpTabType('mcp');
      setMcpTabIndex(0);
      setMcpPanelClosing(false);
    }
  };

  // 当消息为空且存在会话时，删除该会话（如回退导致清空）
  useEffect(() => {
    if (restoringSession) return;
    if (messages.length === 0 && currentSessionId) {
      deleteChatSession(currentSessionId).catch(() => {});
      setCurrentSessionId(null);
      try {
        window.localStorage.removeItem(STORAGE_LAST_SESSION);
      } catch {}
      window.dispatchEvent(new CustomEvent('openaui:chat-session-deleted', { detail: { sessionId: currentSessionId } }));
    }
  }, [messages.length, currentSessionId, restoringSession]);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop?.();
      } catch {}
      try {
        mediaStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  // Escape 关闭右键菜单，避免遮挡输入
  useEffect(() => {
    if (!contextMenu.open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleCloseContextMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [contextMenu.open]);

  // 响应来自各子面板的导航请求（例如技能面板跳转到 MCP 面板）
  useEffect(() => {
    const onNavigate = (e) => {
      const sidebar = e?.detail?.sidebar;
      if (!sidebar) return;
      handleSidebarSelect(sidebar);
    };
    window.addEventListener('openaui:navigate', onNavigate);
    return () => {
      window.removeEventListener('openaui:navigate', onNavigate);
    };
  }, []);

  // 全局 Ctrl+S 保存：分发自定义事件，具体保存逻辑由各面板自行处理
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('openaui:save', {
            detail: { sidebar: sidebarActive },
          }),
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sidebarActive]);

  const startRecording = async () => {
    if (voiceBusy) return;
    setVoiceBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
          const s = await getVoiceSettings();
          if (!s?.enabled || !s?.sttEnabled) return;
          const r = await sttFromAudioBlob(blob);
          const text = String(r?.text || '').trim();
          if (!text) return;
          if (s.autoSendAfterStt !== false) {
            let sid = sessionIdRef.current;
            if (mode === 'chat' && !sid) {
              try {
                const session = await createChatSession();
                sid = session.id;
                setCurrentSessionId(sid);
                sessionIdRef.current = sid;
              } catch {}
            }
            const userMsg = {
              id: crypto.randomUUID(),
              role: 'user',
              content: text,
              time: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev, userMsg]);
            if (mode === 'chat' && sid) {
              appendChatMessage(sid, userMsg).catch(() => {});
            }
            awaitingAiResponseRef.current = true;
            streamingAssistantIdRef.current = null;
            lastProcessedEchoRef.current = null;
            send('message', { content: text, sessionId: sessionIdRef.current || undefined });
          } else {
            setInputValue(text);
          }
        } catch (e) {
          // STT 失败：写入一条系统提示，避免用户无感
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `（语音识别失败：${e?.message || '未知错误'}）`,
              time: new Date().toLocaleTimeString(),
            },
          ]);
        } finally {
          try {
            mediaStreamRef.current?.getTracks?.().forEach((t) => t.stop());
          } catch {}
          mediaStreamRef.current = null;
          recorderRef.current = null;
          chunksRef.current = [];
          setVoiceBusy(false);
        }
      };
      rec.start();
      setVoiceActive(true);
    } catch (e) {
      setVoiceBusy(false);
      setVoiceActive(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `（无法启动麦克风：${e?.message || '请检查权限'}）`,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop?.();
    } catch {
      setVoiceBusy(false);
    } finally {
      setVoiceActive(false);
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || restoringSession) return;
    let sid = currentSessionId;
    if (mode === 'chat' && !sid) {
      try {
        const session = await createChatSession();
        sid = session.id;
        setCurrentSessionId(sid);
        sessionIdRef.current = sid;
      } catch {}
    }
    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (mode === 'chat' && sid) {
      appendChatMessage(sid, userMsg).catch(() => {});
    }
    awaitingAiResponseRef.current = true;
    streamingAssistantIdRef.current = null;
    lastProcessedEchoRef.current = null;
    send('message', {
      content: text,
      quick: mode === 'chat' ? true : quickMode,
      mcp: mode === 'chat' ? mcpMode : false,
      sessionId: sid || undefined,
    });
    setInputValue('');
  };

  const handleLoadChatSession = (session) => {
    clearLastMessage?.(); // 最先清除残留 echo，防止 effect 追加重复消息
    awaitingAiResponseRef.current = false;
    streamingAssistantIdRef.current = null;
    lastProcessedEchoRef.current = null;
    setMessages(session.messages || []);
    setCurrentSessionId(session.id);
    setSidebarActive('chat');
    try {
      window.localStorage.setItem('openaui_sidebar_active', 'chat');
    } catch {}
  };

  const handleSkillSelect = (skillId) => {
    if (skillId === 'more') return;
    if (skillId === 'quick') {
      setQuickMode((prev) => !prev);
    } else if (skillId === 'mcp') {
      setMcpMode((prev) => !prev);
    } else if (skillId === 'sui') {
      setSuiMode((prev) => !prev);
      handleSidebarSelect('skills');
      window.dispatchEvent(new CustomEvent('openaui:skills-activate', { detail: { moduleId: 'sui' } }));
    } else if (skillId === 'task-decompose') {
      handleSidebarSelect('skills');
      window.dispatchEvent(new CustomEvent('openaui:skills-activate', { detail: { moduleId: 'task-decompose' } }));
    } else if (skillId === 'agent') {
      handleSidebarSelect('skills');
      window.dispatchEvent(new CustomEvent('openaui:skills-activate', { detail: { moduleId: 'agent' } }));
    }
  };

  return (
    <div
      className="h-screen flex bg-white font-sans overflow-hidden"
      onContextMenu={handleContextMenu}
      onClick={handleCloseContextMenu}
    >
      <Sidebar activeId={sidebarActive} onSelect={handleSidebarSelect} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex-shrink-0 flex items-center justify-between py-3 px-4 border-b border-[var(--input-bar-border)] bg-white animate-fade-in">
          <div className="flex items-center gap-3">
            <AIAvatar compact />
            <div>
              <h1 className="text-base font-medium text-[var(--skill-btn-text)]">Open AUI</h1>
              <p className="text-xs text-[var(--input-placeholder)]">内容由 AI 生成</p>
            </div>
          </div>
          {sidebarActive === 'chat' && (
            <div className="flex items-center gap-2 ml-auto">
              {currentSessionId && (
                <button
                  type="button"
                  className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50"
                  title="删除当前对话"
                  onClick={async () => {
                    if (!confirm('确定删除当前对话？')) return;
                    try {
                      await deleteChatSession(currentSessionId);
                      setMessages([]);
                      setCurrentSessionId(null);
                      try {
                        window.localStorage.removeItem(STORAGE_LAST_SESSION);
                      } catch {}
                      window.dispatchEvent(new CustomEvent('openaui:chat-session-deleted', { detail: { sessionId: currentSessionId } }));
                    } catch {}
                  }}
                >
                  删除对话
                </button>
              )}
              <div className="relative inline-flex items-center group">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="px-3 pr-8 py-1.5 rounded-full bg-[var(--skill-btn-bg)] text-sm text-[var(--skill-btn-text)] border-0 cursor-pointer outline-none hover:bg-[var(--skill-btn-hover)] focus:bg-white focus:shadow-sm focus:ring-2 focus:ring-blue-400 appearance-none transition-all duration-200"
              >
                <option value="chat">Chat</option>
                <option value="aui">AUI</option>
              </select>
              <span className="pointer-events-none absolute right-3 text-[10px] text-[var(--input-placeholder)] transition-transform duration-200 group-focus-within:-rotate-180">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 flex flex-col items-stretch overflow-hidden bg-white">
          {sidebarActive === 'memory-storage' ? (
            <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
              <MemoryStoragePanel />
            </div>
          ) : sidebarActive === 'history' ? (
            <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
              <ChatHistoryPanel
                onLoadSession={handleLoadChatSession}
                onSessionDeleted={(sessionId) => {
                  if (sessionId === currentSessionId) {
                    setMessages([]);
                    setCurrentSessionId(null);
                    try {
                      window.localStorage.removeItem(STORAGE_LAST_SESSION);
                    } catch {}
                  }
                }}
              />
            </div>
          ) : sidebarActive === 'aui' ? (
            <AuiPanel />
          ) : sidebarActive === 'settings' ? (
            <div className="flex-1 w-full flex flex-col items-center min-h-0 overflow-hidden">
              <SettingsPanel />
            </div>
          ) : sidebarActive === 'tools' ? (
            <ToolsPanel />
          ) : sidebarActive === 'skills' ? (
            <SkillsPanel />
          ) : sidebarActive === 'mcp' ? (
            <McpPanel />
          ) : sidebarActive === 'skills-library' ? (
            <SkillsLibraryPanel />
          ) : sidebarActive === 'model-test' ? (
            <ModelTestPanel />
          ) : (
            <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto chat-scroll-area">
                <div className="w-full max-w-4xl mx-auto px-4 py-4 bg-white">
                {restoringSession ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <p className="text-[var(--input-placeholder)] text-sm">加载对话中...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <p className="text-center text-[var(--input-placeholder)] text-sm">
                      {mode === 'chat' ? '输入消息开始对话' : '切换到 AUI 模式，让 AI 帮你操作电脑'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((m, i) => (
                      <MessageBubble
                        key={m.id || i}
                        role={m.role}
                        content={m.content}
                        time={m.time}
                        index={i}
                        streaming={m.streaming}
                        status={m.status}
                        mcpToolName={m.mcpToolName}
                        mcpCalls={m.mcpCalls}
                        messageId={m.id}
                        sessionId={currentSessionId}
                        memoryId={m.memoryId}
                        showActions={mode === 'chat' && !!currentSessionId}
                        canRollback={m.role === 'user' && i < messages.length - 1}
                        showDeepenMemory={m.role === 'assistant'}
                        onRollback={async () => {
                          if (!currentSessionId || !m.id) return;
                          if (!confirm('确定回退到此？此后所有消息将被清除，可从这一步重新对话。')) return;
                          try {
                            await rollbackChatMessage(currentSessionId, m.id);
                            setMessages((prev) => prev.slice(0, i));
                            setInputValue(m.content || '');
                            setTimeout(() => chatInputRef.current?.focus(), 50);
                          } catch {}
                        }}
                        onDeepenMemory={async () => {
                          if (!currentSessionId || !m.id || m.memoryId) return;
                          try {
                            const { memoryId: mid } = await deepenMemory(currentSessionId, m.id);
                            if (mid) {
                              setMessages((prev) =>
                                prev.map((x) => (x.id === m.id ? { ...x, memoryId: mid } : x))
                              );
                            }
                          } catch {}
                        }}
                        onMcpTagClick={(call, idx) => {
                          const list = m.mcpCalls || [];
                          const tabIdx = list.findIndex((c) => c === call);
                          setMcpDetail({ call, mcpCalls: list, messageId: m.id, sessionId: currentSessionId });
                          setMcpTabType('mcp');
                          setMcpTabIndex(tabIdx >= 0 ? tabIdx : 0);
                        }}
                      />
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
                </div>
                </div>
                <div className="flex-shrink-0 w-full max-w-4xl px-4 pb-6 pt-4 self-center">
                  <ChatInputBar
                    value={inputValue}
                    onChange={setInputValue}
                    onSend={handleSend}
                    inputRef={chatInputRef}
                    onSkillSelect={handleSkillSelect}
                    onPlusClick={() => setSidebarActive('skills')}
                    quickMode={quickMode}
                    quickOnly
                    mcpMode={mcpMode}
                    suiMode={suiMode}
                    placeholder={voiceActive ? '正在监听，请说话...' : '发消息或输入「/」选择技能'}
                    voiceActive={voiceActive}
                    onVoiceToggle={() => {
                      if (voiceActive) stopRecording();
                      else startRecording();
                    }}
                    disabled={!authenticated || restoringSession}
                    isStreaming={messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.streaming}
                    onPause={() => send('stop', {})}
                  />
                </div>
              </div>
              {(() => {
                const list = mcpDetail?.mcpCalls || [];
                const mcpCount = list.length;
                const hasAgentData = false; // 有 Agent 检索数据时再展示 Agent tab
                const displayCall = list[mcpTabIndex] ?? list[0] ?? mcpDetail?.call;
                const panelOpen = !!mcpDetail && !mcpPanelClosing;
                return (
                <div
                  className="flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out [contain:layout]"
                  style={{ width: panelOpen ? '40rem' : 0, minWidth: panelOpen ? '22rem' : 0 }}
                  onTransitionEnd={handleMcpPanelTransitionEnd}
                >
                {mcpDetail && (
                <div className="w-[40rem] min-w-[22rem] h-full border-l border-[var(--input-bar-border)] flex flex-col bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.06)] overflow-hidden shrink-0">
                  <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--input-bar-border)]">
                    <div className="flex gap-0.5 py-2 px-2 min-w-0">
                      <button
                        type="button"
                        className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 ${
                          mcpTabType === 'mcp'
                            ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#7dd3fc]'
                            : 'bg-[#f8fafc] text-[var(--input-placeholder)] border border-transparent hover:bg-[#f1f5f9]'
                        }`}
                        onClick={() => { setMcpTabType('mcp'); setMcpTabIndex(0); }}
                      >
                        MCP{mcpCount > 0 ? ` (${mcpCount})` : ''}
                      </button>
                      {hasAgentData && (
                        <button
                          type="button"
                          className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 ${
                            mcpTabType === 'agent'
                              ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#7dd3fc]'
                              : 'bg-[#f8fafc] text-[var(--input-placeholder)] border border-transparent hover:bg-[#f1f5f9]'
                          }`}
                          onClick={() => setMcpTabType('agent')}
                        >
                          Agent
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-[var(--skill-btn-bg)] text-[var(--input-placeholder)] shrink-0"
                      onClick={handleCloseMcpPanel}
                      title="关闭"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                    {mcpTabType === 'mcp' && list.length > 0 && (
                      <div className="w-32 flex-shrink-0 border-r border-[var(--input-bar-border)] flex flex-col py-2">
                        <div className="text-[10px] font-medium text-[var(--input-placeholder)] px-2 mb-1">共 {list.length} 个</div>
                        {list.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`px-2 py-1 text-left text-[11px] truncate ${
                              mcpTabIndex === i ? 'bg-[#e0f2fe] text-[#0369a1] font-medium' : 'text-[var(--input-placeholder)] hover:bg-[#f1f5f9]'
                            }`}
                            onClick={() => setMcpTabIndex(i)}
                            title={c.toolName}
                          >
                            {`[${c.keyword || c.toolName || ''}]`}
                          </button>
                        ))}
                      </div>
                    )}
                    {hasAgentData && mcpTabType === 'agent' && (
                      <div className="flex-1 flex items-center justify-center text-[var(--input-placeholder)] text-sm">
                        暂无 Agent 检索数据
                      </div>
                    )}
                    {mcpTabType === 'mcp' && displayCall && (
                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3 space-y-3 flex flex-col">
                      {displayCall.summary && (
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--skill-btn-text)] mb-1 truncate">AI 总结：{displayCall.toolName}</div>
                          <p className="text-xs text-[var(--input-placeholder)] leading-relaxed break-words">{displayCall.summary}</p>
                        </div>
                      )}
                      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
                        <div className="text-xs font-medium text-[var(--skill-btn-text)] mb-1 truncate">原始返回：{displayCall.toolName}</div>
                        <pre className="flex-1 min-h-0 min-w-0 text-[11px] text-[var(--input-placeholder)] bg-[#f8fafc] rounded p-2 overflow-auto whitespace-pre-wrap break-all font-mono border border-[var(--input-bar-border)]">
                          {(() => {
                            try {
                              const parsed = JSON.parse(displayCall.result);
                              return JSON.stringify(parsed, null, 2);
                            } catch {
                              return displayCall.result;
                            }
                          })()}
                        </pre>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
                )}
                </div>
                );
              })()}
              </div>
            </div>
          )}
        </main>

        {/* 底部状态栏：单行左对齐信息 */}
        <footer className="flex-shrink-0 border-t border-[var(--input-bar-border)] bg-white px-4 py-2">
          <div className="text-xs text-[var(--input-placeholder)] truncate">
            <button
              type="button"
              className="font-mono hover:underline underline-offset-2"
              title="点击查看更新记录"
              onClick={() => setChangelogOpen(true)}
            >
              v{appVersion}
            </button>
            <span className="mx-2">·</span>
            <span>{companyName}</span>
            <span className="mx-2">·</span>
            <span className="break-all">{email}</span>
            <span className="mx-2">·</span>
            <span>开源协议：{appLicense}</span>
          </div>
        </footer>
      </div>

      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {contextMenu.open && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleCloseContextMenu}
          onContextMenu={(e) => { e.preventDefault(); handleCloseContextMenu(); }}
          role="presentation"
          aria-hidden
        >
          <div
            className="absolute z-50 bg-white border border-[var(--input-bar-border)] rounded-md shadow-lg py-1 text-xs text-[var(--skill-btn-text)]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full px-3 py-1 text-left hover:bg-[var(--skill-btn-bg)]"
              onClick={handleRefreshCurrentView}
            >
              刷新当前页面
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
