/**
 * 批量下载视觉模型到 vision-models 目录
 * 运行：node scripts/download-vision-models.js
 * 或：npm run vision:download-all
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../data/vision-models');
const PT_DIR = path.join(OUT_DIR, 'pt-sources');

const MODELS = [
  {
    name: 'yolov8n.onnx',
    url: 'https://huggingface.co/Kalray/yolov8/resolve/main/yolov8n.onnx',
    desc: 'YOLOv8n 通用 80 类（轻量 12MB）',
  },
  {
    name: 'yolov8s.onnx',
    url: 'https://huggingface.co/Kalray/yolov8/resolve/main/yolov8s.onnx',
    desc: 'YOLOv8s 通用 80 类（约 45MB，更准）',
  },
  {
    name: 'yolov8m.onnx',
    url: 'https://huggingface.co/Kalray/yolov8/resolve/main/yolov8m.onnx',
    desc: 'YOLOv8m 通用 80 类（约 104MB，高精度）',
  },
  {
    name: 'windows-ui-locator.pt',
    url: 'https://huggingface.co/IndextDataLab/windows-ui-locator/resolve/main/best.pt',
    desc: 'Windows UI 专用（按钮/输入框等，需转换）',
    subdir: 'pt-sources',
  },
  {
    name: 'gpa-gui-detector.pt',
    url: 'https://huggingface.co/Salesforce/GPA-GUI-Detector/resolve/main/model.pt',
    desc: 'Salesforce GUI 检测（图标/按钮等，需转换）',
    subdir: 'pt-sources',
  },
];

function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; openAUI/1.0)' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(PT_DIR)) fs.mkdirSync(PT_DIR, { recursive: true });

  console.log('开始下载视觉模型到', OUT_DIR, '\n');

  for (const m of MODELS) {
    const outPath = m.subdir ? path.join(OUT_DIR, m.subdir, m.name) : path.join(OUT_DIR, m.name);
    if (fs.existsSync(outPath)) {
      console.log(`[跳过] ${m.name} 已存在`);
      continue;
    }
    process.stdout.write(`[下载] ${m.name} (${m.desc})... `);
    try {
      const buf = await download(m.url);
      fs.writeFileSync(outPath, buf);
      console.log(`完成 (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e) {
      console.log(`失败: ${e.message}`);
    }
  }

  const ptFiles = fs.readdirSync(PT_DIR).filter((f) => f.endsWith('.pt'));
  if (ptFiles.length > 0) {
    console.log('\n--- .pt 模型需转换为 ONNX 才能使用 ---');
    console.log('若已安装 Python 和 ultralytics，可运行：');
    console.log('  cd backend && node scripts/convert-pt-to-onnx.js');
    console.log('或手动：yolo export model=data/vision-models/pt-sources/xxx.pt format=onnx');
  }
  console.log('\n下载完成。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
