@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo [ERROR] .env file not found in:
  echo %cd%
  echo.
  echo Put your .env file in this folder, then run again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo Starting backend API on http://localhost:3000 ...
call npm.cmd run start:api
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Backend exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%

