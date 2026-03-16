/**
 * 本地离线视觉检测（YOLO/ONNX）
 * 模型文件下载到本地，完全离线运行，不依赖第三方 API
 */
const path = require('path');
const fsp = require('fs/promises');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const MODELS_DIR = path.join(REPO_ROOT, 'backend', 'data', 'vision-models');
const DEFAULT_INPUT_SIZE = 640;

let ort = null;
let sharp = null;
try {
  ort = require('onnxruntime-node');
} catch (_) {}
try {
  sharp = require('sharp');
} catch (_) {}

async function ensureModelsDir() {
  await fsp.mkdir(MODELS_DIR, { recursive: true });
  return MODELS_DIR;
}

async function listModels() {
  await ensureModelsDir();
  const entries = await fsp.readdir(MODELS_DIR, { withFileTypes: true });
  const models = [];
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.onnx')) {
      models.push({
        id: e.name,
        name: e.name.replace(/\.onnx$/, ''),
        path: path.join(MODELS_DIR, e.name),
      });
    }
  }
  return models;
}

/**
 * 预处理：将图片转为 YOLO 输入张量 [1, 3, H, W]，归一化 0-1
 */
async function preprocess(imageBuffer, inputSize = DEFAULT_INPUT_SIZE) {
  if (!sharp) throw new Error('请安装 sharp: npm install sharp');
  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .resize(inputSize, inputSize, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const numPixels = width * height * channels;
  const float32 = new Float32Array(3 * inputSize * inputSize);
  for (let i = 0; i < numPixels; i += channels) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const idx = Math.floor(i / channels);
    float32[idx] = r;
    float32[inputSize * inputSize + idx] = g;
    float32[2 * inputSize * inputSize + idx] = b;
  }
  return new ort.Tensor('float32', float32, [1, 3, inputSize, inputSize]);
}

/**
 * 后处理：解析 YOLOv8 输出，NMS，返回检测框
 * 支持 [1,84,8400] 或 [1,8400,84] 两种布局
 */
function postprocess(outputTensor, origW, origH, inputSize, confThreshold = 0.25, iouThreshold = 0.45) {
  const dims = outputTensor.dims;
  const data = outputTensor.data;
  const numChannels = Math.min(dims[1], dims[2]);
  const numPredictions = Math.max(dims[1], dims[2]);
  const numClasses = numChannels - 4;
  const detections = [];
  for (let i = 0; i < numPredictions; i++) {
    const base = i * numChannels;
    const cx = data[base];
    const cy = data[base + 1];
    const w = data[base + 2];
    const h = data[base + 3];
    let maxScore = 0;
    let maxClass = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[base + 4 + c];
      if (score > maxScore) {
        maxScore = score;
        maxClass = c;
      }
    }
    if (maxScore < confThreshold) continue;
    const x1 = ((cx - w / 2) / inputSize) * origW;
    const y1 = ((cy - h / 2) / inputSize) * origH;
    const x2 = ((cx + w / 2) / inputSize) * origW;
    const y2 = ((cy + h / 2) / inputSize) * origH;
    detections.push({
      class: maxClass,
      confidence: maxScore,
      bbox: [Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1)],
    });
  }
  return nms(detections, iouThreshold);
}

function iou(box1, box2) {
  const [x1, y1, w1, h1] = box1.bbox;
  const [x2, y2, w2, h2] = box2.bbox;
  const xi1 = Math.max(x1, x2);
  const yi1 = Math.max(y1, y2);
  const xi2 = Math.min(x1 + w1, x2 + w2);
  const yi2 = Math.min(y1 + h1, y2 + h2);
  const inter = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
  const area1 = w1 * h1;
  const area2 = w2 * h2;
  return inter / (area1 + area2 - inter);
}

function nms(detections, iouThreshold) {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const result = [];
  while (sorted.length > 0) {
    const top = sorted.shift();
    result.push(top);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (iou(top, sorted[i]) >= iouThreshold) sorted.splice(i, 1);
    }
  }
  return result;
}

/**
 * 从 base64 data URL 解码图片
 */
function decodeImageFromDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error('无效的图片格式');
  return Buffer.from(match[1], 'base64');
}

let sessionCache = null;
let cachedModelPath = null;

async function runDetection(imageBuffer, modelPath, classNames = [], options = {}) {
  if (!ort) throw new Error('请安装 onnxruntime-node: npm install onnxruntime-node');
  const inputSize = options.inputSize || DEFAULT_INPUT_SIZE;
  const confThreshold = options.confThreshold ?? 0.25;
  const iouThreshold = options.iouThreshold ?? 0.45;

  const absPath = path.isAbsolute(modelPath) ? modelPath : path.join(MODELS_DIR, modelPath);
  const exists = await fsp.access(absPath).then(() => true).catch(() => false);
  if (!exists) throw new Error(`模型文件不存在: ${absPath}`);

  if (!sessionCache || cachedModelPath !== absPath) {
    sessionCache = await ort.InferenceSession.create(absPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    cachedModelPath = absPath;
  }

  const origMeta = await sharp(imageBuffer).metadata();
  const origW = origMeta.width || 640;
  const origH = origMeta.height || 480;

  const inputTensor = await preprocess(imageBuffer, inputSize);
  const feeds = {};
  const inputName = sessionCache.inputNames[0];
  feeds[inputName] = inputTensor;

  const results = await sessionCache.run(feeds);
  const outputName = sessionCache.outputNames[0];
  const outputTensor = results[outputName];

  const detections = postprocess(outputTensor, origW, origH, inputSize, confThreshold, iouThreshold);

  return detections.map((d) => ({
    ...d,
    className: classNames[d.class] || `class_${d.class}`,
  }));
}

module.exports = {
  MODELS_DIR,
  ensureModelsDir,
  listModels,
  runDetection,
  decodeImageFromDataUrl,
  hasDependencies: () => !!(ort && sharp),
};
