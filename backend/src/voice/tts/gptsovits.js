const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../../data');
const GPTSOVITS_DIR = path.join(DATA_DIR, 'runtime', 'gptsovits');
const VOICES_FILE = path.join(GPTSOVITS_DIR, 'voices.json');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/**
 * voices.json 格式（示例）
 * [
 *   {
 *     "id": "xiaohan_demo",
 *     "label": "小寒（示例）",
 *     "apiUrl": "http://127.0.0.1:9880",
 *     "refAudioPath": "D:/.../ref.wav",
 *     "promptText": "参考音频对应的文字",
 *     "promptLang": "zh",
 *     "textLang": "zh"
 *   }
 * ]
 */
function listGptSoVitsVoices() {
  // 这里只预留入口：未来接入真实 GPT-SoVITS 推理服务后，
  // 再从本地配置/模型目录读取可选音色列表并返回。
  return [];
}

async function synthesizeWithGptSoVits() {
  // 这里只预留入口：未来接入真实 GPT-SoVITS 推理服务后，
  // 再实现合成逻辑（HTTP/进程守护/本地模型等）。
  throw new Error('GPT-SoVITS 尚未接入：当前仅保留引擎入口（占位）');
}

module.exports = {
  GPTSOVITS_DIR,
  VOICES_FILE,
  listGptSoVitsVoices,
  synthesizeWithGptSoVits,
};

