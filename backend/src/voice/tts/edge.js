const path = require('path');
const fs = require('fs');

const { MsEdgeTTS, OUTPUT_FORMAT } = require('edge-tts-node');

const EDGE_ZH_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '甜美女声' },
  { id: 'zh-CN-YunxiNeural', label: '沉稳男声' },
  { id: 'zh-CN-YunxiaoNeural', label: '年轻男声' },
  { id: 'zh-CN-XiaoyiNeural', label: '清新女声' },
];

function listEdgeZhVoices() {
  return EDGE_ZH_VOICES.map((v) => ({ id: v.id, label: `${v.id}：${v.label}` }));
}

function ensureOutDir(outPath) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function synthesizeWithEdgeTts({ text, outPath, voice, rate }) {
  ensureOutDir(outPath);
  const voiceName = voice || 'zh-CN-XiaoxiaoNeural';

  // edge-tts-node 输出为 webm/opus 更稳（库原生支持）。
  // 为了和现有链路一致（返回 /media/tts/*.wav），这里先落地 webm，
  // 再由现有的 ffmpeg 转成 wav。（在 routes/voice.js 里处理转换）
  // 在部分网络环境（公司/校园网/国内网络）需要代理才能连上微软 TTS 服务。
  // 支持标准环境变量：HTTPS_PROXY / HTTP_PROXY（任选其一）。
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  let agent = undefined;
  if (proxyUrl) {
    // https-proxy-agent 在新版本可能仅提供 ESM exports；在 CJS 下用动态 import 兼容
    const mod = await import('https-proxy-agent');
    const HttpsProxyAgent = mod.HttpsProxyAgent || mod.default?.HttpsProxyAgent || mod.default;
    if (typeof HttpsProxyAgent !== 'function') {
      throw new Error('代理模块加载失败：未找到 HttpsProxyAgent');
    }
    agent = new HttpsProxyAgent(proxyUrl);
  }
  const tts = agent ? new MsEdgeTTS(agent) : new MsEdgeTTS({});
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);

  const tmpWebm = outPath.replace(/\.wav$/i, '.webm');
  // 说明：库的 rate 是“倍速”，例如 0.5/1.0/1.5。
  // 我们把 UI 的 -10~10 映射到 0.75~1.25（更自然，且避免 0 这类非法值导致失败）。
  const r = typeof rate === 'number' ? rate : 0;
  const speed = Math.max(0.75, Math.min(1.25, 1 + r / 40));
  const opts = { rate: speed };
  await tts.toFile(tmpWebm, String(text || ''), opts);
  return { tmpWebm };
}

module.exports = {
  listEdgeZhVoices,
  synthesizeWithEdgeTts,
};

