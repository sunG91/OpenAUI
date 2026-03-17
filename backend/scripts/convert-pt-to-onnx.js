/**
 * 将 vision-models/pt-sources/ 下的 .pt 模型转换为 .onnx
 * 需要：pip install ultralytics
 * 运行：node scripts/convert-pt-to-onnx.js
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PT_DIR = path.join(__dirname, '../data/vision-models/pt-sources');
const OUT_DIR = path.join(__dirname, '../data/vision-models');

function getPyScript() {
  const ptDir = PT_DIR.replace(/\\/g, '/');
  const outDir = OUT_DIR.replace(/\\/g, '/');
  return `
import sys, os
try:
    from ultralytics import YOLO
except ImportError:
    print("请先安装: pip install ultralytics")
    sys.exit(1)

pt_dir = r"${ptDir}"
out_dir = r"${outDir}"
for f in os.listdir(pt_dir):
    if not f.endswith(".pt"):
        continue
    pt_path = os.path.join(pt_dir, f)
    onnx_name = f.replace(".pt", ".onnx")
    onnx_path = os.path.join(out_dir, onnx_name)
    if os.path.exists(onnx_path):
        print("[跳过]", onnx_name, "已存在")
        continue
    print("[转换]", f, "->", onnx_name)
    model = YOLO(pt_path)
    model.export(format="onnx", imgsz=640)
    exported = pt_path.replace(".pt", ".onnx")
    if os.path.exists(exported):
        os.rename(exported, onnx_path)
        print("  完成:", onnx_path)
print("转换完成")
`;
}

function runPython(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', ['-c', script], { stdio: 'inherit' });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    proc.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(PT_DIR)) {
    console.log('pt-sources 目录不存在，请先运行 npm run vision:download-all 下载 .pt 模型');
    process.exit(1);
  }
  const pts = fs.readdirSync(PT_DIR).filter((f) => f.endsWith('.pt'));
  if (pts.length === 0) {
    console.log('pt-sources 下无 .pt 文件');
    process.exit(0);
  }
  console.log('将转换', pts.length, '个模型，需要 Python + ultralytics\n');
  try {
    await runPython(getPyScript());
  } catch (e) {
    console.error('\n转换失败。请确保已安装: pip install ultralytics');
    process.exit(1);
  }
}

main();
