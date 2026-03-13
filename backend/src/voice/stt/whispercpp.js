const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function defaultWhisperPaths() {
  return {
    // 约定位置：backend/whisper/bin/main.exe 与 backend/whisper/models/ggml-base.bin
    bin: path.join(__dirname, '..', '..', '..', 'whisper', 'bin', 'main.exe'),
    model: path.join(__dirname, '..', '..', '..', 'whisper', 'models', 'ggml-base.bin'),
  };
}

function spawnExe(exePath, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(exePath, args, { windowsHide: true, ...opts });
    let stdout = '';
    let stderr = '';
    p.stdout?.on('data', (d) => (stdout += d.toString()));
    p.stderr?.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error((stderr || stdout || `whisper.cpp 退出码 ${code}`).trim()));
    });
  });
}

async function transcribeWithWhisperCpp(wavPath, settings = {}) {
  const { bin, model } = defaultWhisperPaths();
  const exePath = settings.whisperCppBinPath || bin;
  const modelPath = settings.whisperCppModelPath || model;

  if (!fs.existsSync(exePath)) {
    throw new Error(`未找到 whisper.cpp 可执行文件：${exePath}\n请放置到 backend/whisper/bin/main.exe 或在语音设置里指定 whisperCppBinPath`);
  }
  if (!fs.existsSync(modelPath)) {
    throw new Error(`未找到 whisper.cpp 模型文件：${modelPath}\n请放置到 backend/whisper/models/ggml-*.bin 或在语音设置里指定 whisperCppModelPath`);
  }
  if (!fs.existsSync(wavPath)) {
    throw new Error(`找不到输入音频：${wavPath}`);
  }

  // whisper.cpp main 常用参数：-m model -f wav -otxt -of outPrefix
  // 这里为了简单，直接用 stdout 输出（不同版本输出不同），优先用 -otxt 写文件更稳。
  const outPrefix = wavPath + '.whisper';
  await spawnExe(exePath, ['-m', modelPath, '-f', wavPath, '-otxt', '-of', outPrefix]);

  const txtPath = outPrefix + '.txt';
  if (fs.existsSync(txtPath)) {
    return fs.readFileSync(txtPath, 'utf8');
  }
  // 兜底
  return '';
}

module.exports = { transcribeWithWhisperCpp };

