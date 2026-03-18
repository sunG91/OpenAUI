/**
 * API 统一入口：从各模块聚合导出，便于按域扩展
 * 使用方可直接 import from '@/api/client' 或按需 import from '@/api/settings' / '@/api/modelTest' / '@/api/base'
 */
export { getBackendPort, API_BASE, wrapNetworkError } from './base';
export { getApiKeys, saveApiKey, getBaiduOcrKeys, saveBaiduOcrKeys, testBaiduOcr, getVoiceSettings, saveVoiceSettings, getSkillSettings, saveSkillSettings } from './settings';
export { testModel, testModelStream } from './modelTest';
export { sttFromAudioBlob, ttsFromText, getTtsVoices } from './voice';
