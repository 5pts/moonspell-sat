@echo off
setlocal
echo ===================================================
echo   Gitee Pages Deploy Packager (No VPN)
echo ===================================================
echo.
echo [1/3] Build project...
call npm run build
if %errorlevel% neq 0 (
  echo Build failed.
  pause
  exit /b %errorlevel%
)
echo.
echo [2/3] Prepare docs/ for Gitee Pages...
if exist docs rmdir /s /q docs
mkdir docs
xcopy /e /i /y dist\* docs\ >nul
if %errorlevel% neq 0 (
  echo Copy dist to docs failed.
  pause
  exit /b %errorlevel%
)
echo.
echo [3/3] Done.
echo.
echo Next steps on Gitee:
echo 1. Create a repo on gitee (recommended repo name: moonspell-sat)
echo 2. Upload or push all files in this folder (including docs/)
echo 3. Open: Service - Pages - Enable
echo.
echo Permanent URL format:
echo - Project Pages: https://<gitee-user>.gitee.io/<repo-name>/
echo - User Pages  : https://<gitee-user>.gitee.io  (repo must be <gitee-user>.gitee.io)
echo.
pause
