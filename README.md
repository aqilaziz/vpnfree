# � Ganti IP (Cloudflare WARP) v1.2.0

Aplikasi Next.js 14 untuk **ganti IP publik via Cloudflare WARP**.
Tanpa WireGuard, tanpa Electron — cukup buka browser dan klik tombol.

## Jalankan

```
cd D:\App\vpn-nextjs
npm install
npm run dev
```

Buka http://localhost:3001

## Cara pakai

1. Klik **🔄 Ganti IP** untuk mendapatkan IP publik baru.
2. Klik **Cek IP Sekarang** untuk memperbarui tampilan IP.
3. IP Cloudflare (WARP) ditandai badge ☁️; IP biasa ditandai 🏠.

## 🔄 Cara ganti IP (WARP) — WAJIB login Cloudflare dulu!

Berdasarkan pengalaman: tombol **🔄 Ganti IP** HANYA berhasil kalau aplikasi
WARP sudah login ke akun Cloudflare. Tanpa login, IP yang dikembalikan sering
sama terus.

Langkahnya:

1. Buka aplikasi **Cloudflare One Client / WARP**.
2. Klik menu **Profile** (sidebar kiri).
3. Di bagian **Cloudflare One team login**, klik **Login** dan selesaikan
   login ke akun Cloudflare kamu (buat akun gratis bila belum punya).
4. Pastikan status WARP **Connected**.
5. Kembali ke dashboard VPN (`http://localhost:3001`), klik
   **🔄 Ganti IP**.
6. Klik **Cek IP Sekarang** — IP harusnya berubah
   (mis. `104.28.215.130` → `104.28.215.132`).

Catatan: IP baru kadang masih satu blok yang sama (mis. ujung `.130` ke
`.132`). Itu normal untuk WARP gratis. Ulangi 2–3x untuk blok berbeda, atau
reset registrasi WARP untuk identitas baru.

Struktur:

- `app/page.tsx` = UI (Cek IP + Ganti IP)
- `lib/real-vpn.ts` = cek IP publik + restart WARP di OS
- `app/api/ip/route.ts` = endpoint cek IP
- `app/api/warp-reconnect/route.ts` = endpoint ganti IP WARP
