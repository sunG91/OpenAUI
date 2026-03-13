/**
 * 控制台工具 - 查看：说明与参数
 */
export function ConsoleToolsView() {
  return (
    <div className="text-sm space-y-3 text-[var(--skill-btn-text)]">
      <h3 className="text-base font-semibold text-[var(--skill-btn-text)]">控制台工具说明</h3>
      <p className="text-[var(--input-placeholder)]">
        在服务端执行系统 shell 命令（Windows 下为 CMD/PowerShell，其它系统为默认 shell）。
        AI 或用户可通过此工具执行命令行操作，例如查看目录、运行脚本、系统信息等。
      </p>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">请求参数</div>
        <ul className="space-y-1 text-xs font-mono">
          <li><strong>command</strong> (必填)：要执行的命令字符串</li>
          <li><strong>cwd</strong> (可选)：工作目录绝对路径</li>
          <li><strong>timeout</strong> (可选)：超时毫秒数，默认 30000，最大 120000</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">返回</div>
        <ul className="space-y-1 text-xs">
          <li><strong>success</strong>：是否执行成功</li>
          <li><strong>stdout</strong> / <strong>stderr</strong>：标准输出与错误输出</li>
          <li><strong>code</strong>：进程退出码</li>
        </ul>
      </div>
      <p className="text-xs text-[var(--input-placeholder)]">
        此为系统级必备工具，已单独模块化，可在「测试」页直接执行命令或通过模型生成命令后执行。
      </p>
    </div>
  );
}
