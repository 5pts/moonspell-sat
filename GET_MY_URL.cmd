@echo off
echo ===================================================
echo   ONE-CLICK DEPLOY (Powered by Surge.sh)
echo ===================================================
echo.
echo 1. Building Frontend...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Publishing to Permanent URL...
echo.
echo    [IMPORTANT]
echo    1. Enter an EMAIL and PASSWORD (any valid format works) to create/login.
echo    2. When asked for "project path", just press ENTER.
echo    3. When asked for "domain", you can type a custom one or accept the random one.
echo.

call surge dist/

echo.
echo ===================================================
echo   DONE! Copy the URL above.
echo ===================================================
echo.
pause
