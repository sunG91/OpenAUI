/**
 * Skill 测试区 - 将 skill 内容注入模型上下文进行测试
 * Tab: 模型测试 | SKILL.md 文档
 */
import { useState, useEffect, useRef } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { testModel, testModelStream } from '../../../api/modelTest';
import { getSkillContent } from '../../../api/skills';
import { MarkdownBlock } from '../ModelTestPanel/MarkdownBlock';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

const TAB_TEST = 'test';
const TAB_DOC = 'doc';

export function SkillTestArea({ skill, onBack }) {
  const firstVendor = MODEL_VENDORS[0]?.id ?? '';
  const [activeTab, setActiveTab] = useState(TAB_TEST);
  const [vendorId, setVendorId] = useState(firstVendor);
  const [modelId, setModelId] = useState(() => getFirstModelId(firstVendor));
  const [question, setQuestion] = useState('请根据该 skill 的能力，简要说明你能帮我做什么？');
  const [stream, setStream] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [skillContent, setSkillContent] = useState('');
  const [contentLoading, setContentLoading] = useState(true);
  const outputEndRef = useRef(null);

  const models = VENDOR_MODELS[vendorId] || [];
  const currentModel = models.find((m) => m.id === modelId) || models[0];
  const streamCapable = currentModel?.stream === true;

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [result?.content, result?.reasoning_content]);

  useEffect(() => {
    if (!skill?.location && !skill?.path) {
      setSkillContent(skill?.body || '');
      setContentLoading(false);
      return;
    }
    setContentLoading(true);
    getSkillContent(skill?.location || skill?.path)
      .then(setSkillContent)
      .catch(() => setSkillContent(skill?.body || ''))
      .finally(() => setContentLoading(false));
  }, [skill?.location, skill?.path, skill?.body]);

  const handleTest = async () => {
    const vidTrim = vendorId.trim();
    const midTrim = (modelId || currentModel?.id || '').trim();
    if (!vidTrim || !midTrim) {
      setResult({ success: false, error: '请选择厂商和模型' });
      return;
    }
    setLoading(true);
    setResult(null);

    const systemPrompt = skillContent
      ? `你是一个遵循以下 Skill 指令的助手。请严格按照该 Skill 的说明来回答用户问题。\n\n【Skill 内容】\n${skillContent}`
      : '你是一个有帮助的助手。';

    const payload = {
      vendorId: vidTrim,
      modelId: midTrim,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question.trim() || '你好' },
      ],
      stream: streamCapable && stream,
    };

    if (payload.stream) {
      let content = '';
      let reasoning_content = '';
      testModelStream(payload, {
        onChunk: (delta) => {
          reasoning_content += delta.reasoning_content ?? '';
          content += delta.content ?? '';
          setResult({ success: true, content, reasoning_content, streaming: true });
        },
        onDone: (err) => {
          setLoading(false);
          if (err) {
            setResult({ success: false, error: err?.message || '请求异常' });
          } else {
            setResult((prev) =>
              prev?.success ? { ...prev, streaming: false } : { success: true, content, reasoning_content, streaming: false }
            );
          }
        },
      });
    } else {
      try {
        const data = await testModel(payload);
        if (data?.success) {
          setResult({ success: true, content: data.content, reasoning_content: data.reasoning_content });
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

  if (!skill) return null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-lg border border-gray-200/80">
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="返回列表"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{skill.name || skill.id || '未命名'}</h3>
            <p className="text-xs text-gray-500">
              {activeTab === TAB_TEST ? '模型测试 · 将 Skill 注入上下文' : 'SKILL.md 完整文档'}
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab(TAB_TEST)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === TAB_TEST ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            模型测试
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(TAB_DOC)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === TAB_DOC ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            SKILL.md
          </button>
        </div>
      </div>

      {activeTab === TAB_DOC ? (
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {contentLoading ? (
            <div className="text-sm text-gray-400">加载文档...</div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <MarkdownBlock className="text-[13px] leading-relaxed">{skillContent || '无内容'}</MarkdownBlock>
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">厂商</label>
            <select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setModelId(getFirstModelId(e.target.value));
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
            >
              {MODEL_VENDORS.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-1">模型</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} className="w-3.5 h-3.5" />
            流式输出
          </label>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100">
            <label className="block text-xs text-gray-500 mb-1">输入问题</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTest()}
                placeholder="输入要测试的问题..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 outline-none"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? '测试中...' : '发送'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {contentLoading ? (
              <div className="text-sm text-gray-400">加载 Skill 内容...</div>
            ) : result ? (
              <div className="space-y-3">
                {result.error && (
                  <div className="text-sm text-red-500">{result.error}</div>
                )}
                {result.reasoning_content && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">思考：</span>
                    <MarkdownBlock className="text-[13px]">{result.reasoning_content}</MarkdownBlock>
                  </div>
                )}
                {result.content && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">回答：</span>
                    <MarkdownBlock className="mt-1 text-sm">{result.content}</MarkdownBlock>
                  </div>
                )}
                <div ref={outputEndRef} />
              </div>
            ) : (
              <div className="text-sm text-gray-400">输入问题并点击「发送」开始测试</div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
