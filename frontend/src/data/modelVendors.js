/**
 * 模型厂商数据 - 统一维护，便于扩展
 * 设置、模型测试等页面均从此处读取，新增厂商只需在此追加
 */

/** 支持的调用厂商列表 */
export const MODEL_VENDORS = [
  { id: 'siliconflow', name: '硅基流动', desc: 'SiliconFlow 模型服务' },
  { id: 'deepseek', name: 'DeepSeek 官方', desc: 'DeepSeek 官方 API' },
];

/** 模型能力标签数据集（可选：聊天、图片分析、视频分析、推理等） */
export const MODEL_TAGS = ['聊天', '图片分析', '视频分析', '推理', '视觉识别', 'tools'];

/** 各厂商可调用的模型（按厂商 id 索引；tags 为能力标签数组；stream 为是否支持流式输出） */
export const VENDOR_MODELS = {
  siliconflow: [
    // 你要求默认加入的硅基流动模型
    {
      id: 'Pro/moonshotai/Kimi-K2.5',
      name: 'Kimi-K2.5',
      tags: ['对话', '推理'],
      stream: true,
    },
    {
      id: 'Qwen/Qwen3.5-397B-A17B',
      name: 'Qwen3.5-397B-A17B',
      tags: ['视觉识别'],
      stream: true,
    },
    {
      id: 'Pro/MiniMaxAI/MiniMax-M2.5',
      name: 'MiniMax-M2.5',
      tags: ['聊天', '推理', 'tools'],
      stream: true,
    },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'deepseek-chat', tags: ['聊天'], stream: true },
    { id: 'deepseek-reasoner', name: 'deepseek-reasoner（思考模式）', tags: ['聊天'], stream: true },
    { id: 'deepseek-coder', name: 'deepseek-coder', tags: ['聊天'], stream: true },
  ],
};

