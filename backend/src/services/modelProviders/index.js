/**
 * 模型厂商提供方注册表
 * 新增厂商：在此目录下新增同构文件并在此 register，无需改路由
 */
const deepseek = require('./deepseek');
const siliconflow = require('./siliconflow');

const registry = new Map();
function register(provider) {
  if (provider && provider.id) {
    registry.set(provider.id, provider);
  }
}
function getProvider(vendorId) {
  return registry.get(vendorId) || null;
}

// 注册内置厂商
register(deepseek);
register(siliconflow);

module.exports = { register, getProvider };

