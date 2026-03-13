const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function getBundledFfmpegBinDir() {
  // backend/src/ffmpeg/ffmpeg.js -> backend/ffmpeg/bin
  return path.join(__dirname, '..', '..', 'ffmpeg', 'bin');
}

function resolveBundledExe(name) {
  const binDir = getBundledFfmpegBinDir();
  const exePath = path.join(binDir, name);
  return fs.existsSync(exePath) ? exePath : null;
}

function execBundled(exeName, args, opts = {}) {
  const exePath = resolveBundledExe(exeName);
  if (!exePath) {
    const binDir = getBundledFfmpegBinDir();
    throw new Error(`未找到 ${exeName}，请确认存在：${path.join(binDir, exeName)}`);
  }
  const binDir = path.dirname(exePath);
  return new Promise((resolve, reject) => {
    const p = spawn(exePath, args, {
      cwd: binDir,
      windowsHide: true,
      env: {
        ...process.env,
        // 让 exe 能找到同目录下的 *.dll
        PATH: `${binDir};${process.env.PATH || ''}`
      },
      ...opts
    });
    let stdout = '';
    let stderr = '';
    p.stdout?.on('data', (d) => (stdout += d.toString()));
    p.stderr?.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const err = new Error(`${exeName} 退出码 ${code}\n${stderr || stdout}`.trim());
      err.code = code;
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

async function getFfmpegVersion() {
  const { stdout, stderr } = await execBundled('ffmpeg.exe', ['-version']);
  return (stdout || stderr || '').split('\n')[0]?.trim() || '';
}

module.exports = {
  getBundledFfmpegBinDir,
  execBundled,
  getFfmpegVersion
};

