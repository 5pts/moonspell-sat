@echo off
echo ===================================================
echo   Moonspell Full Stack Launcher
echo ===================================================
echo.
echo 1. Installing Server Dependencies...
cd server
call npm install
cd ..

echo.
echo 2. Building Frontend...
call npm run build

echo.
echo 3. Starting Server...
echo    Access the app at: http://localhost:3000
echo    - Main Site: http://localhost:3000/
echo    - Admin:     http://localhost:3000/admin.html
echo.
echo    (Press Ctrl+C to stop)
echo.

node server/index.js
pause
