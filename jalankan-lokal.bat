@echo off
cd /d D:\App\vpn-nextjs
echo Menjalankan VPN Next.js di http://localhost:3001 ...
start "vpn-nextjs" /min cmd /c "npm start"
timeout /t 8 /nobreak >nul
curl -s http://localhost:3001/api/servers
echo.
echo Buka http://localhost:3001 di browser.
