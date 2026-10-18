# 🔒 VPN WireGuard Asli (Next.js + Electron) v1.2.0

Aplikasi VPN WireGuard **asli** (bukan simulasi) berbasis Next.js 14 + Electron.
Tunnel dibuat di level OS via WireGuard, dashboard sebagai panel kontrol +
bukti tunnel + IP publik live + ganti IP WARP tanpa matikan tunnel lokal.

## Jalankan (versi biasa)

```
cd D:\App\vpn-nextjs
npm install
npm run dev
```

Buka http://localhost:3001

## Versi desktop (Electron, Windows)

```
npm run dist
```

Hasil: `dist-electron-v12\VPN-WireGuard-Asli-Setup-1.2.0.exe`
Install di komputer Windows lain (tanpa Node.js). Jalankan **sebagai
Administrator** agar Connect + Ganti IP berfungsi. Tiap komputer wajib punya
`local-1.conf` sendiri (lihat `DISTRIBUSI.md`).

## Syarat VPN asli

1. Install WireGuard client: https://www.wireguard.com/install/
2. Taruh file `local-1.conf` asli di folder `configs/` (atau
   `%APPDATA%\VPN WireGuard Asli\configs` untuk versi EXE).
   JANGAN commit file `*.conf` asli ke GitHub!
3. Klik **Connect** di dashboard. Bukti sah: panel **🔍 Bukti Tunnel Asli**
   (`wg show` + ping via tunnel) dan **🌐 IP Publik Live**.

## 🔄 Cara ganti IP (WARP) — WAJIB login Cloudflare dulu!

Berdasarkan pengalaman: tombol **🔄 Ganti IP (tanpa matikan tunnel)** di
dashboard HANYA berhasil kalau aplikasi WARP sudah login ke akun Cloudflare.
Tanpa login, IP yang dikembalikan sering sama terus.

Langkahnya:

1. Buka aplikasi **Cloudflare One Client / WARP**.
2. Klik menu **Profile** (sidebar kiri).
3. Di bagian **Cloudflare One team login**, klik **Login** dan selesaikan
   login ke akun Cloudflare kamu (buat akun gratis bila belum punya).
4. Pastikan status WARP **Connected**.
5. Kembali ke dashboard VPN (`http://localhost:3001`), klik
   **🔄 Ganti IP (tanpa matikan tunnel)**.
6. Klik **Cek IP Sekarang** — IP harusnya berubah
   (mis. `104.28.215.130` → `104.28.215.132`).
7. Tunnel WireGuard lokal (`10.9.0.2`) TETAP terhubung — tidak perlu
   Disconnect/Connect ulang.

Catatan: IP baru kadang masih satu blok yang sama (mis. ujung `.130` ke
`.132`). Itu normal untuk WARP gratis. Ulangi 2–3x untuk blok berbeda, atau
reset registrasi WARP untuk identitas baru.

Struktur:
- `app/page.tsx` = UI (Connect, Bukti Tunnel, IP Live, Ganti IP)
- `lib/servers.ts` = daftar server VPN asli
- `lib/real-vpn.ts` = eksekusi WireGuard + WARP asli di OS
- `app/api/*` = backend (connect, disconnect, status, servers, ip, proof, warp-reconnect)
- `electron/main.js` = proses utama Electron (server otomatis + minta admin)

