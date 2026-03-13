/**
 * 单独测试详情：顶部返回+标题、Tab 导航、接口与参数 / 测试对话
 */
import { useEffect, useRef, useState } from 'react';
import { testModel, testModelStream, API_BASE, getVoiceSettings, ttsFromText } from '../../../api/client';
import { ApiSpecCard } from './ApiSpecCard';
import { TestChatCard } from './TestChatCard';
import { stripEmojisForSpeech } from '../../../utils/speechText';

const TAB_API = 'api';
const TAB_CHAT = 'chat';

const iconBack = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

export function TestDetailView({ vendorId, vendorName, model, onBack, apiKeySet }) {
  const [tab, setTab] = useState(TAB_CHAT);
  const [message, setMessage] = useState('你好，请用一句话介绍你自己。');
  const [advancedJsonMode, setAdvancedJsonMode] = useState(false);
  const [visionPrompt, setVisionPrompt] = useState('比较这几张图片的相同点和不同点');
  const [chatImageUrls, setChatImageUrls] = useState([]);
  const [rawMessagesJson, setRawMessagesJson] = useState(
    JSON.stringify(
      [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/image1.jpg', detail: 'high' },
            },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/image2.jpg', detail: 'high' },
            },
            {
              type: 'text',
              text: '比较这两张图片的相同点和不同点',
            },
          ],
        },
      ],
      null,
      2
    )
  );
  const [useStream, setUseStream] = useState(true);
  const [voiceReply, setVoiceReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const ttsAudioRef = useRef(null);

  const streamCapable = model.stream === true;

  let parsedMessages = null;
  if (advancedJsonMode) {
    try {
      const v = JSON.parse(rawMessagesJson);
      if (Array.isArray(v)) {
        parsedMessages = v;
      }
    } catch {
      // ignore parse error, 在 UI 中展示原始字符串即可
    }
  }

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePickVisionFiles = async (e) => {
    const files = Array.from(e.target.files || []).filter(Boolean);
    // 允许重复选择同一文件也能触发 change
    // eslint-disable-next-line no-param-reassign
    e.target.value = '';
    if (files.length === 0) return;

    try {
      const urls = await Promise.all(files.map((f) => fileToDataUrl(f)));
      const contents = [
        ...urls.map((u) => ({ type: 'image_url', image_url: { url: u, detail: 'high' } })),
        { type: 'text', text: (visionPrompt || '').trim() || '请分析这些图片' },
      ];
      const next = [{ role: 'user', content: contents }];
      setRawMessagesJson(JSON.stringify(next, null, 2));
    } catch (err) {
      // 失败时不覆盖用户已有 JSON，只提示即可
      setResult({ success: false, error: err?.message || '读取图片失败' });
    }
  };

  const handlePickChatImages = async (e) => {
    const files = Array.from(e.target.files || []).filter(Boolean);
    // eslint-disable-next-line no-param-reassign
    e.target.value = '';
    if (files.length === 0) return;
    try {
      const urls = await Promise.all(files.map((f) => fileToDataUrl(f)));
      setChatImageUrls(urls);
    } catch (err) {
      setResult({ success: false, error: err?.message || '读取图片失败' });
    }
  };

  const stripMarkdownForSpeech = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw;
    // 去掉代码块 ``` ``` 包裹内容，只保留中间文本
    s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''));
    // 行内代码 `code`
    s = s.replace(/`([^`]+)`/g, '$1');
    // 链接 [text](url) -> text
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    // 粗体/斜体 **text** *text* __text__ _text_
    s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
    s = s.replace(/(\*|_)(.*?)\1/g, '$2');
    // 标题前缀 #, ##, ###
    s = s.replace(/^[ \t]*#{1,6}[ \t]*/gm, '');
    // 列表前缀 -, *, +, 1.
    s = s.replace(/^[ \t]*([-*+]|\d+\.)[ \t]+/gm, '');
    // 引用 >
    s = s.replace(/^[ \t]*>[ \t]?/gm, '');
    // 多余空行压缩
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  };

  // 只有带「视觉识别」或「图片分析」标签的模型才允许选图、发多模态请求；其余仅纯 chat
  const modelHasVision =
    Array.isArray(model?.tags) &&
    (model.tags.includes('视觉识别') || model.tags.includes('图片分析'));
  const shouldUseChatImages =
    !advancedJsonMode && vendorId === 'siliconflow' && modelHasVision && chatImageUrls.length > 0;
  const chatImagesMessages = shouldUseChatImages
    ? [
        {
          role: 'user',
          content: [
            ...chatImageUrls.map((u) => ({ type: 'image_url', image_url: { url: u, detail: 'high' } })),
            { type: 'text', text: message.trim() || '请分析这些图片' },
          ],
        },
      ]
    : null;

  const requestBody = advancedJsonMode && parsedMessages
    ? {
        vendorId,
        modelId: model.id,
        messages: parsedMessages,
        ...(streamCapable ? { stream: useStream } : {}),
      }
    : shouldUseChatImages
      ? {
          vendorId,
          modelId: model.id,
          messages: chatImagesMessages,
          ...(streamCapable ? { stream: useStream } : {}),
        }
      : {
          vendorId,
          modelId: model.id,
          message: message.trim() || 'Hello',
          ...(streamCapable ? { stream: useStream } : {}),
        };
  const endpoint = `${API_BASE}/api/test-model`;

  useEffect(() => {
    return () => {
      try {
        ttsAudioRef.current?.pause?.();
        // eslint-disable-next-line no-param-reassign
        ttsAudioRef.current = null;
      } catch {}
    };
  }, []);

  const speakTextCore = async (text) => {
    const plain = stripMarkdownForSpeech(text);
    const say = stripEmojisForSpeech(plain);
    if (!say) return;
    try {
      const s = await getVoiceSettings();
      if (!s?.enabled || !s?.ttsEnabled) return;
      const r = await ttsFromText(say, {
        voice: s.ttsVoice || '',
        rate: typeof s.ttsRate === 'number' ? s.ttsRate : 0,
      });
      if (!r?.audioUrl) return;

      // 停止上一段朗读（避免叠音）
      try {
        ttsAudioRef.current?.pause?.();
      } catch {}

      const audio = new Audio(`${API_BASE}${r.audioUrl}`);
      ttsAudioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // 语音失败不影响测试结果
    }
  };
  
  // 自动朗读：受「语音回复」开关控制
  const speakAuto = async (text) => {
    if (!voiceReply) return;
    await speakTextCore(text);
  };
  
  // 手动点击朗读：不受「语音回复」开关影响
  const speakNow = async (text) => {
    await speakTextCore(text);
  };

  const handleTest = async () => {
    if (!apiKeySet) return;
    setLoading(true);
    setResult(null);
    if (streamCapable && useStream) {
      let content = '';
      let reasoning_content = '';
      const bodyForStream =
        advancedJsonMode && parsedMessages
          ? { vendorId, modelId: model.id, messages: parsedMessages }
          : shouldUseChatImages
            ? { vendorId, modelId: model.id, messages: chatImagesMessages }
            : { vendorId, modelId: model.id, message: message.trim() || 'Hello' };

      testModelStream(
        bodyForStream,
        {
          onChunk: (delta) => {
            reasoning_content += delta.reasoning_content ?? '';
            content += delta.content ?? '';
            setResult({ success: true, content, reasoning_content, streaming: true });
          },
          onDone: (err) => {
            setLoading(false);
            if (err) {
              setResult({ success: false, error: err?.message || '流式请求异常' });
            } else {
              setResult((prev) =>
                prev?.success ? { ...prev, streaming: false } : { success: true, content, reasoning_content, streaming: false }
              );
              // 只朗读回答，不朗读思考过程
              speakAuto(content);
            }
          }
        }
      );
    } else {
      try {
        const data = await testModel(requestBody);
        if (data?.success) {
          setResult({ success: true, content: data.content, reasoning_content: data.reasoning_content });
          speakAuto(data.content);
        } else {
          setResult({ success: false, error: data?.error || '请求失败' });
        }
      } catch (e) {
        setResult({ success: false, error: e?.message || '网络或服务异常' });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fafafa]">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)] transition-colors"
        >
          {iconBack}
          返回模型列表
        </button>
        <span className="text-[var(--input-placeholder)]">|</span>
        <h2 className="text-sm font-medium text-[var(--skill-btn-text)] truncate">
          {vendorName} · {model.name}
        </h2>
      </div>

      <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--input-bar-border)] bg-white flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTab(TAB_API)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === TAB_API ? 'bg-blue-500 text-white' : 'text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)]'
          }`}
        >
          接口与参数
        </button>
        <button
          type="button"
          onClick={() => setTab(TAB_CHAT)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === TAB_CHAT ? 'bg-blue-500 text-white' : 'text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)]'
          }`}
        >
          测试对话
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {tab === TAB_API && (
          <div className="overflow-y-auto p-4">
            <ApiSpecCard
              model={model}
              endpoint={endpoint}
              requestBody={requestBody}
              streamCapable={streamCapable}
              useStream={useStream}
            />
          </div>
        )}
        {tab === TAB_CHAT && (
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0 p-4 gap-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-[var(--input-placeholder)]">
                {vendorId === 'siliconflow'
                  ? '高级 JSON 模式可直接粘贴多模态 messages（支持多张图片 / 视频 / 音频），格式同硅基流动文档。'
                  : '高级 JSON 模式仅在部分支持多模态的厂商下可用，请参考对应文档。'}
              </div>
              <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-[var(--input-border)]"
                  checked={advancedJsonMode}
                  onChange={(e) => setAdvancedJsonMode(e.target.checked)}
                />
                <span className="text-[var(--skill-btn-text)]">高级 JSON 消息模式</span>
              </label>
            </div>

            {advancedJsonMode ? (
              <div className="flex-1 flex flex-col min-h-0 gap-2">
                <div className="flex flex-col gap-2 rounded-md border border-[var(--input-bar-border)] bg-white p-3">
                  <div className="text-xs font-medium text-[var(--skill-btn-text)]">图片文件转多模态 messages</div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePickVisionFiles}
                      className="text-xs"
                    />
                    <input
                      type="text"
                      value={visionPrompt}
                      onChange={(e) => setVisionPrompt(e.target.value)}
                      className="text-xs rounded-md border border-[var(--input-bar-border)] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="提示词（会作为 messages 里最后一个 text）"
                    />
                    <div className="text-[10px] text-[var(--input-placeholder)]">
                      选中图片后，会自动把文件转为 base64 的 data URL，写入下方 JSON（`image_url.url`）。
                    </div>
                  </div>
                </div>
                <textarea
                  className="flex-1 min-h-[160px] text-xs font-mono rounded-md border border-[var(--input-bar-border)] px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={rawMessagesJson}
                  onChange={(e) => setRawMessagesJson(e.target.value)}
                  placeholder='例如：[{"role":"user","content":[{"type":"image_url","image_url":{"url":"https://..."}},{"type":"text","text":"描述这些图片"}}]]'
                />
                {!parsedMessages && (
                  <div className="text-xs text-red-500">
                    当前 JSON 无法解析或不是数组，点击“开始测试”前请确保格式正确。
                  </div>
                )}
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={loading || !apiKeySet}
                    className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium ${
                      loading || !apiKeySet
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {loading ? '请求中…' : '开始测试'}
                  </button>
                </div>
                {result && (
                  <div className="mt-2">
                    <TestChatCard
                      // 复用结果展示和语音朗读能力，只用其展示区域
                      message={message}
                      setMessage={setMessage}
                      useStream={useStream}
                      setUseStream={setUseStream}
                      streamCapable={streamCapable}
                      voiceReply={voiceReply}
                      setVoiceReply={setVoiceReply}
                      onSpeak={speakNow}
                      loading={loading}
                      apiKeySet={apiKeySet}
                      onTest={handleTest}
                      result={result}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                {vendorId === 'siliconflow' && modelHasVision && (
                  <div className="mb-3 rounded-lg border border-dashed border-[var(--input-bar-border)] bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-500 text-xs">
                          图
                        </span>
                        <div className="text-xs font-medium text-[var(--skill-btn-text)]">图片（可多选，自动转多模态）</div>
                      </div>
                      {chatImageUrls.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setChatImageUrls([])}
                          className="text-[10px] text-[var(--input-placeholder)] hover:text-red-600"
                        >
                          清空
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--input-bar-border)] bg-[#f8fafc] text-[11px] text-[var(--skill-btn-text)] hover:bg-white hover:border-blue-400 cursor-pointer transition-colors">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M4 16l4.5-4.5L13 16l3-3 4 4" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="9" cy="8" r="1.5" />
                          <path d="M4 5h16v14H4z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>选择图片文件</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePickChatImages}
                          className="hidden"
                        />
                      </label>
                      {chatImageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {chatImageUrls.slice(0, 6).map((src, idx) => (
                            <div
                              // eslint-disable-next-line react/no-array-index-key
                              key={idx}
                              className="relative w-10 h-10 rounded-md overflow-hidden border border-[var(--input-bar-border)] bg-[#f3f4f6]"
                            >
                              <img
                                src={src}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {chatImageUrls.length > 6 && (
                            <div className="flex items-center justify-center w-10 h-10 rounded-md border border-dashed border-[var(--input-bar-border)] text-[10px] text-[var(--input-placeholder)]">
                              +{chatImageUrls.length - 6}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-[var(--input-placeholder)]">
                        已选图片会与左侧文本一起作为多模态请求发送到硅基流动视觉模型。
                      </div>
                    </div>
                  </div>
                )}
                <TestChatCard
                  message={message}
                  setMessage={setMessage}
                  useStream={useStream}
                  setUseStream={setUseStream}
                  streamCapable={streamCapable}
                  voiceReply={voiceReply}
                  setVoiceReply={setVoiceReply}
                  onSpeak={speakNow}
                  loading={loading}
                  apiKeySet={apiKeySet}
                  onTest={handleTest}
                  result={result}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
