// 用于“朗读文本”的清洗：不把表情符号读出来
export function stripEmojisForSpeech(input) {
  const text = String(input ?? '');
  if (!text) return '';

  // 说明：
  // - 优先使用 Unicode property escapes（现代 Chromium / Electron 支持）
  // - 兜底移除常见 emoji block + 变体选择符 + ZWJ
  try {
    return text
      .replace(/[\p{Extended_Pictographic}]/gu, '')
      .replace(/[\uFE0E\uFE0F]/g, '') // variation selectors
      .replace(/\u200D/g, '') // ZWJ
      .replace(/\s{2,}/g, ' ')
      .trim();
  } catch {
    // fallback：覆盖常见 emoji 区段（不追求 100% 完美，但能解决“把表情读出来”）
    return text
      .replace(/[\uFE0E\uFE0F]/g, '')
      .replace(/\u200D/g, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
      .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
      .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

