/**
 * Tesseract.js 本地 OCR 模块
 * 纯前端运行，无需 API Key，支持中英文
 */
import { createWorker } from 'tesseract.js';

/** 支持的语言：eng 英文，chi_sim 简体中文 */
const DEFAULT_LANG = 'chi_sim+eng';

/**
 * 识别图片中的文字
 * @param {string|File|Blob} image - 图片 URL、File 或 Blob
 * @param {{ lang?: string }} options - lang 语言，默认 chi_sim+eng
 * @returns {Promise<{ text: string, words: Array<{words: string}> }>}
 */
export async function recognize(image, options = {}) {
  const lang = options.lang || DEFAULT_LANG;
  const worker = await createWorker(lang);
  try {
    const ret = await worker.recognize(image, {}, { blocks: true });
    const text = ret.data?.text || '';
    // blocks 含 paragraphs.lines.words，兼容展示
    const words = [];
    try {
      const blocks = ret.data?.blocks || [];
      for (const b of blocks) {
        for (const p of b.paragraphs || []) {
          for (const line of p.lines || []) {
            for (const w of line.words || []) {
              if (w.text) words.push({ words: w.text });
            }
          }
        }
      }
    } catch {
      // 无 blocks 时按行拆分 text 作为词块
      if (text) text.split(/\n/).filter(Boolean).forEach((t) => words.push({ words: t }));
    }
    return { text, words };
  } finally {
    await worker.terminate();
  }
}
