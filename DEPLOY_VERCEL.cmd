@echo off
echo ===================================================
echo   DEPLOY TO VERCEL
echo ===================================================
echo.
echo 1. Installing dependencies (just in case)...
call npm install
if %errorlevel% neq 0 (
    echo Install failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Building Project...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 3. Deploying to Vercel...
echo.
echo    [IMPORTANT]
echo    1. It will open your browser to login (if not logged in).
echo    2. Press ENTER for all default settings (Project Name, Directory, etc.).
echo.

call npx vercel --prod

echo.
echo ===================================================
echo   DONE! Check the URL above.
echo ===================================================
echo.
pause
