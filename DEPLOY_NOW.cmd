@echo off
echo ===================================================
echo   Moonspell Deployment Script (Powered by Surge)
echo ===================================================
echo.
echo This script will deploy your site to a public URL using Surge.sh.
echo If you haven't used Surge before, it will ask for an email and password to create an account.
echo.
echo 1. Building the project...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Deploying to Surge...
echo    (You may need to login or create an account)
echo.
echo    Please follow the prompts below.
echo    When asked for "domain", you can type a custom one like:
echo    my-moonspell-app.surge.sh
echo.

call npx surge dist/

echo.
echo ===================================================
echo   Deployment Complete!
echo ===================================================
echo.
echo   Main Site:      https://<your-domain>.surge.sh
echo   Admin Panel:    https://<your-domain>.surge.sh/admin.html
echo   Local Site:     https://<your-domain>.surge.sh/local-site.html
echo.
pause
