/**
 * GUI 视觉工具：在截图上标注坐标点，供 AI 审核
 */

/**
 * 在 base64 截图上绘制红色十字标记
 * @param {string} imageDataUrl - data:image/png;base64,xxx
 * @param {number} x - 标记 x 坐标
 * @param {number} y - 标记 y 坐标
 * @returns {Promise<string>} 标注后的 base64 data URL
 */
export function drawMarkerOnImage(imageDataUrl, x, y) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const size = Math.max(20, Math.min(img.width, img.height) * 0.02);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = imageDataUrl;
  });
}

/**
 * 在 base64 截图上绘制网格。若传入 nutSize，则按 nut.js 坐标系拆分并换算到图片上绘制（坐标标 nut 值）
 * @param {string} imageDataUrl - data:image/png;base64,xxx
 * @param {object} opts - { nutSize: { width, height }, showRatio, showCoords }
 * @returns {Promise<string>} 标注后的 base64 data URL
 */
export function drawNineGridOnImage(imageDataUrl, opts = {}) {
  const { nutSize, showRatio = true, showCoords = true } = opts;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const w = img.width;
      const h = img.height;

      const nutW = nutSize?.width ?? w;
      const nutH = nutSize?.height ?? h;
      /** 目标格子尺寸（nut 像素），越小格子越多 */
      const cellSize = 120;
      let cols = Math.max(2, Math.ceil(nutW / cellSize));
      let rows = Math.max(2, Math.ceil(nutH / cellSize));
      const maxDiv = 32;
      if (cols > maxDiv || rows > maxDiv) {
        const scale = Math.max(cols, rows) / maxDiv;
        cols = Math.max(2, Math.round(cols / scale));
        rows = Math.max(2, Math.round(rows / scale));
      }

      const scaleX = w / nutW;
      const scaleY = h / nutH;

      const lineW = Math.max(0.5, Math.min(w, h) * 0.0008);
      const ratioFontSize = Math.max(10, Math.min(w, h) * 0.012);
      const coordFontSize = Math.max(14, Math.min(w, h) * 0.022);

      ctx.strokeStyle = 'rgba(255, 100, 0, 0.85)';
      ctx.lineWidth = lineW;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 1; i < cols; i++) {
        const nutX = (nutW * i) / cols;
        const x = nutX * scaleX;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        if (showCoords) {
          ctx.font = `bold ${coordFontSize}px sans-serif`;
          ctx.fillStyle = 'rgba(0,0,0,0.85)';
          const tx = String(Math.round(nutX));
          const tw = Math.max(ctx.measureText(tx).width + 14, 44);
          ctx.fillRect(x - tw / 2, 4, tw, coordFontSize + 8);
          ctx.fillStyle = '#fff';
          ctx.fillText(tx, x, 8 + coordFontSize / 2);
        }
        if (showRatio) {
          ctx.font = `${ratioFontSize}px sans-serif`;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(x - 22, h - ratioFontSize - 8, 44, ratioFontSize + 6);
          ctx.fillStyle = '#fff';
          ctx.fillText(`${i}/${cols}`, x, h - ratioFontSize / 2 - 5);
        }
      }
      for (let j = 1; j < rows; j++) {
        const nutY = (nutH * j) / rows;
        const y = nutY * scaleY;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        if (showCoords) {
          ctx.font = `bold ${coordFontSize}px sans-serif`;
          ctx.fillStyle = 'rgba(0,0,0,0.85)';
          const ty = String(Math.round(nutY));
          const tw = Math.max(ctx.measureText(ty).width + 14, 44);
          ctx.fillRect(4, y - (coordFontSize + 8) / 2, tw, coordFontSize + 8);
          ctx.fillStyle = '#fff';
          ctx.fillText(ty, 4 + tw / 2, y);
        }
        if (showRatio) {
          ctx.font = `${ratioFontSize}px sans-serif`;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(w - 42, y - ratioFontSize / 2 - 3, 40, ratioFontSize + 6);
          ctx.fillStyle = '#fff';
          ctx.fillText(`${j}/${rows}`, w - 22, y);
        }
      }

      if (showCoords) {
        ctx.font = `bold ${coordFontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(4, 4, 40, coordFontSize + 8);
        ctx.fillStyle = '#fff';
        ctx.fillText('0', 24, 8 + coordFontSize / 2);
      }

      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = imageDataUrl;
  });
}
