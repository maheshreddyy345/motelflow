@echo off
echo ===========================================
echo   Starting Motel Flow App...
echo ===========================================

echo Starting Backend Server (Wait 5 sec)...
start "Motel Flow Backend" cmd /k "cd server && npm run dev"

timeout /t 5 >nul

echo Starting Frontend Server...
start "Motel Flow Frontend" cmd /k "cd client && npm run dev -- --host --port 5173"

echo Done! Servers should be running.
echo The app should open in your browser shortly...

timeout /t 5 >nul
start http://localhost:5173
