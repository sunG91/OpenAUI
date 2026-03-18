/**
 * A2UI 画布 API — Agent 推送可视化
 * POST /api/canvas/push — 推送 A2UI 消息
 * GET /api/canvas/state — 获取当前画布状态
 */
let canvasState = { surfaces: {}, messages: [] };

function pushMessage(msg) {
  if (msg?.surfaceUpdate) {
    const { surfaceId, components } = msg.surfaceUpdate;
    if (surfaceId) {
      canvasState.surfaces[surfaceId] = canvasState.surfaces[surfaceId] || {};
      canvasState.surfaces[surfaceId].components = components || [];
    }
  }
  if (msg?.beginRendering) {
    const { surfaceId, root } = msg.beginRendering;
    if (surfaceId) {
      canvasState.surfaces[surfaceId] = canvasState.surfaces[surfaceId] || {};
      canvasState.surfaces[surfaceId].root = root;
    }
  }
  if (msg?.deleteSurface) {
    const sid = typeof msg.deleteSurface === 'string' ? msg.deleteSurface : msg.deleteSurface?.surfaceId;
    if (sid) delete canvasState.surfaces[sid];
  }
  canvasState.messages.push(msg);
  if (canvasState.messages.length > 50) canvasState.messages = canvasState.messages.slice(-50);
}

function mountCanvasRoutes(app) {
  app.post('/api/canvas/push', (req, res) => {
    try {
      const body = req.body;
      if (Array.isArray(body)) {
        body.forEach((m) => pushMessage(m));
      } else if (body && typeof body === 'object') {
        pushMessage(body);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message });
    }
  });

  app.get('/api/canvas/state', (_req, res) => {
    res.json(canvasState);
  });

  app.post('/api/canvas/reset', (_req, res) => {
    canvasState = { surfaces: {}, messages: [] };
    res.json({ success: true });
  });
}

module.exports = { mountCanvasRoutes };
