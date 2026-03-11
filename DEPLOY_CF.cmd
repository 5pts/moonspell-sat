@echo off
echo ===================================================
echo   DEPLOY TO CLOUDFLARE PAGES (No VPN Required)
echo ===================================================
echo.
echo 1. Fixing computer name issue (just in case)...
set "COMPUTERNAME=MyPC"
set "USERDOMAIN=MyDomain"

echo.
echo 2. Trying to deploy to Cloudflare...
echo.
echo    [INSTRUCTION]
echo    1. It will open your browser to login to Cloudflare (Sign up if needed).
echo    2. Allow "Wrangler" to access your account.
echo    3. Select "Create a new project".
echo    4. Project Name: moonspell-sat (or press ENTER).
echo    5. Production Branch: main (or press ENTER).
echo.

call npx wrangler pages deploy dist --project-name=moonspell-sat

echo.
echo ===================================================
echo   DONE! Your URL should end with .pages.dev
echo   This domain usually works fine in China.
echo ===================================================
echo.
pause
