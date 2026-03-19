# Open AUI - espeak-ng setup for Piper TTS
# Fix: espeak-ng-data\phontab: No such file or directory
# Run as Administrator: .\scripts\setup-espeak-ng.ps1

$ErrorActionPreference = "Stop"
$espeakUrl = "https://github.com/espeak-ng/espeak-ng/releases/download/1.52.0/espeak-ng.msi"
$tempMsi = Join-Path $env:TEMP "espeak-ng.msi"

Write-Host "=== Open AUI - espeak-ng Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
$regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
$installed = Get-ItemProperty $regPath -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*espeak*" }
if ($installed) {
    Write-Host "espeak-ng already installed: $($installed.DisplayName)" -ForegroundColor Green
    Write-Host "Piper TTS should work. Restart the app if needed." -ForegroundColor Yellow
    exit 0
}

Write-Host "Downloading espeak-ng.msi ..." -ForegroundColor Yellow
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $espeakUrl -OutFile $tempMsi -UseBasicParsing
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    Write-Host "Manual download: $espeakUrl" -ForegroundColor Yellow
    exit 1
}

Write-Host "Installing espeak-ng (may require admin)..." -ForegroundColor Yellow
try {
    Start-Process msiexec.exe -ArgumentList "/i", "`"$tempMsi`"", "/passive", "/norestart" -Wait -Verb RunAs
} catch {
    Write-Host "Auto install failed. Opening installer: $tempMsi" -ForegroundColor Yellow
    Start-Process $tempMsi
    exit 0
}

if (Test-Path $tempMsi) { Remove-Item $tempMsi -Force }

Write-Host ""
Write-Host "espeak-ng installed successfully!" -ForegroundColor Green
Write-Host "Restart Open AUI backend for Piper TTS to work." -ForegroundColor Cyan
