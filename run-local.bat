@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem EVOS local prototype launcher.
rem Starts both services with the same local API contract and opens the frontend.

cd /d "%~dp0"
set "FRONTEND_URL=http://localhost:8443"
set "BACKEND_URL=http://localhost:8787"
set "VITE_BACKEND_URL=%BACKEND_URL%"
set "VITE_SITE_LATITUDE=28.6139"
set "VITE_SITE_LONGITUDE=77.209"
set "PORT=8787"
set "CORS_ORIGINS=http://localhost:8443,http://127.0.0.1:8443"

echo.
echo EVOS local deployment
echo --------------------
echo Frontend: %FRONTEND_URL%
echo Backend:  %BACKEND_URL%
echo.

call :is_up "%BACKEND_URL%/api/v1/health"
if errorlevel 1 (
  echo Starting backend...
  start "EVOS Backend" powershell.exe -NoProfile -NoExit -Command "Set-Location -LiteralPath '%~dp0'; node --env-file=backend/.env backend/server.mjs"
) else (
  echo Backend already running.
)

call :is_up "%FRONTEND_URL%/"
if errorlevel 1 (
  echo Starting frontend...
  start "EVOS Frontend" powershell.exe -NoProfile -NoExit -Command "Set-Location -LiteralPath '%~dp0'; pnpm run dev -- --host 0.0.0.0 --port 8443"
) else (
  echo Frontend already running.
)

echo.
echo Waiting for both services...
set "READY=0"
for /l %%N in (1,1,30) do (
  call :is_up "%BACKEND_URL%/api/v1/health"
  if not errorlevel 1 set /a READY+=1
  call :is_up "%FRONTEND_URL%/"
  if not errorlevel 1 set /a READY+=1
  if !READY! GEQ 2 goto :ready
  set "READY=0"
  timeout /t 1 /nobreak >nul
)

echo.
echo ERROR: EVOS did not become ready within 30 seconds.
echo Check the Backend and Frontend windows for details.
exit /b 1

:ready
echo.
echo EVOS is ready.
echo Open %FRONTEND_URL%/
start "" "%FRONTEND_URL%/"
exit /b 0

:is_up
node -e "fetch('%~1').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>&1
exit /b %errorlevel%
