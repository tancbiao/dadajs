@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 人生模拟器

set "NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" (
    set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"
  ) else if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE=C:\Program Files\nodejs\node.exe"
  )
)

start "" cmd /c "timeout /t 2 >nul & start http://localhost:8787"
"%NODE%" server.js
pause
