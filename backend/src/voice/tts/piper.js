const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { execFile } = require('child_process');

function getPiperBinDir() {
  // backend/src/voice/tts -> backend/piper/bin
  return path.join(__dirname, '..', '..', '..', 'piper', 'bin');
}

function getPiperExe() {
  const exe = path.join(getPiperBinDir(), 'piper.exe');
  return fs.existsSync(exe) ? exe : null;
}

function getPiperModelsDir() {
  return path.join(__dirname, '..', '..', '..', 'piper', 'models');
}

function copyDirSync(src, dst) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function ensurePiperRuntimeInTemp() {
  const srcBin = getPiperBinDir();
  const srcExe = path.join(srcBin, 'piper.exe');
  if (!fs.existsSync(srcExe)) {
    throw new Error('未找到 Piper 可执行文件：backend/piper/bin/piper.exe');
  }

  const base = path.join(os.tmpdir(), 'openaui-piper');
  const dstBin = path.join(base, 'bin');
  const dstModels = path.join(base, 'models');
  if (!fs.existsSync(dstBin)) fs.mkdirSync(dstBin, { recursive: true });
  if (!fs.existsSync(dstModels)) fs.mkdirSync(dstModels, { recursive: true });

  // 只复制必要运行时文件（避免重复大量拷贝）
  const runtimeFiles = [
    'piper.exe',
    'piper_phonemize.dll',
    'espeak-ng.dll',
    'onnxruntime.dll',
    'onnxruntime_providers_shared.dll',
    'libtashkeel_model.ort',
  ];
  for (const f of runtimeFiles) {
    const s = path.join(srcBin, f);
    const d = path.join(dstBin, f);
    if (fs.existsSync(s) && !fs.existsSync(d)) fs.copyFileSync(s, d);
  }
  const espeakSrc = path.join(srcBin, 'espeak-ng-data');
  const espeakDst = path.join(dstBin, 'espeak-ng-data');
  if (fs.existsSync(espeakSrc) && !fs.existsSync(espeakDst)) copyDirSync(espeakSrc, espeakDst);

  return { dstBin, dstModels };
}

function ensureModelInTemp(voiceId, dstModels) {
  const id = String(voiceId || '').trim();
  const src = path.join(getPiperModelsDir(), `${id}.onnx`);
  // 兼容两种元数据命名：
  // 1) 官方常见：xxx.onnx.json
  // 2) 社区常见：xxx.json
  const srcJson = path.join(getPiperModelsDir(), `${id}.onnx.json`);
  const srcJsonAlt = path.join(getPiperModelsDir(), `${id}.json`);
  const dst = path.join(dstModels, `${id}.onnx`);
  const dstJson = path.join(dstModels, `${id}.onnx.json`);
  if (!fs.existsSync(src)) return null;
  if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
  if (!fs.existsSync(dstJson)) {
    if (fs.existsSync(srcJson)) fs.copyFileSync(srcJson, dstJson);
    else if (fs.existsSync(srcJsonAlt)) fs.copyFileSync(srcJsonAlt, dstJson);
  }
  return dst;
}

function listPiperVoices() {
  const dir = getPiperModelsDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.onnx'));
  return files
    .map((f) => {
      const id = f.replace(/\.onnx$/i, '');
      const jsonPath = path.join(dir, `${id}.onnx.json`);
      const jsonPathAlt = path.join(dir, `${id}.json`);
      let meta = null;
      try {
        if (fs.existsSync(jsonPath)) meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        else if (fs.existsSync(jsonPathAlt)) meta = JSON.parse(fs.readFileSync(jsonPathAlt, 'utf8'));
      } catch {}
      const quality = id.includes('x_low') ? 'x_low' : id.includes('medium') ? 'medium' : '';
      const label = quality ? `${id}（${quality}）` : id;
      return {
        id,
        label,
        sampleRate: meta?.audio?.sample_rate ?? null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function resolvePiperModelPath(voiceId) {
  const id = String(voiceId || '').trim();
  if (!id) return null;
  const p = path.join(getPiperModelsDir(), `${id}.onnx`);
  return fs.existsSync(p) ? p : null;
}

function rateToLengthScale(rate) {
  const r = Number.isFinite(rate) ? Math.max(-10, Math.min(10, rate)) : 0;
  // rate 越大越快 => length_scale 越小
  const s = 1.0 - (r * 0.04);
  return Math.max(0.55, Math.min(1.6, s));
}

function pickPiperTuning(voiceId) {
  // 轻微调参，让中文听感更自然一点；核心质量仍取决于模型（medium 明显好于 x_low）
  const id = String(voiceId || '');
  const isLow = id.includes('x_low') || id.includes('low');
  return {
    noiseScale: isLow ? 0.75 : 0.667,
    noiseW: isLow ? 0.9 : 0.8,
    sentenceSilence: isLow ? 0.25 : 0.22,
  };
}

async function synthesizeWithPiper({ text, outPath, voiceId, rate = 0 }) {
  if (process.platform !== 'win32') {
    throw new Error('Piper 当前仅在 Windows 环境已集成');
  }
  const { dstBin, dstModels } = ensurePiperRuntimeInTemp();
  const exe = path.join(dstBin, 'piper.exe');

  const modelPath = ensureModelInTemp(voiceId, dstModels);
  if (!modelPath) {
    throw new Error(`未找到 Piper 模型：${voiceId || '(空)'}。请把模型放到 backend/piper/models/*.onnx`);
  }

  const out = path.resolve(outPath);
  const lengthScale = rateToLengthScale(rate);
  const tuning = pickPiperTuning(voiceId);

  const espeakData = path.join(dstBin, 'espeak-ng-data');

  // echo "text" | piper.exe -m model.onnx -f out.wav --length_scale 0.9
  return new Promise((resolve, reject) => {
    const p = spawn(
      exe,
      [
        '-m', modelPath,
        '-f', out,
        '--length_scale', String(lengthScale),
        '--noise_scale', String(tuning.noiseScale),
        '--noise_w', String(tuning.noiseW),
        '--sentence_silence', String(tuning.sentenceSilence),
        '--espeak_data', espeakData,
      ],
      {
      cwd: path.dirname(exe),
      windowsHide: true,
      env: {
        ...process.env,
        PATH: `${path.dirname(exe)};${process.env.PATH || ''}`,
      },
      }
    );
    let stderr = '';
    p.stderr?.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error((stderr || `Piper 合成失败（code=${code}）`).trim()));
    });
    p.stdin.write(String(text || ''));
    p.stdin.end();
  });
}

module.exports = {
  listPiperVoices,
  synthesizeWithPiper,
};

