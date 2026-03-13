/**
 * 加载 config.yaml，供入口与各模块使用
 */
const fs = require('fs');
const path = require('path');

const defaultConfig = {
  server: { port: 9527, host: '0.0.0.0' },
  auth: { requireKey: false, allowedKeys: [] }
};

function loadConfig(configPathOverride = null) {
  const configPath = configPathOverride || path.join(__dirname, '../..', 'config.yaml');
  try {
    if (fs.existsSync(configPath)) {
      const yaml = require('yaml');
      const content = fs.readFileSync(configPath, 'utf8');
      return yaml.parse(content);
    }
  } catch (e) {
    console.warn('加载 config 失败，使用默认配置:', e.message);
  }
  return defaultConfig;
}

module.exports = { loadConfig, defaultConfig };
