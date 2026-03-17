/**
 * GUI 视觉识别提示词预设（技能模块）
 * 用于带网格截图的视觉对话，可在此绑定/选择不同预设
 */
export const GUI_VISION_PROMPTS = [
  {
    id: 'grid-strict',
    label: '严格按刻度',
    desc: '坐标必须严格按图上刻度读取，不得估算',
    prompt: `请描述图中带网格的屏幕内容，并指出可点击的元素及其坐标。

【重要】坐标必须严格按图上标注的刻度读取：
- 顶部有 x 刻度（0, 240, 480, 720, 960…），左侧有 y 刻度（0, 240, 480, 720, 960…）
- 元素坐标必须落在相邻刻度之间，不得估算或推测。例如：若图标在 720 与 960 之间，则 y 坐标只能是 720~960 区间内的值，不能写 970 等超出范围的值
- 输出格式：元素名 (x, y)，其中 x、y 均为图上刻度范围内的整数`,
  },
  {
    id: 'grid-general',
    label: '通用描述',
    desc: '描述屏幕内容及可点击元素',
    prompt: '请描述图中带网格的屏幕内容，并指出可点击的元素及其大致坐标（nut 坐标系）。',
  },
  {
    id: 'custom',
    label: '自定义',
    desc: '手动输入提示词',
    prompt: '',
  },
];

/** 获取默认预设 id */
export const DEFAULT_PROMPT_ID = 'grid-strict';

/** 根据 id 获取完整 prompt，若为 custom 则返回空（由用户输入） */
export function getPromptById(id) {
  const item = GUI_VISION_PROMPTS.find((p) => p.id === id);
  return item?.prompt ?? '';
}
