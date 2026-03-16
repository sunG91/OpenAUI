/**
 * 下载 YOLOv8n ONNX 模型到 vision-models 目录
 * 运行：npm run vision:download-model
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const URL = 'https://huggingface.co/Kalray/yolov8/resolve/main/yolov8n.onnx';
const OUT_DIR = path.join(__dirname, '../data/vision-models');
const OUT_FILE = path.join(OUT_DIR, 'yolov8n.onnx');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function download(url, callback) {
  const lib = url.startsWith('https') ? https : http;
  lib.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      download(res.headers.location, callback);
      return;
    }
    if (res.statusCode !== 200) {
      callback(new Error(`HTTP ${res.statusCode}`));
      return;
    }
    const file = fs.createWriteStream(OUT_FILE);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      callback(null);
    });
    file.on('error', callback);
  }).on('error', callback);
}

console.log('正在下载 yolov8n.onnx（约 12MB）...');
download(URL, (err) => {
  if (err) {
    console.error('下载失败:', err.message);
    process.exit(1);
  }
  console.log('下载完成:', OUT_FILE);
});
