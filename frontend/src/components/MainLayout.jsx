import { useState, useRef, useEffect } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';
import { AIAvatar, MessageBubble, ChatInputBar, SuggestionChips, Sidebar, SettingsPanel, ModelTestPanel, SkillsPanel, ToolsPanel, McpPanel, ChangelogModal } from './ui';
import { getVoiceSettings, sttFromAudioBlob, ttsFromText } from '../api/client';
import { stripEmojisForSpeech } from '../utils/speechText';

const SUGGESTION_ITEMS = ['你能做些什么?', '你是谁?', '你是怎么工作的?'];

export function MainLayout() {
  const [sidebarActive, setSidebarActive] = useState(
    () => window.localStorage.getItem('openaui_sidebar_active') || 'chat',
  );
  const [mode, setMode] = useState('chat');
  const [voiceActive, setVoiceActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [mcpMode, setMcpMode] = useState(false);
  const messagesEndRef = useRef(null);
  const { send, lastMessage, authenticated } = useWebSocketContext();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  const appLicense = typeof __APP_LICENSE__ !== 'undefined' ? __APP_LICENSE__ : '未设置';
  const companyName = '盐城小寒科技有限责任公司';
  const email = 'sunr20050503@163.com';

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 });

  const handleSidebarSelect = (id) => {
    if (id === 'new') {
      setMessages([]);
      setInputValue('');
      // 新建只清空对话，不改变选中状态，仍保持「对话」选中
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
    if (contextMenu.open) {
      setContextMenu((prev) => ({ ...prev, open: false }));
    }
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
    if (lastMessage?.type === 'echo' && (lastMessage?.content != null || lastMessage?.reasoning_content != null)) {
      const reasoning = lastMessage.reasoning_content ?? '';
      const text = lastMessage.content ?? '';
      const content = reasoning ? `思考：${reasoning}\n\n回答：${text}` : text;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: content || '（无内容）',
          time: new Date().toLocaleTimeString(),
        },
      ]);

      // 自动朗读（如果用户在设置里开启，只朗读回答部分）
      (async () => {
        try {
          const s = await getVoiceSettings();
          if (!s?.enabled || !s?.ttsEnabled || !s?.autoReadAssistant) return;
          const toRead = lastMessage.content ?? '';
          const text = stripEmojisForSpeech(toRead);
          if (!text) return;
          const r = await ttsFromText(text, { voice: s.ttsVoice || '', rate: typeof s.ttsRate === 'number' ? s.ttsRate : 0 });
          if (r?.audioUrl) {
            const url = `http://localhost:${new URLSearchParams(window.location.search).get('backendPort') || '9527'}${r.audioUrl}`;
            const audio = new Audio(url);
            audio.play().catch(() => {});
          }
        } catch {
          // 忽略自动朗读错误，不影响对话
        }
      })();
    }
  }, [lastMessage]);

  useEffect(() => scrollToBottom(), [messages]);

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
            setMessages((prev) => [...prev, { role: 'user', content: text, time: new Date().toLocaleTimeString() }]);
            send('message', { content: text });
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

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, time: new Date().toLocaleTimeString() },
    ]);
    send('message', { content: text, quick: quickMode });
    if (quickMode) setQuickMode(false);
    setInputValue('');
  };

  const handleSuggestionSelect = (text) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, time: new Date().toLocaleTimeString() },
    ]);
    send('message', { content: text });
  };

  const handleSkillSelect = (skillId) => {
    if (skillId === 'more') return;
    if (skillId === 'quick') {
      setQuickMode((prev) => !prev);
    } else if (skillId === 'mcp') {
      setMcpMode((prev) => !prev);
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
          )}
        </header>

        <main className="flex-1 flex flex-col items-center overflow-hidden bg-white">
          {sidebarActive === 'settings' ? (
            <SettingsPanel />
          ) : sidebarActive === 'tools' ? (
            <ToolsPanel />
          ) : sidebarActive === 'skills' ? (
            <SkillsPanel />
          ) : sidebarActive === 'mcp' ? (
            <McpPanel />
          ) : sidebarActive === 'model-test' ? (
            <ModelTestPanel />
          ) : (
            <>
              <div className="flex-1 w-full max-w-4xl overflow-y-auto px-4 py-4 bg-white">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center py-8">
                    <p className="text-center text-[var(--input-placeholder)] text-sm mb-6">
                      {mode === 'chat' ? '开始对话吧～' : '切换到 AUI 模式，让 AI 帮你操作电脑'}
                    </p>
                    <SuggestionChips
                      items={SUGGESTION_ITEMS}
                      onSelect={handleSuggestionSelect}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((m, i) => (
                      <MessageBubble
                        key={i}
                        role={m.role}
                        content={m.content}
                        time={m.time}
                        index={i}
                      />
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex-shrink-0 w-full max-w-4xl px-4 pb-6 pt-4">
                <ChatInputBar
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  onSkillSelect={handleSkillSelect}
                  onPlusClick={() => setSidebarActive('skills')}
                  quickMode={quickMode}
                  mcpMode={mcpMode}
                  placeholder={voiceActive ? '正在监听，请说话...' : '发消息或输入「/」选择技能'}
                  voiceActive={voiceActive}
                  onVoiceToggle={() => {
                    if (voiceActive) stopRecording();
                    else startRecording();
                  }}
                  disabled={!authenticated}
                />
              </div>
            </>
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
          className="fixed inset-0 z-40 pointer-events-none"
        >
          <div
            className="absolute z-50 pointer-events-auto bg-white border border-[var(--input-bar-border)] rounded-md shadow-lg py-1 text-xs text-[var(--skill-btn-text)]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
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
