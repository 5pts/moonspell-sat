@echo off
echo ===================================================
echo   FINAL ATTEMPT: Vercel Deploy
echo ===================================================
echo.
echo 1. Fixing computer name issue...
set "COMPUTERNAME=MyPC"
set "USERDOMAIN=MyDomain"

echo.
echo 2. Trying to deploy...
echo.
echo    [INSTRUCTION]
echo    - If a browser opens, please LOGIN to Vercel.
echo    - If asked for "Project Name", just press ENTER.
echo    - If asked for "Location", just press ENTER.
echo.

call vercel --prod

echo.
echo ===================================================
echo   If successful, your URL is above!
echo ===================================================
echo.
pause
