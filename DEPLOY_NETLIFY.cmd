@echo off
echo ===================================================
echo   DEPLOY TO NETLIFY
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
echo 3. Deploying to Netlify...
echo.
echo    [IMPORTANT]
echo    1. It will open your browser to login (if not logged in).
echo    2. Select "Create & configure a new site" (or link existing).
echo    3. Select your team/account.
echo    4. Site name: (Optional, press ENTER).
echo    5. Publish directory: dist (Make sure to type "dist" if asked, or verify default).
echo.

call npx netlify-cli deploy --prod --dir=dist

echo.
echo ===================================================
echo   DONE! Check the URL above.
echo ===================================================
echo.
pause
