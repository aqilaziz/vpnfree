@echo off
REM Setup awal setelah clone: buat folder configs + contoh (tanpa private key asli)
if not exist configs mkdir configs
if not exist "configs\CONTOH.local-1.conf.txt" (
  echo CONTOH config tidak ditemukan. Lihat README untuk format.
  exit /b 1
)
echo OK. Salin contoh lalu isi dengan key asli milikmu:
echo   copy "configs\CONTOH.local-1.conf.txt" "configs\local-1.conf"
echo Lalu edit configs\local-1.conf dengan PrivateKey/PublicKey asli.
echo JANGAN commit file *.conf asli ke GitHub!
