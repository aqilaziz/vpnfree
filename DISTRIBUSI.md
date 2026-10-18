# Distribusi Windows (Electron .exe installer)

Aplikasi ini BISA dibuild jadi installer Windows `.exe` (NSIS) agar bisa
diinstall di semua komputer Windows tanpa install Node.js / npm.

## Cara build installer (di laptop ini, sekali saja)

```powershell
cd D:\App\vpn-nextjs
npm install
npm run dist
```

Hasilnya: `D:\App\vpn-nextjs\dist-electron\VPN-WireGuard-Asli-Setup-1.0.0.exe`
Ukuran sekitar 80–120 MB (sudah termasuk Chromium + Node + Next.js).

Bagikan file `.exe` itu ke komputer lain → double klik → Next → Finish.
Aplikasi jalan sebagai window desktop "VPN WireGuard Asli" (server Next.js
jalan otomatis di dalam, di http://127.0.0.1:3001, tanpa browser).

## Syarat di komputer tujuan (PENTING, jujur)

Installer Electron HANYA membawa UI + server Next.js. Agar VPN-nya berfungsi,
komputer tujuan tetap butuh 2 hal ini (tidak bisa dibundel otomatis karena
butuh driver + hak admin + identitas unik per mesin):

1. **WireGuard client** — install dari https://www.wireguard.com/install/
   (atau via PowerShell admin: `winget install --id WireGuard.WireGuard`)
2. **File `local-1.conf` asli** — JANGAN ikutkan private key kamu ke installer!
   Tiap komputer harus punya keypair sendiri. Cara aman:
   - User buka folder install → `resources\configs\` → taruh `local-1.conf` miliknya, atau
   - Generate keypair baru per komputer (script menyusul), atau
   - Sambungkan ke server VPN pusat (VPS) — tiap client dapat conf berbeda.

3. **Jalankan sebagai Administrator** — klik kanan aplikasi → Run as administrator,
   karena `/installtunnelservice` butuh hak admin untuk membuat tunnel.

## Mode distribusi yang disarankan

- **Sekolah/kantor (1 server pusat):** sewa 1 VPS → semua komputer install
  aplikasi Electron + conf client masing-masing yang routing ke VPS itu.
  IP publik tiap komputer ikut berubah jadi IP VPS. Ini arsitektur VPN real.
- **Tanpa server pusat:** tiap komputer hanya punya tunnel lokal seperti sekarang
  (demo enkripsi), IP publik tetap via WARP terpisah.

## File terkait

- `electron/main.js` — proses utama: menjalankan server Next standalone + buka window
- `electron-builder.json` — konfigurasi installer NSIS Windows x64
- `next.config.js` — `output: "standalone"` agar server bisa jalan tanpa `npm`
