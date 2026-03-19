@echo off
chcp 65001 >nul
echo === Open AUI - espeak-ng 安装 ===
echo.
echo 请以管理员身份运行此脚本（右键 - 以管理员身份运行）
echo.
pause

powershell -ExecutionPolicy Bypass -File "%~dp0setup-espeak-ng.ps1"
pause
