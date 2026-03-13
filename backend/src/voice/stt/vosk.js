const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function defaultVoskModelDir() {
  return path.join(__dirname, '..', '..', '..', 'vosk', 'model');
}

function runPython(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const p = spawn('python', [scriptPath, ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    p.stdout?.on('data', (d) => (stdout += d.toString()));
    p.stderr?.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error((stderr || stdout || `vosk(py) 退出码 ${code}`).trim()));
    });
  });
}

async function transcribeWithVosk(wavPath, settings = {}) {
  const modelDir = settings.voskModelPath || defaultVoskModelDir();
  if (!fs.existsSync(modelDir)) {
    throw new Error(`未找到 Vosk 模型目录：${modelDir}\n请放置到 backend/vosk/model 或在语音设置里指定 voskModelPath`);
  }
  if (!fs.existsSync(wavPath)) {
    throw new Error(`找不到输入音频：${wavPath}`);
  }

  const script = path.join(__dirname, 'vosk_transcribe.py');
  if (!fs.existsSync(script)) {
    throw new Error(`缺少脚本：${script}`);
  }

  const { stdout } = await runPython(script, ['--model', modelDir, '--wav', wavPath]);
  try {
    const data = JSON.parse(stdout);
    return data?.text || '';
  } catch {
    return String(stdout || '').trim();
  }
}

module.exports = { transcribeWithVosk };

