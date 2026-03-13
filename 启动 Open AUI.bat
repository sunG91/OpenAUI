@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在启动 Open AUI...
cd frontend
call npm run electron:dev

pause
