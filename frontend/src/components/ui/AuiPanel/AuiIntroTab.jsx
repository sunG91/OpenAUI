/**
 * AUI 介绍 Tab - 产品核心说明
 */
export function AuiIntroTab() {
  return (
    <div className="space-y-6 text-[var(--skill-btn-text)]">
      <section>
        <h3 className="text-base font-semibold mb-2">什么是 AUI？</h3>
        <p className="text-sm leading-relaxed text-[var(--input-placeholder)]">
          AUI（AI User Interface）是 Open AUI 的核心模式，让 AI 真正「动手」操作电脑。
          不同于纯对话的 Chat 模式，AUI 模式下 AI 可以执行控制台命令、操作 GUI、自动化浏览器等，
          将自然语言指令转化为可执行的电脑操作。
        </p>
      </section>
      <section>
        <h3 className="text-base font-semibold mb-2">核心能力</h3>
        <ul className="text-sm space-y-2 text-[var(--input-placeholder)] list-disc list-inside">
          <li>语音交互（含唤醒）</li>
          <li>控制台命令执行</li>
          <li>浏览器网页自动化</li>
          <li>任务拆分与多模型调度</li>
          <li>行为记忆与会话整理</li>
        </ul>
      </section>
      <section>
        <h3 className="text-base font-semibold mb-2">架构选择</h3>
        <p className="text-sm leading-relaxed text-[var(--input-placeholder)]">
          切换到「架构选择」标签页，可查看并选择不同的 AUI 架构。每种架构定义了决策中枢与执行部门的组织方式，
          影响 AI 如何理解任务、审核与分发执行。
        </p>
      </section>
    </div>
  );
}
