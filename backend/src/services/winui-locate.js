/**
 * Windows UI Automation 系统级定位
 * 通过 PowerShell 调用 UIA，坐标由系统提供，永不偏差
 * 仅支持 Windows
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

const SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$scope = [System.Windows.Automation.TreeScope]::Subtree
$nameProp = [System.Windows.Automation.AutomationElement]::NameProperty
$autoIdProp = [System.Windows.Automation.AutomationElement]::AutomationIdProperty
$nameFile = $args[0]
$autoId = $args[1]
$name = if ($nameFile -and (Test-Path $nameFile)) { Get-Content $nameFile -Encoding UTF8 -Raw } else { $nameFile }
$outFile = $args[2]
$cond = $null
if ($autoId -and $autoId -ne '') {
  $cond = New-Object System.Windows.Automation.PropertyCondition($autoIdProp, $autoId)
} else {
  $cond = New-Object System.Windows.Automation.PropertyCondition($nameProp, $name)
}
$el = $root.FindFirst($scope, $cond)
if (-not $el) { @{ok=$false;error="Element not found"} | ConvertTo-Json -Compress | Out-File -FilePath $outFile -Encoding UTF8; exit 0 }
$rect = $el.Current.BoundingRectangle
$x = [int]($rect.Left + $rect.Width / 2)
$y = [int]($rect.Top + $rect.Height / 2)
$o = @{
  ok=$true
  x=$x
  y=$y
  name=$el.Current.Name
  automationId=$el.Current.AutomationId
  rect=@{left=[int]$rect.Left;top=[int]$rect.Top;width=[int]$rect.Width;height=[int]$rect.Height}
}
$o | ConvertTo-Json -Compress | Out-File -FilePath $outFile -Encoding UTF8
`;

function isWindows() {
  return process.platform === 'win32';
}

/**
 * 通过名称或 AutomationId 定位 UI 元素，返回中心坐标
 * @param {{ name?: string, automationId?: string }} options
 * @returns {Promise<{ ok: boolean, x?: number, y?: number, name?: string, automationId?: string, rect?: object, error?: string }>}
 */
async function locate(options = {}) {
  if (!isWindows()) {
    return { ok: false, error: '系统定位仅支持 Windows' };
  }
  const name = (options.name || '').trim();
  const automationId = (options.automationId || '').trim();
  if (!name && !automationId) {
    return { ok: false, error: '请提供 name 或 automationId' };
  }
  const scriptPath = path.join(os.tmpdir(), `winui-locate-${process.pid}.ps1`);
  const nameFilePath = path.join(os.tmpdir(), `winui-locate-name-${process.pid}.txt`);
  const outFilePath = path.join(os.tmpdir(), `winui-locate-out-${process.pid}.json`);
  fs.writeFileSync(scriptPath, SCRIPT.trim(), 'utf8');
  if (name) fs.writeFileSync(nameFilePath, name, 'utf8');
  const nameArg = name ? `"${nameFilePath.replace(/\\/g, '\\\\')}"` : '""';
  const autoIdArg = (automationId || '').replace(/"/g, '`"');
  const outArg = `"${outFilePath.replace(/\\/g, '\\\\')}"`;
  try {
    await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -STA -File "${scriptPath}" ${nameArg} "${autoIdArg}" ${outArg}`,
      { timeout: 15000, maxBuffer: 1024 * 1024 }
    );
    const out = fs.existsSync(outFilePath) ? fs.readFileSync(outFilePath, 'utf8').trim() : '';
    if (!out) return { ok: false, error: '无输出' };
    const parsed = JSON.parse(out);
    if (!parsed.ok && parsed.error === 'Element not found') parsed.error = '未找到元素';
    return parsed;
  } catch (e) {
    return { ok: false, error: e?.message || '定位失败' };
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (_) {}
    if (name) try { fs.unlinkSync(nameFilePath); } catch (_) {}
    try { fs.unlinkSync(outFilePath); } catch (_) {}
  }
}

module.exports = { locate, isWindows };
