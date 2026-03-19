/**
 * WebSocket 连接处理：认证与消息分发
 * 当 message 带 quick: true 时，使用技能设置中的「快速-固定模型」调用接口
 * 当 message 带 mcp: true 时，启用 MCP 工具调用，模型可根据需求调用 MCP 工具
 */
const MSG_AUTH_REQUIRED = 'auth_required';
const MSG_AUTH_OK = 'auth_ok';
const MSG_AUTH_FAIL = 'auth_fail';
const MSG_PING = 'ping';
const MSG_PONG = 'pong';
const MSG_ECHO = 'echo';

const crypto = require('crypto');
const { getQuickFixedModel, getMcpEnabledServerIdsForChat } = require('../skill-settings-store');
const { readApiKeys } = require('../apikeys-store');
const { getProvider } = require('../services/modelProviders');
const { CHAT_SYSTEM_PROMPT } = require('../config/chatSystemPrompt');
const { queryByText } = require('../vectra');
const { collectMcpToolsForOpenAI, executeMcpToolCall } = require('./mcp-chat');
const { saveMcpResult } = require('../mcp-results-store');

const CHAT_MEMORY_COLLECTION = 'chat-memory';
const CHAT_MEMORY_TOP_K = 5;

function parseMessage(data) {
  try {
    const str = typeof data === 'string' ? data : (data && typeof data.toString === 'function' ? data.toString() : String(data));
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function send(ws, type, payload = {}) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

/**
 * @param {{ requireKey: boolean, allowedKeys: string[] }} auth
 * @returns {(ws: WebSocket, req: IncomingMessage) => void}
 */
function createConnectionHandler(auth) {
  const { requireKey, allowedKeys } = auth;
  return function handleConnection(ws, req) {
    ws.isAuthenticated = !requireKey;

    if (requireKey) {
      send(ws, MSG_AUTH_REQUIRED, { message: '请提供有效密钥' });
    } else {
      send(ws, MSG_AUTH_OK, { message: '连接成功' });
    }

    ws.on('message', (data) => {
      const msg = parseMessage(data);
      if (!msg) return;
      const { type, key } = msg;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[WS] 收到消息 type:', type, 'key 长度:', typeof key === 'string' ? key.length : 0);
      }

      if (type === 'auth') {
        const valid = allowedKeys.includes(key);
        ws.isAuthenticated = valid;
        send(ws, valid ? MSG_AUTH_OK : MSG_AUTH_FAIL, {
          message: valid ? '认证成功' : '密钥无效'
        });
        return;
      }

      if (!ws.isAuthenticated) {
        send(ws, MSG_AUTH_FAIL, { message: '请先完成密钥验证' });
        return;
      }

      if (type === MSG_PING) {
        send(ws, MSG_PONG);
        return;
      }

      if (type === 'stop') {
        ws._stopRequested = true;
        return;
      }

      if (type === 'message' || type === MSG_ECHO) {
        const userContent = msg.content || msg.text || '收到';
        const quick = msg.quick === true;
        const useMcp = msg.mcp === true;
        const sessionId = msg.sessionId || null;

        if (quick) {
          ws._stopRequested = false;
          (async () => {
            const fixed = getQuickFixedModel();
            if (!fixed || !fixed.vendorId || !fixed.modelId) {
              send(ws, MSG_ECHO, {
                content: '请先在「技能」页为「快速」设置固定模型（厂商 + 模型）后再使用快速发送。',
                quick: true,
                timestamp: Date.now()
              });
              return;
            }
            const stored = readApiKeys();
            const apiKey = stored[fixed.vendorId];
            if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
              send(ws, MSG_ECHO, {
                content: `请先在「设置」中保存厂商「${fixed.vendorId}」的 API Key。`,
                quick: true,
                timestamp: Date.now()
              });
              return;
            }
            const provider = getProvider(fixed.vendorId);
            if (!provider || typeof provider.chat !== 'function') {
              send(ws, MSG_ECHO, {
                content: `快速固定模型使用的厂商暂不支持：${fixed.vendorId}`,
                quick: true,
                timestamp: Date.now()
              });
              return;
            }
            let systemContent = CHAT_SYSTEM_PROMPT;
            if (useMcp) {
              systemContent += '\n\n【你已启用 MCP 工具】当用户需求涉及搜索、浏览、文件操作等时，可根据需要调用可用工具。工具返回的是各调用的精华内容（已提炼），请基于这些精华汇总生成回答，直接给出内容，不要加「根据上述」「综上所述」等套话。';
            }
            try {
              const memResult = await queryByText(CHAT_MEMORY_COLLECTION, userContent, CHAT_MEMORY_TOP_K);
              const items = (memResult?.results || []).filter((r) => r?.metadata?.text);
              if (items.length > 0) {
                const memoryLines = items.map((r, i) => `${i + 1}. ${(r.metadata.text || '').trim()}`).filter(Boolean);
                if (memoryLines.length > 0) {
                  systemContent += `\n\n【以下是与当前问题相关的记忆（来自用户加深记忆的内容，供参考）：】\n${memoryLines.join('\n')}`;
                }
              }
            } catch (_) {}

            let tools = [];
            let mcpNameMap = {};
            if (useMcp) {
              try {
                const collected = await collectMcpToolsForOpenAI();
                tools = collected.tools || [];
                mcpNameMap = collected.nameMap || {};
              } catch (e) {
                if (process.env.NODE_ENV !== 'production') console.warn('[MCP] 收集工具失败:', e?.message);
              }
              if (tools.length === 0 && getMcpEnabledServerIdsForChat().length === 0) {
                send(ws, MSG_ECHO, {
                  content: '已选中 MCP，但暂无可用 MCP 服务。请先在「MCP 面板」配置并启用至少一个服务。',
                  quick: true,
                  timestamp: Date.now()
                });
                return;
              }
            }

            /** 判断 MCP 返回是否有实质内容（用于过滤无内容的检索结果） */
            const hasMeaningfulContent = (resultStr, summary) => {
              const emptySummary = !summary || /^（无提炼内容）$|^提炼失败/.test(String(summary).trim());
              if (emptySummary) return false;
              const s = String(resultStr || '').trim();
              if (!s || s.length < 3) return false;
              if (/^[\{\[\]]\s*$/.test(s) || s === 'null' || s === '""') return false;
              try {
                const parsed = JSON.parse(s);
                if (parsed == null) return false;
                if (Array.isArray(parsed) && parsed.length === 0) return false;
                if (typeof parsed === 'object' && Object.keys(parsed).length === 0) return false;
                if (parsed.results && Array.isArray(parsed.results) && parsed.results.length === 0) return false;
                if (parsed.data && Array.isArray(parsed.data) && parsed.data.length === 0) return false;
              } catch {}
              return true;
            };

            /** 用 AI 提取单次 MCP 工具返回的精华内容，返回 { summary, keyword }，供模型和用户使用，避免消耗 token 看原始数据 */
            const summarizeMcpResult = async (toolName, resultStr) => {
              const truncate = (s, max = 6000) =>
                s.length > max ? s.slice(0, max) + '\n...(已截断)' : s;
              const prompt = `请从以下 MCP 工具返回数据中提取精华内容（关键信息、核心结论、重要数据），供后续汇总使用。要求：
1. 第一行：单独输出概括关键词，必须完整表达含义、不可为凑字数而截断。例如「中国能建投资价值」「股票综合评分」「新能源布局与氢能」等，宁可稍长也要表意完整
2. 换行后：输出 8-15 句精华要点，覆盖业务地位、核心数据、发展前景、投资结论等关键信息，保留重要数字（如市占率、营收增速、目标价等），去掉冗余和无关内容，直接给内容，不要加「根据上述」「综上所述」等套话，篇幅适中不要过长

${truncate(resultStr)}`;
              try {
                const res = await provider.chat({
                  apiKey,
                  modelId: fixed.modelId,
                  messages: [{ role: 'user', content: prompt }],
                  stream: false,
                });
                const raw = (res?.content ?? '').trim();
                if (!raw) return { summary: '（无提炼内容）', keyword: null };
                const firstLine = raw.split(/\r?\n/)[0]?.trim() || '';
                const rest = raw.replace(/^[^\n]*\n?/, '').trim();
                const keyword = firstLine.length >= 2 ? firstLine : null;
                const summary = rest || firstLine || '（无提炼内容）';
                return { summary, keyword };
              } catch (e) {
                return { summary: `提炼失败：${e?.message || String(e)}`, keyword: null };
              }
            };

            const runChat = async (messages) => {
              const chatOpts = {
                apiKey,
                modelId: fixed.modelId,
                messages,
                stream: true,
              };
              if (tools.length > 0) chatOpts.tools = tools;

              const streamResult = await provider.chat(chatOpts);
              if (!streamResult || typeof streamResult[Symbol.asyncIterator] !== 'function') {
                const c = streamResult?.content ?? '';
                send(ws, MSG_ECHO, { content: c, reasoning_content: streamResult?.reasoning_content ?? '', quick: true, timestamp: Date.now() });
                return { toolCalls: null, content: c, reasoning: streamResult?.reasoning_content ?? '', alreadySentFinal: true };
              }

              const toolCallsAcc = {};
              let content = '';
              let reasoning = '';
              for await (const chunk of streamResult) {
                if (ws._stopRequested) break;
                const delta = chunk.choices?.[0]?.delta ?? {};
                if (delta.content) content += delta.content;
                if (delta.reasoning_content) reasoning += delta.reasoning_content;
                if (Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                    if (tc.id) toolCallsAcc[idx].id = tc.id;
                    if (tc.function) {
                      if (tc.function.name) toolCallsAcc[idx].function.name += tc.function.name;
                      if (tc.function.arguments) toolCallsAcc[idx].function.arguments += tc.function.arguments || '';
                    }
                  }
                }
                send(ws, MSG_ECHO, {
                  content,
                  reasoning_content: reasoning || undefined,
                  quick: true,
                  streaming: true,
                  messageId: assistantMessageId,
                  mcp_calls: mcpCalls?.length > 0 ? mcpCalls : undefined,
                  timestamp: Date.now()
                });
              }
              if (ws._stopRequested) {
                send(ws, MSG_ECHO, {
                  content,
                  reasoning_content: reasoning || undefined,
                  quick: true,
                  streaming: false,
                  messageId: assistantMessageId,
                  mcp_calls: mcpCalls?.length > 0 ? mcpCalls : undefined,
                  timestamp: Date.now()
                });
              }
              // 不在 runChat 内发送 streaming:false，由调用方统一发送累积后的完整内容

              const toolCalls = Object.keys(toolCallsAcc).length > 0
                ? Object.entries(toolCallsAcc).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, v]) => v)
                : null;
              return { toolCalls, content, reasoning, alreadySentFinal: false };
            };

            let messages = [
              { role: 'system', content: systemContent },
              { role: 'user', content: userContent },
            ];
            const assistantMessageId = crypto.randomUUID();
            let round = 0;
            const maxRounds = useMcp && tools.length > 0 ? 5 : 1;
            let accumulatedContent = '';
            let accumulatedReasoning = '';
            let lastRoundContent = '';
            let lastRoundReasoning = '';
            const mcpCalls = [];
            while (round < maxRounds) {
              let runResult;
              try {
                runResult = await runChat(messages);
              } catch (e) {
                if (process.env.NODE_ENV !== 'production') console.error('[MCP] runChat 异常:', e?.message);
                send(ws, MSG_ECHO, {
                  content: `生成回答时出错：${e?.message || String(e)}`,
                  quick: true,
                  streaming: false,
                  messageId: assistantMessageId,
                  mcp_calls: mcpCalls.length > 0 ? mcpCalls : undefined,
                  timestamp: Date.now()
                });
                break;
              }
              const { toolCalls, content, reasoning, alreadySentFinal } = runResult;
              lastRoundContent = content || '';
              lastRoundReasoning = reasoning || '';
              // 有 tool_calls 时不累积中间内容，避免展示「让我获取...」等
              if (content && (!toolCalls || toolCalls.length === 0)) {
                accumulatedContent += (accumulatedContent ? '\n\n' : '') + content;
              }
              if (reasoning && (!toolCalls || toolCalls.length === 0)) {
                accumulatedReasoning += (accumulatedReasoning ? '\n\n' : '') + reasoning;
              }

              if (!toolCalls || toolCalls.length === 0) {
                if (!alreadySentFinal) {
                  send(ws, MSG_ECHO, {
                    content: accumulatedContent,
                    reasoning_content: accumulatedReasoning || undefined,
                    quick: true,
                    streaming: false,
                    messageId: assistantMessageId,
                    mcp_calls: mcpCalls.length > 0 ? mcpCalls : undefined,
                    timestamp: Date.now()
                  });
                }
                break;
              }
              const lastAssistant = {
                role: 'assistant',
                content: content || null,
                tool_calls: toolCalls,
              };
              messages.push(lastAssistant);
              for (const tc of toolCalls) {
                if (ws._stopRequested) break;
                const name = tc.function?.name || '';
                const args = tc.function?.arguments || '{}';
                const resolved = mcpNameMap[name] || {};
                const serverId = resolved.serverId || '';
                const toolName = resolved.toolName || name;
                // 每个工具执行前发送「正在检索：toolName」，不发送中间内容
                send(ws, MSG_ECHO, {
                  content: '',
                  quick: true,
                  streaming: true,
                  messageId: assistantMessageId,
                  status: 'mcp_retrieving',
                  mcp_tool_name: toolName,
                  timestamp: Date.now()
                });
                try {
                  const result = await executeMcpToolCall(name, args, mcpNameMap);
                  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
                  const { summary, keyword } = await summarizeMcpResult(toolName, resultStr);
                  // 仅展示有实质内容的检索结果，过滤无内容/空结果
                  if (hasMeaningfulContent(resultStr, summary)) {
                    const callData = { serverId, toolName, args, result: resultStr, summary, keyword };
                    mcpCalls.push(callData);
                    if (sessionId) {
                      try { saveMcpResult(assistantMessageId, sessionId, toolName, { result: resultStr, summary, keyword }); } catch {}
                    }
                    // 检索时每完成一个工具就发送总结，让用户看到进度
                    send(ws, MSG_ECHO, {
                      content: '',
                      quick: true,
                      streaming: true,
                      messageId: assistantMessageId,
                      status: 'mcp_retrieving',
                      mcp_tool_name: toolName,
                      mcp_calls: [...mcpCalls],
                      timestamp: Date.now()
                    });
                  }
                  // 传给模型的是精华内容，而非原始数据，节省 token
                  messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: summary,
                  });
                } catch (e) {
                  const errMsg = `调用失败：${e?.message || String(e)}`;
                  const callData = { serverId, toolName, args, result: errMsg, summary: errMsg, keyword: null, error: true };
                  mcpCalls.push(callData);
                  if (sessionId) {
                    try { saveMcpResult(assistantMessageId, sessionId, toolName, { result: errMsg, summary: errMsg }); } catch {}
                  }
                  send(ws, MSG_ECHO, {
                    content: '',
                    quick: true,
                    streaming: true,
                    messageId: assistantMessageId,
                    status: 'mcp_retrieving',
                    mcp_tool_name: toolName,
                    mcp_calls: [...mcpCalls],
                    timestamp: Date.now()
                  });
                  messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: errMsg,
                  });
                }
              }
              // 全部检索结束后立即发送 [mcp] 标签，避免用户以为卡死
              if (mcpCalls.length > 0) {
                send(ws, MSG_ECHO, {
                  content: '',
                  quick: true,
                  streaming: true,
                  messageId: assistantMessageId,
                  status: 'mcp_done',
                  mcp_calls: mcpCalls,
                  timestamp: Date.now()
                });
              }
              if (ws._stopRequested) break;
              round++;
            }
            if (ws._stopRequested) {
              send(ws, MSG_ECHO, {
                content: accumulatedContent,
                reasoning_content: accumulatedReasoning || undefined,
                quick: true,
                streaming: false,
                messageId: assistantMessageId,
                mcp_calls: mcpCalls.length > 0 ? mcpCalls : undefined,
                timestamp: Date.now()
              });
            }
            // 若因达到 maxRounds 退出，发送已累积内容；若无累积但有 MCP 精华，则先发「汇总中」再调用模型总结
            if (!ws._stopRequested && round >= maxRounds) {
              let toSend = accumulatedContent || lastRoundContent;
              if (!toSend && mcpCalls.length > 0) {
                const parts = mcpCalls.filter((c) => c.summary && !c.error).map((c) => `**【${c.keyword || c.toolName}】**\n${c.summary}`);
                if (parts.length > 0) {
                  send(ws, MSG_ECHO, {
                    content: '',
                    quick: true,
                    streaming: true,
                    messageId: assistantMessageId,
                    status: 'mcp_summarizing',
                    mcp_calls: mcpCalls,
                    timestamp: Date.now()
                  });
                  try {
                    const combined = parts.join('\n\n');
                    const synthRes = await provider.chat({
                      apiKey,
                      modelId: fixed.modelId,
                      messages: [
                        { role: 'system', content: '你是一个专业助手。请基于以下 MCP 检索的精华内容，为用户生成一份简洁、结构清晰的总结回答。直接给出内容，不要加「根据上述」「综上所述」等套话。' },
                        { role: 'user', content: `用户问题：${userContent}\n\n以下是各工具检索的精华内容，请汇总成连贯回答：\n\n${combined}` }
                      ],
                      stream: false,
                    });
                    toSend = (synthRes?.content ?? '').trim() || '（汇总失败，请重试）';
                  } catch (e) {
                    if (process.env.NODE_ENV !== 'production') console.error('[MCP] 汇总调用异常:', e?.message);
                    toSend = `（汇总失败：${e?.message || String(e)}）`;
                  }
                  send(ws, MSG_ECHO, {
                    content: toSend,
                    quick: true,
                    streaming: false,
                    messageId: assistantMessageId,
                    mcp_calls: mcpCalls,
                    timestamp: Date.now()
                  });
                } else {
                  toSend = '（生成被中断，请重试）';
                  send(ws, MSG_ECHO, {
                    content: toSend,
                    quick: true,
                    streaming: false,
                    messageId: assistantMessageId,
                    mcp_calls: mcpCalls.length > 0 ? mcpCalls : undefined,
                    timestamp: Date.now()
                  });
                }
              } else {
                toSend = toSend || '（生成被中断，请重试）';
                const toSendReasoning = accumulatedReasoning || lastRoundReasoning || undefined;
                send(ws, MSG_ECHO, {
                  content: toSend,
                  reasoning_content: toSendReasoning,
                  quick: true,
                  streaming: false,
                  messageId: assistantMessageId,
                  mcp_calls: mcpCalls.length > 0 ? mcpCalls : undefined,
                  timestamp: Date.now()
                });
              }
            }
          })().catch((err) => {
            send(ws, MSG_ECHO, {
              content: `调用失败：${err?.message || String(err)}`,
              quick: true,
              timestamp: Date.now()
            });
          });
          return;
        }

        send(ws, MSG_ECHO, {
          content: userContent,
          quick: false,
          timestamp: Date.now()
        });
        return;
      }
    });

    ws.on('close', () => {});
    ws.on('error', (err) => {
      console.error('WebSocket 错误:', err.message);
    });
  };
}

module.exports = { createConnectionHandler };
