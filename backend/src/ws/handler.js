/**
 * WebSocket 连接处理：认证与消息分发
 * 当 message 带 quick: true 时，使用技能设置中的「快速-固定模型」调用接口，不再走默认 echo
 */
const MSG_AUTH_REQUIRED = 'auth_required';
const MSG_AUTH_OK = 'auth_ok';
const MSG_AUTH_FAIL = 'auth_fail';
const MSG_PING = 'ping';
const MSG_PONG = 'pong';
const MSG_ECHO = 'echo';

const { getQuickFixedModel } = require('../skill-settings-store');
const { readApiKeys } = require('../apikeys-store');
const { getProvider } = require('../services/modelProviders');
const { CHAT_SYSTEM_PROMPT } = require('../config/chatSystemPrompt');
const { queryByText } = require('../vectra');

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

      if (type === 'message' || type === MSG_ECHO) {
        const userContent = msg.content || msg.text || '收到';
        const quick = msg.quick === true;

        if (quick) {
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
            provider.chat({
              apiKey,
              modelId: fixed.modelId,
              messages: [
                { role: 'system', content: systemContent },
                { role: 'user', content: userContent },
              ],
              stream: true
            }).then(async (streamResult) => {
              if (streamResult && typeof streamResult[Symbol.asyncIterator] === 'function') {
                let content = '';
                let reasoning = '';
                for await (const chunk of streamResult) {
                  const delta = chunk.choices?.[0]?.delta ?? {};
                  if (delta.content) content += delta.content;
                  if (delta.reasoning_content) reasoning += delta.reasoning_content;
                  send(ws, MSG_ECHO, {
                    content,
                    reasoning_content: reasoning || undefined,
                    quick: true,
                    streaming: true,
                    timestamp: Date.now()
                  });
                }
                send(ws, MSG_ECHO, {
                  content,
                  reasoning_content: reasoning || undefined,
                  quick: true,
                  streaming: false,
                  timestamp: Date.now()
                });
              } else {
                send(ws, MSG_ECHO, {
                  content: (streamResult?.content ?? '') || '',
                  reasoning_content: streamResult?.reasoning_content ?? '',
                  quick: true,
                  timestamp: Date.now()
                });
              }
            }).catch((err) => {
              send(ws, MSG_ECHO, {
                content: `调用失败：${err?.message || String(err)}`,
                quick: true,
                timestamp: Date.now()
              });
            });
          })();
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
