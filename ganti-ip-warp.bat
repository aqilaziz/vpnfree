@echo off
title Ganti IP WARP (tanpa matikan tunnel lokal)
echo ===============================================
echo  Ganti IP WARP - tunnel WireGuard TETAP JALAN
echo ===============================================
set WARP_CLI="C:\Program Files\Cloudflare\Cloudflare WARP\warp-cli.exe"
echo IP sebelum:
curl -s https://api.ipify.org
echo.
echo.
echo Disconnect WARP...
%WARP_CLI% disconnect
timeout /t 3 /nobreak >nul
echo Rotasi kunci sesi (minta sesi egress baru)...
%WARP_CLI% tunnel rotate-keys
timeout /t 2 /nobreak >nul
echo Connect lagi...
%WARP_CLI% connect
timeout /t 10 /nobreak >nul
echo IP sesudah:
curl -s https://api.ipify.org
echo.
echo.
echo Selesai. Tunnel WireGuard lokal TIDAK disentuh.
echo Cek juga di dashboard: http://localhost:3001 -^> Cek IP Sekarang
echo Kalau IP masih sama, jalankan file ini lagi.
echo (Jalankan file ini sebagai Administrator bila ada error akses ditolak.)
pause
