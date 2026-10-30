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
// Metode: warp-cli disconnect -> rotate-keys -> connect, agar sesi egress dibuat ulang.
// Kalau rotate-keys gagal (butuh admin), fallback ke disconnect/connect biasa.
const WARP_CLI =
  '"C:\\Program Files\\Cloudflare\\Cloudflare WARP\\warp-cli.exe"';

export async function reconnectWarp(): Promise<{
  ok: boolean;
  before: string | null;
  after: string | null;
  changed: boolean;
  detail: string;
}> {
  const before = await getPublicIp();
  const steps: string[] = [`IP awal: ${before ?? "?"}`];

  // 1. Disconnect agar sesi egress lama dilepas
  const disc = await sh(`${WARP_CLI} disconnect`, 20000);
  steps.push(
    "disconnect: " + (disc.stdout || disc.stderr || "").trim().slice(0, 200),
  );
  await new Promise((x) => setTimeout(x, 3000));

  // 2. Buat keypair sesi baru (identitas sesi baru -> peluang IP baru lebih besar).
  //    Perintah ini TIDAK menghapus registrasi akun, hanya rotasi kunci tunnel.
  const rot = await sh(`${WARP_CLI} tunnel rotate-keys`, 25000);
  steps.push(
    "rotate-keys: " + (rot.stdout || rot.stderr || "").trim().slice(0, 200),
  );
  await new Promise((x) => setTimeout(x, 2000));

  // 3. Connect lagi
  const conn = await sh(`${WARP_CLI} connect`, 25000);
  steps.push(
    "connect: " + (conn.stdout || conn.stderr || "").trim().slice(0, 200),
  );

  // 4. Tunggu IP stabil DAN berubah (polling max ~40 detik)
  //    Sebelum: `if (after) break` — berhenti begitu IP terbaca, padahal
  //    bisa jadi masih IP lama (WARP belum selesai). Sekarang tunggu sampai
  //    IP benar-benar berbeda dari IP awal.
  let after: string | null = null;
  for (let i = 0; i < 8; i++) {
    await new Promise((x) => setTimeout(x, 5000));
    after = await getPublicIp();
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
        : " | IP masih sama — WARP kadang memberi IP yang sama. Coba klik lagi, atau reset registrasi (warp-cli registration delete + new) untuk identitas baru."),
  };
}
