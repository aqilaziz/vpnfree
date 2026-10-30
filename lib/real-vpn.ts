import { exec } from "child_process";

function sh(
  cmd: string,
  timeout = 15000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        stdout: String(stdout ?? ""),
        stderr: err
          ? String(stderr ?? "") + " " + err.message
          : String(stderr ?? ""),
      });
    });
  });
}

// Cek IP publik dari beberapa provider.
export async function getPublicIp(): Promise<string | null> {
  for (const url of [
    "https://api.ipify.org",
    "https://ifconfig.me/ip",
    "https://icanhazip.com",
  ]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      const txt = (await r.text()).trim();
      if (/^\d+\.\d+\.\d+\.\d+$/.test(txt) || txt.includes(":")) return txt;
    } catch {}
  }
  return null;
}

export type GeoInfo = {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  flag: string;
  label: string;
};

export async function getGeo(ip: string): Promise<GeoInfo | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://ipwho.is/${ip}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    const j = await r.json();
    if (!j.success) return null;
    const flag = j.flag?.emoji ?? "";
    const city = j.city ?? "";
    const country = j.country ?? "";
    const label =
      city && country
        ? `${flag} ${city}, ${country}`
        : flag
          ? `${flag} ${country}`
          : country;
    return {
      country,
      countryCode: j.country_code ?? "",
      city,
      region: j.region ?? "",
      flag,
      label: label.trim(),
    };
  } catch {
    return null;
  }
}

// Cek status WARP langsung dari endpoint trace Cloudflare (cdn-cgi/trace).
// Return: { warp: "on" | "off" } atau {} kalau gagal.
export async function getCfTrace(): Promise<{ warp?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (!r.ok) return {};
    const txt = await r.text();
    const m = txt.match(/^warp=(.*)$/m);
    return m ? { warp: m[1].trim() } : {};
  } catch {
    return {};
  }
}

// Ganti IP via Cloudflare WARP.
// Nama service yang BENAR di versi consumer: "CloudflareWARP" (bukan "warp-svc").
// Metode lama (disconnect -> rotate-keys -> connect) TIDAK efektif: rotate-keys
// hanya mengganti keypair tapi tetap memakai REGISTRASI (identitas perangkat) yang
// sama, sehingga Cloudflare memberi IP dari pool yang sama -> IP sering tidak berubah.
// Metode baru: reset registrasi (registration delete + new) = identitas perangkat
// baru -> IP egress baru. Akun Free tanpa license key aman di-reset; kalau ada
// license key tersimpan, dipulihkan otomatis setelah registrasi baru.
const WARP_CLI =
  '"C:\\Program Files\\Cloudflare\\Cloudflare WARP\\warp-cli.exe"';

// Ambil IPv4 publik saja. Penting: provider IP default kadang mengembalikan alamat
// IPv6 (mis. 2a09:bac5:...) yang BERBEDA dari IPv4 WARP (104.28.x.x). Kalau dua-duanya
// dibandingkan, IP terlihat "berubah" padahal tidak. Jadi sebelum & sesudah harus
// diukur dengan cara yang sama: IPv4.
export async function getPublicIpV4(): Promise<string | null> {
  for (const url of [
    "https://api.ipify.org",
    "https://api-ipv4.ip.sb/ip",
    "https://v4.ident.me",
  ]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      // @ts-expect-error — 'family' didukung Node fetch (undici) untuk pin IPv4
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store", family: 4 });
      clearTimeout(t);
      const txt = (await r.text()).trim();
      if (/^\d+\.\d+\.\d+\.\d+$/.test(txt)) return txt;
    } catch {}
  }
  return null;
}

// Baca license key aktif dari "warp-cli registration show" (untuk pemulihan pasca-reset).
async function getWarpLicense(): Promise<string | null> {
  const r = await sh(`${WARP_CLI} registration show`, 15000);
  const m = (r.stdout || "").match(/License:\s*([A-Za-z0-9-]+)/);
  return m ? m[1] : null;
}

export async function reconnectWarp(): Promise<{
  ok: boolean;
  before: string | null;
  after: string | null;
  changed: boolean;
  detail: string;
}> {
  const before = await getPublicIpV4();
  const steps: string[] = [`IP awal: ${before ?? "?"}`];

  // 1. Disconnect agar sesi egress lama dilepas
  const disc = await sh(`${WARP_CLI} disconnect`, 20000);
  steps.push(
    "disconnect: " + (disc.stdout || disc.stderr || "").trim().slice(0, 200),
  );
  await new Promise((x) => setTimeout(x, 3000));

  // 2. Simpan license key (kalau ada) supaya akun Plus tidak hilang setelah reset.
  const lic = await getWarpLicense();
  steps.push("license tersimpan: " + (lic ? "ya" : "tidak (Free)"));

  // 3. RESET REGISTRASI = identitas perangkat baru -> pool IP baru.
  //    Ini kunci perbaikan: rotate-keys saja tidak mengubah IP karena registrasi tetap.
  const del = await sh(`${WARP_CLI} registration delete`, 25000);
  steps.push(
    "registration delete: " + (del.stdout || del.stderr || "").trim().slice(0, 200),
  );
  await new Promise((x) => setTimeout(x, 2000));
  const nw = await sh(`${WARP_CLI} --accept-tos registration new`, 30000);
  steps.push(
    "registration new: " + (nw.stdout || nw.stderr || "").trim().slice(0, 200),
  );

  // 4. Pulihkan license key bila tadi ada.
  if (lic) {
    const back = await sh(`${WARP_CLI} registration license ${lic}`, 25000);
    steps.push(
      "license dipulihkan: " + (back.stdout || back.stderr || "").trim().slice(0, 120),
    );
  }

  // 5. Connect lagi
  const conn = await sh(`${WARP_CLI} connect`, 25000);
  steps.push(
    "connect: " + (conn.stdout || conn.stderr || "").trim().slice(0, 200),
  );

  // 6. Tunggu IP IPv4 stabil DAN berubah (polling max ~60 detik).
  //    Reset registrasi butuh beberapa detik sampai tunnel naik kembali.
  let after: string | null = null;
  for (let i = 0; i < 12; i++) {
    await new Promise((x) => setTimeout(x, 5000));
    after = await getPublicIpV4();
    if (after && after !== before) break;
  }
  steps.push(`IP akhir: ${after ?? "?"}`);

  const all = steps.join(" | ");
  const denied = all.toLowerCase();
  if (
    denied.includes("access is denied") ||
    denied.includes("akses ditolak") ||
    denied.includes("failed 5") ||
    denied.includes("permission")
  ) {
    return {
      ok: false,
      before,
      after,
      changed: false,
      detail:
        "Butuh Administrator: jalankan Next.js / Electron sebagai Administrator, lalu coba lagi. " +
        all,
    };
  }

  const changed = !!before && !!after && before !== after;
  return {
    ok: !!after,
    before,
    after,
    changed,
    detail:
      all +
      (changed
        ? ` | ✅ IP BERUBAH ${before} -> ${after}`
        : " | IP masih sama — pool WARP region-mu sempit. Coba lagi 1-2x; kalau tetap sama, satu-satunya cara andal adalah pindah lokasi keluar (VPN dengan pilihan server, bukan WARP)."),
  };
}
