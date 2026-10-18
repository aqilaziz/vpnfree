# VPN Next.js (Localhost Ready)

Aplikasi dashboard VPN dengan Next.js 14 App Router.

## Jawaban: apakah bisa pakai localhost?
**Bisa untuk dashboard + backend kontrol**, tapi **browser/Next.js saja TIDAK bisa membuat tunnel VPN asli**.
Tunnel VPN asli harus di level OS/server (WireGuard, OpenVPN, Xray, Outline).

Yang sudah dibuat di `D:\App\vpn-nextjs`:
- Dashboard Connect/Disconnect, pilih server (termasuk 2 server localhost)
- API: `/api/servers`, `/api/connect`, `/api/disconnect`, `/api/status`
- Siap disambungkan ke WireGuard asli di localhost

## Jalankan
```
cd D:\App\vpn-nextjs
npm install
npm run dev
```
Buka http://localhost:3001

## Sambungkan ke VPN asli di localhost
1. Install WireGuard di Windows + jalankan server / peer di localhost/VPS
2. Edit `app/api/connect/route.ts`, ganti simulasi dengan `child_process` memanggil `wg-quick up ./configs/sg1.conf`
3. Untuk production: pakai Outline / Xray di Docker, Next.js hanya sebagai panel.

Struktur:
- `app/page.tsx` = UI
- `lib/servers.ts` = daftar server
- `app/api/*` = backend
