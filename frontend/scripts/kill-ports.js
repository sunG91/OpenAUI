/**
 * 启动前释放 5173（Vite）、9527/9528/9529（后端），避免 EADDRINUSE
 * 用法: node scripts/kill-ports.js
 */
const { execSync } = require('child_process');
const ports = [5173, 9527, 9528, 9529];

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = out.trim().split(/\r?\n/).filter((l) => l.includes('LISTENING'));
      const pids = new Set();
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`[kill-ports] 已结束进程 ${pid} (端口 ${port})`);
        } catch (e) {}
      }
    } else {
      execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
      console.log(`[kill-ports] 已释放端口 ${port}`);
    }
  } catch (e) {
    // 无进程占用时 netstat/lsof 会抛，忽略
  }
}

ports.forEach(killPort);
