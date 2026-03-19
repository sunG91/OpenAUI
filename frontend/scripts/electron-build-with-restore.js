/**
 * 打包流程：electron-builder → 嵌入图标 → 初始化打包后的 data 为默认空配置
 * 用法：node electron-build-with-restore.js [-- --dir]  传 --dir 给 electron-builder
 */
const { spawnSync } = require('child_process');
const path = require('path');

const dashIdx = process.argv.indexOf('--');
const extraArgs = dashIdx >= 0 ? process.argv.slice(dashIdx + 1) : [];
const cwd = path.join(__dirname, '..');
const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };

function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd,
    env,
    ...opts,
  });
  return r.status;
}

console.log('[electron-build] 正在运行 electron-builder...');
// 直接调用 electron-builder 避免 npx 在 npm 脚本链中的异常
const electronBuilderCli = path.join(cwd, 'node_modules', 'electron-builder', 'cli.js');
const result = spawnSync(process.execPath, [electronBuilderCli, ...extraArgs], {
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'pipe'],
  cwd,
  env,
});
const out = (result.stdout || '') + (result.stderr || '');
if (out) process.stdout.write(out);
const exitCode = result.status ?? 1;
console.log('\n[electron-build] electron-builder 退出码:', exitCode);
// 无论成功失败都尝试嵌入图标（exe 可能已生成）
run('node', [path.join(__dirname, 'embed-icon.js')]);
// 初始化打包后的 data 为默认空配置（不修改本地）
run('node', [path.join(__dirname, 'init-packaged-data.js')]);

process.exit(exitCode);
