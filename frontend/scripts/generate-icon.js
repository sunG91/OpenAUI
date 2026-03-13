/**
 * 生成 Electron 打包用图标（Windows: .ico）
 * 来源：frontend/public/images/头像/ai.png
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pngToIco = require('png-to-ico');

const projectRoot = path.join(__dirname, '..');
const srcPng = path.join(projectRoot, 'public', 'images', '头像', 'ai.png');
const outDir = path.join(projectRoot, 'build');
const outPng = path.join(outDir, 'icon.png');
const outIco = path.join(outDir, 'icon.ico');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  if (!fs.existsSync(srcPng)) {
    console.error(`[gen:icon] 未找到源头像：${srcPng}`);
    process.exit(1);
  }

  ensureDir(outDir);

  let pngBuf = fs.readFileSync(srcPng);
  // 有些工具会在 PNG 的 IEND 之后追加自定义数据，png-to-ico 会认为不是合法 PNG。
  // 这里截断到 IEND chunk 结束，确保兼容。
  const IEND_SIG = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const iendIdx = pngBuf.indexOf(IEND_SIG);
  if (iendIdx !== -1) {
    pngBuf = pngBuf.slice(0, iendIdx + IEND_SIG.length);
  }

  // png-to-ico 要求输入是正方形 PNG，这里自动居中补边成正方形
  const srcImg = PNG.sync.read(pngBuf);
  const size = Math.max(srcImg.width, srcImg.height);
  const dstImg = new PNG({ width: size, height: size });
  dstImg.data.fill(0); // 透明背景
  const offsetX = Math.floor((size - srcImg.width) / 2);
  const offsetY = Math.floor((size - srcImg.height) / 2);
  PNG.bitblt(srcImg, dstImg, 0, 0, srcImg.width, srcImg.height, offsetX, offsetY);

  const squarePngBuf = PNG.sync.write(dstImg);
  fs.writeFileSync(outPng, squarePngBuf);

  const icoBuf = await pngToIco(squarePngBuf);
  fs.writeFileSync(outIco, icoBuf);

  console.log(`[gen:icon] 已生成：${outIco}`);
}

main().catch((e) => {
  console.error('[gen:icon] 生成失败：', e);
  process.exit(1);
});

