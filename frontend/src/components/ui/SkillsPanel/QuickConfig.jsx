/**
 * 快速 - 不选模型与思考模式，直接调用模型
 */
export function QuickConfig() {
  return (
    <div className="text-sm text-[var(--input-placeholder)] space-y-2">
      <p>
        <strong className="text-[var(--skill-btn-text)]">快速</strong>：去掉选择模型、思考模式等步骤，直接调用默认模型发送内容。
      </p>
      <p>在对话页输入栏下方点击「快速」后，再输入并发送，该条消息会以快速方式调用模型（不经过模型/思考模式选择）。</p>
    </div>
  );
}
