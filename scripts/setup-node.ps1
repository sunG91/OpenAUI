# 无 Node 环境下自动下载并安装 Node.js 便携版
# 用法：powershell -ExecutionPolicy Bypass -File scripts/setup-node.ps1
# 输出：项目根/.node-portable/node/node.exe

$ErrorActionPreference = "Stop"
$NODE_VERSION = "22.12.0"
$BASE_URL = "https://nodejs.org/dist/v$NODE_VERSION"
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
$zipName = "node-v$NODE_VERSION-win-$arch.zip"
$archiveUrl = "$BASE_URL/$zipName"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$outDir = Join-Path $projectRoot ".node-portable"
$extractDir = Join-Path $outDir "extract"
$zipPath = Join-Path $outDir $zipName
$nodeDir = Join-Path $outDir "node"
$nodeExe = Join-Path $nodeDir "node.exe"

if (Test-Path $nodeExe) {
    Write-Host "[setup-node] 已存在: $nodeExe"
    $nodeExe
    exit 0
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Write-Host "[setup-node] 下载 Node.js v$NODE_VERSION ..."
Write-Host "[setup-node] URL: $archiveUrl"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $archiveUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 120
} catch {
    Write-Error "[setup-node] 下载失败: $_"
    exit 1
}

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "[setup-node] 已下载 $sizeMB MB"

New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

$extractedFolder = Get-ChildItem -Path $extractDir -Directory | Where-Object { $_.Name -like "node-*" } | Select-Object -First 1
if (-not $extractedFolder) {
    Write-Error "[setup-node] 解压后未找到 node 目录"
    exit 1
}

$targetDir = Join-Path $outDir $extractedFolder.Name
if (Test-Path $targetDir) { Remove-Item -Path $targetDir -Recurse -Force }
Move-Item -Path $extractedFolder.FullName -Destination $targetDir -Force

Remove-Item -Path $extractDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue

$nodeExe = Join-Path $targetDir "node.exe"
Write-Host "[setup-node] 已安装到: $targetDir"
$targetDir
