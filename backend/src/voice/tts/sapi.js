const { spawn } = require('child_process');
const path = require('path');

function escapePsString(s) {
  return String(s).replace(/'/g, "''");
}

async function listSapiVoices() {
  if (process.platform !== 'win32') return [];
  const ps = `
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name };
$synth.Dispose();
$voices | ConvertTo-Json -Compress
`;
  return new Promise((resolve, reject) => {
    const p = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error((stderr || `获取音色失败（code=${code}）`).trim()));
      try {
        const arr = JSON.parse(stdout || '[]');
        resolve(Array.isArray(arr) ? arr : []);
      } catch {
        resolve([]);
      }
    });
  });
}

async function synthesizeWithSapi({ text, outPath, voice = '', rate = 0 }) {
  if (process.platform !== 'win32') {
    throw new Error('Windows SAPI 仅支持在 Windows 上运行');
  }
  const out = path.resolve(outPath);
  const ps = `
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
${voice ? `$synth.SelectVoice('${escapePsString(voice)}');` : ''}
$synth.Rate = ${Number.isFinite(rate) ? Math.max(-10, Math.min(10, rate)) : 0};
$synth.SetOutputToWaveFile('${escapePsString(out)}');
$synth.Speak('${escapePsString(text)}');
$synth.Dispose();
`;

  return new Promise((resolve, reject) => {
    const p = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      windowsHide: true,
    });
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error((stderr || `SAPI 合成失败（code=${code}）`).trim()));
    });
  });
}

module.exports = { synthesizeWithSapi, listSapiVoices };

