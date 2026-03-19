#!/usr/bin/env node
/**
 * 一键安装前后端所有依赖（跨平台：Windows / Linux / macOS）
 *
 * 执行：node scripts/install-all.js
 * 或：  npm run install-all  （在项目根目录）
 *
 * 包含：
 * - 前端 npm 依赖
 * - 后端 npm 依赖
 * - Playwright Chromium（浏览器自动化）
 * - Python 可选依赖：vosk, ultralytics（记忆存储已改用 Vectra，无需 zvec）
 * - 视觉模型下载（可选）
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND = path.join(ROOT, 'backend');

const isWin = process.platform === 'win32';

function run(cmd, args, cwd = ROOT, desc = '') {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: isWin,
      windowsHide: true,
    });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${desc || cmd} 退出码 ${code}`));
    });
  });
}

function runSilent(cmd, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: 'pipe', shell: isWin, windowsHide: true });
    let out = '';
    let err = '';
    p.stdout?.on('data', (d) => (out += d.toString()));
    p.stderr?.on('data', (d) => (err += d.toString()));
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
}

async function hasCommand(cmd) {
  const check = isWin ? ['where', cmd] : ['which', cmd];
  return runSilent(check[0], [check[1]]);
}

async function getPythonVersion(pyCmd) {
  return new Promise((resolve) => {
    const p = spawn(pyCmd, ['-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], {
      stdio: 'pipe',
      shell: isWin,
      windowsHide: true,
    });
    let out = '';
    p.stdout?.on('data', (d) => (out += d.toString()));
    p.on('error', () => resolve(null));
    p.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });
}

function showHelp() {
  console.log(`
用法: node scripts/install-all.js [选项]
  或: npm run install-all

选项:
  --skip-playwright  跳过 Playwright Chromium 安装
  --skip-python      跳过 Python 依赖（vosk/ultralytics）
  --skip-vision      跳过视觉模型下载
  --vision-only      仅下载视觉模型
  --help             显示此帮助
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  const skipPlaywright = args.includes('--skip-playwright');
  const skipPython = args.includes('--skip-python');
  const skipVision = args.includes('--skip-vision');
  const visionOnly = args.includes('--vision-only');

  console.log('\n=== Open AUI 一键依赖安装 ===\n');
  console.log('平台:', process.platform, process.arch);
  if (args.length) console.log('参数:', args.join(' '));
  console.log('');

  try {
    if (!visionOnly) {
      // 1. 前端 npm
      console.log('>>> 1/4 安装前端依赖...');
      if (!fs.existsSync(path.join(FRONTEND, 'package.json'))) {
        throw new Error('未找到 frontend/package.json');
      }
      await run('npm', ['install'], FRONTEND, '前端 npm install');
      console.log('    前端依赖完成\n');

      // 2. 后端 npm
      console.log('>>> 2/4 安装后端依赖...');
      if (!fs.existsSync(path.join(BACKEND, 'package.json'))) {
        throw new Error('未找到 backend/package.json');
      }
      await run('npm', ['install'], BACKEND, '后端 npm install');
      console.log('    后端依赖完成\n');

      // 3. Playwright Chromium
      if (!skipPlaywright) {
        console.log('>>> 3/4 安装 Playwright Chromium...');
        const env = { ...process.env };
        env.PLAYWRIGHT_DOWNLOAD_HOST = env.PLAYWRIGHT_DOWNLOAD_HOST || 'https://registry.npmmirror.com/-/binary/playwright';
        const p = spawn('npx', ['playwright', 'install', 'chromium'], {
          cwd: BACKEND,
          stdio: 'inherit',
          shell: isWin,
          env,
          windowsHide: true,
        });
        await new Promise((res, rej) => {
          p.on('close', (c) => (c === 0 ? res() : rej(new Error('Playwright 安装失败'))));
        });
        console.log('    Playwright Chromium 完成\n');
      } else {
        console.log('>>> 3/4 跳过 Playwright (--skip-playwright)\n');
      }

      // 4. Python 可选依赖
      if (!skipPython) {
        console.log('>>> 4/4 安装 Python 可选依赖...');
        let py = (await hasCommand('python')) ? 'python' : null;
        if (!py && (await hasCommand('python3'))) py = 'python3';
        if (py) {
          const pyVerStr = await getPythonVersion(py);
          if (pyVerStr) console.log(`    检测到 Python ${pyVerStr}`);

          // vosk
          try {
            await run(py, ['-m', 'pip', 'install', 'vosk', '-q'], ROOT, 'pip vosk');
            console.log('    vosk 已安装');
          } catch (e) {
            console.log(`    vosk 跳过: ${e.message}`);
          }

          // ultralytics（抑制 PATH 警告）
          try {
            await run(py, ['-m', 'pip', 'install', 'ultralytics', '-q', '--no-warn-script-location'], ROOT, 'pip ultralytics');
            console.log('    ultralytics 已安装');
          } catch (e) {
            console.log(`    ultralytics 跳过: ${e.message}`);
          }

          console.log('    Python 依赖完成\n');
        } else {
          console.log('    未检测到 Python，跳过 (使用 --skip-python 显式跳过)\n');
        }
      } else {
        console.log('>>> 4/4 跳过 Python 依赖 (--skip-python)\n');
      }
    }

    // 5. 视觉模型（可选）
    if (!skipVision && !visionOnly) {
      console.log('>>> 5/5 下载视觉模型（可选）...');
      const dlScript = path.join(BACKEND, 'scripts', 'download-vision-models.js');
      if (fs.existsSync(dlScript)) {
        try {
          await run('node', [dlScript], BACKEND, '下载视觉模型');
          console.log('    视觉模型完成\n');
        } catch (e) {
          console.log('    视觉模型跳过:', e.message, '\n');
        }
      } else {
        console.log('    跳过视觉模型\n');
      }
    } else if (visionOnly) {
      console.log('>>> 仅下载视觉模型...');
      const dlScript = path.join(BACKEND, 'scripts', 'download-vision-models.js');
      if (fs.existsSync(dlScript)) {
        await run('node', [dlScript], BACKEND, '下载视觉模型');
      }
      console.log('    完成\n');
    }

    console.log('=== 全部完成 ===\n');
  } catch (e) {
    console.error('\n安装失败:', e.message);
    process.exit(1);
  }
}

main();
