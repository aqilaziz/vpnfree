@echo off
cd /d D:\App\vpn-nextjs
echo === Rebuild + Restart VPN Next.js ===
echo Mematikan server lama di port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul
echo Build ulang...
call npm run build
echo Menyalakan server baru...
start "vpn-nextjs" /min cmd /c "npm start"
timeout /t 9 /nobreak >nul
echo === Tes API ===
curl -s http://localhost:3001/api/ip
echo.
echo Selesai. Buka http://localhost:3001 lalu Refresh.
