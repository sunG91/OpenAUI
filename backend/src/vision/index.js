/**
 * 本地离线视觉检测模块（YOLO/ONNX）
 * 模型文件下载到本地，完全离线运行，不依赖第三方 API
 */
const detector = require('./detector');

function ok(res, data) {
  return res.json({ success: true, ...data });
}

function fail(res, message, extra = {}) {
  return res.status(200).json({ success: false, error: message, ...extra });
}

function mountVisionRoutes(app) {
  const notInstalled = (req, res) =>
    fail(res, '视觉检测模块未安装，请执行: npm install onnxruntime-node sharp');

  if (!detector.hasDependencies()) {
    app.get('/api/tools/vision/models', notInstalled);
    app.post('/api/tools/vision/detect', notInstalled);
    return;
  }

  /** GET /api/tools/vision/models — 列出本地模型 */
  app.get('/api/tools/vision/models', async (req, res) => {
    try {
      const models = await detector.listModels();
      return ok(res, { models, modelsDir: detector.MODELS_DIR });
    } catch (e) {
      return fail(res, e?.message || '获取模型列表失败');
    }
  });

  /** POST /api/tools/vision/detect — 本地检测 */
  app.post('/api/tools/vision/detect', async (req, res) => {
    try {
      const { image, modelId, classNames, confThreshold, iouThreshold } = req.body || {};
      if (!image || typeof image !== 'string') return fail(res, '缺少 image（base64 data URL）');
      const modelPath = modelId || (await detector.listModels()).map((m) => m.id)[0];
      if (!modelPath) return fail(res, '请先将 .onnx 模型文件放入 backend/data/vision-models/ 目录');

      const imageBuffer = detector.decodeImageFromDataUrl(image);
      const names = Array.isArray(classNames) ? classNames : [];
      const detections = await detector.runDetection(imageBuffer, modelPath, names, {
        confThreshold: typeof confThreshold === 'number' ? confThreshold : 0.25,
        iouThreshold: typeof iouThreshold === 'number' ? iouThreshold : 0.45,
      });
      return ok(res, { detections });
    } catch (e) {
      return fail(res, e?.message || '检测失败');
    }
  });
}

module.exports = { mountVisionRoutes };
