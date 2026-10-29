@echo off
cd /d D:\App\vpn-nextjs
echo Menjalankan Ganti IP di http://localhost:3001 ...
start "Ganti IP" /min cmd /c "npm start"
timeout /t 5 /nobreak >nul
echo.
echo Buka http://localhost:3001 di browser.
