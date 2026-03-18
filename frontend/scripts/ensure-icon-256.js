/**
 * 打包前确保 icon256.ico 为 256x256，供 electron-builder 使用
 * 源图优先级：public/images/icon/icon256.ico > icon.ico > images/头像/ai.png
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pngToIco = require('png-to-ico');

const projectRoot = path.join(__dirname, '..');
const publicIcon = path.join(projectRoot, 'public', 'images', 'icon');
const publicAvatar = path.join(projectRoot, 'public', 'images', '头像');
const outDir = path.join(projectRoot, 'dist-app', 'images', 'icon');
const outIco = path.join(outDir, 'icon256.ico');
const TARGET = 256;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function resizePng(srcPng, dstSize) {
  const src = PNG.sync.read(srcPng);
  const dst = new PNG({ width: dstSize, height: dstSize });
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const srcX = Math.floor((x * src.width) / dstSize);
      const srcY = Math.floor((y * src.height) / dstSize);
      const srcIdx = (srcY * src.width + srcX) << 2;
      const dstIdx = (y * dstSize + x) << 2;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return PNG.sync.write(dst);
}

async function main() {
  ensureDir(outDir);
  const candidates = [
    path.join(publicIcon, 'icon256.ico'),
    path.join(publicIcon, 'icon.ico'),
    path.join(publicIcon, 'icon.png'),
    path.join(publicAvatar, 'ai.png'),
  ];
  const srcPath = candidates.find((p) => fs.existsSync(p));
  if (!srcPath) {
    console.warn('[ensure-icon-256] 未找到源图，跳过');
    return;
  }
  let pngBuf = fs.readFileSync(srcPath);
  if (srcPath.endsWith('.ico')) {
    const icoToPng = require('ico-to-png');
    pngBuf = await icoToPng(pngBuf, TARGET, { scaleUp: true });
  }
  const IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const i = pngBuf.indexOf(IEND);
  if (i !== -1) pngBuf = pngBuf.slice(0, i + IEND.length);
  const png256 = resizePng(pngBuf, TARGET);
  const icoBuf = await pngToIco(png256);
  fs.writeFileSync(outIco, icoBuf);
  console.log('[ensure-icon-256] 已生成 256x256:', outIco);
}

main().catch((e) => {
  console.error('[ensure-icon-256] 失败:', e);
  process.exit(1);
});
