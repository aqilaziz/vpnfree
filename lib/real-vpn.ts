import { exec } from "child_process";
import fs from "fs";
import path from "path";
import type { VpnState } from "./store";

function sh(cmd: string, timeout = 15000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ stdout: String(stdout ?? ""), stderr: err ? String(stderr ?? "") + " " + err.message : String(stderr ?? "") });
    });
  });
}

export async function getPublicIp(): Promise<string | null> {
  // Coba beberapa provider IP publik (yang berubah kalau VPN sungguhan aktif)
  for (const url of ["https://api.ipify.org", "https://ifconfig.me/ip", "https://icanhazip.com"]) {
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

// Lokasi configs: dukung dev (cwd=project), standalone (cwd=.next/standalone),
// dan Electron asar (app.asar tidak bisa ditulisi -> pakai folder userData/exe).
// Prioritas: ENV VPN_CONFIG_DIR > folder exe/configs > cwd/configs > .next/standalone/configs
function resolveConfigDir() {
  const dirs: string[] = [];
  if (process.env.VPN_CONFIG_DIR) dirs.push(process.env.VPN_CONFIG_DIR);
  try {
    // Folder userData Electron (bisa ditulisi): %APPDATA%/VPN WireGuard Asli/configs
    const app = (global as any)?.electronApp;
    if (app?.getPath) dirs.push(path.join(app.getPath("userData"), "configs"));
  } catch {}
  try {
    // Di samping file .exe (portable): <exeDir>/configs dan <exeDir>/resources/configs
    dirs.push(path.join(path.dirname(process.execPath), "configs"));
    dirs.push(path.join(path.dirname(process.execPath), "resources", "configs"));
  } catch {}
  dirs.push(path.join(process.cwd(), "configs"));
  dirs.push(path.join(process.cwd(), ".next", "standalone", "configs"));
  // Lokasi source saat dev: hapus segmen .next/standalone dari cwd
  const noStandalone = process.cwd().replace(/\.next.+standalone.?/i, "");
  if (noStandalone !== process.cwd()) dirs.push(path.join(noStandalone, "configs"));
  for (const d of dirs) {
    try { if (d && fs.existsSync(d) && fs.statSync(d).isDirectory()) return d; } catch {}
  }
  return dirs[dirs.length - 1];
}

let _configDir: string | null = null;
export function getConfigDir() {
  if (!_configDir) _configDir = resolveConfigDir();
  return _configDir;
}

export function configPathFor(serverId: string) {
  return path.join(getConfigDir(), `${serverId}.conf`);
}

export function hasConfig(serverId: string) {
  return fs.existsSync(configPathFor(serverId));
}

export async function checkWireGuard(): Promise<{ installed: boolean; detail: string }> {
  const WG = '"C:\\Program Files\\WireGuard\\wg.exe"';
  const WGUI = '"C:\\Program Files\\WireGuard\\wireguard.exe"';
  const a = await sh(`${WG} version`);
  if (a.stdout.toLowerCase().includes("wireguard")) return { installed: true, detail: a.stdout.trim().split("\n")[0] };
  const b = await sh("where wg");
  if (b.stdout.toLowerCase().includes("wg")) return { installed: true, detail: b.stdout.trim().split("\n")[0] };
  const c = await sh(`${WGUI} /help`);
  if (!c.stdout.toLowerCase().includes("not recognized") && !c.stderr.toLowerCase().includes("not recognized")) return { installed: true, detail: "C:\\Program Files\\WireGuard\\wireguard.exe" };
  return { installed: false, detail: "wg / wireguard.exe tidak ditemukan di PATH" };
}

export async function wgShow(): Promise<string> {
  const WG = '"C:\\Program Files\\WireGuard\\wg.exe"';
  let r = await sh(`${WG} show`);
  if (!r.stdout.trim()) r = await sh("wg show");
  return (r.stdout || r.stderr || "").slice(0, 2000);
}

// Konek SUNGGUHAN di Windows:
// - Butuh WireGuard client terinstall (https://www.wireguard.com/install/)
// - Butuh file configs/<serverId>.conf dari provider/VPS kamu
// - Perintah resmi Windows: wireguard.exe /installtunnelservice <conf>
export async function connectReal(serverId: string): Promise<{ ok: boolean; detail: string; virtualIp: string | null }> {
  const conf = configPathFor(serverId);
  if (!fs.existsSync(conf)) {
    return { ok: false, detail: `File ${conf} tidak ada. Taruh file .conf WireGuard asli di folder configs/`, virtualIp: null };
  }
  const wg = await checkWireGuard();
  if (!wg.installed) {
    return { ok: false, detail: "WireGuard belum terinstall. Install dari wireguard.com/install lalu ulangi.", virtualIp: null };
  }

  // 1. Coba install tunnel service (cara resmi Windows)
  // Nama service tidak boleh ada spasi, pakai serverId
  const svc = serverId.replace(/[^a-z0-9_-]/gi, "");
  const WGUI = '"C:\\Program Files\\WireGuard\\wireguard.exe"';
  // wireguard.exe butuh full path karena tidak ada di PATH
  let r = await sh(`${WGUI} /installtunnelservice "${conf}"`, 20000);
  let log = r.stdout + " " + r.stderr;

  // fallback: coba tanpa path (kalau user menambahkan ke PATH manual)
  if (log.toLowerCase().includes("not recognized") || log.toLowerCase().includes("tidak dikenal")) {
    r = await sh(`"C:\\Program Files\\WireGuard\\wireguard.exe" /installtunnelservice "${conf}"`, 20000);
    log = r.stdout + " " + r.stderr;
  }

  await new Promise((x) => setTimeout(x, 3000));
  const show = await wgShow();

  // Ambil IP virtual dari conf (Address = ...)
  let virtualIp: string | null = null;
  try {
    const txt = fs.readFileSync(conf, "utf8");
    const m = txt.match(/Address\s*=\s*([0-9.\/,\s]+)/i);
    if (m) virtualIp = m[1].trim().split(",")[0].trim();
  } catch {}

  // Idempotent: kalau wireguard.exe bilang tunnel sudah terpasang/berjalan,
  // itu BUKAN kegagalan — selama interface muncul di `wg show`, anggap sukses.
  const alreadyRunning = /already installed|already running/i.test(log);
  const interfaceActive = new RegExp(`interface:\\s*${svc}`, "i").test(show);
  const ok = interfaceActive || (alreadyRunning && show.trim().length > 0) || show.toLowerCase().includes("interface");
  const detail = ok && alreadyRunning
    ? `Tunnel ${svc} sudah aktif sebelumnya (idempotent) | wg show: ${show}`
    : log + " | wg show: " + show;
  return { ok, detail: detail.slice(0, 1500), virtualIp };
}

// Sinkronkan state dengan kondisi nyata `wg show`.
// Dipakai oleh GET /api/status supaya dashboard tidak menampilkan status basi
// (mis. state PUTUS padahal tunnel masih jalan, atau sebaliknya).
export async function syncStateWithReality(): Promise<VpnState> {
  const { getState, setState } = await import("./store");
  const s = getState();
  const show = await wgShow();
  const active = show.toLowerCase().includes("interface:");

  if (active && !s.connected) {
    // Tunnel jalan tapi state bilang putus -> pulihkan dari conf terakhir / default server
    const sid = s.serverId ?? SERVERS_FALLBACK_ID;
    let virtualIp: string | null = null;
    try {
      const txt = fs.readFileSync(configPathFor(sid), "utf8");
      const m = txt.match(/Address\s*=\s*([0-9.\/,\s]+)/i);
      if (m) virtualIp = m[1].trim().split(",")[0].trim();
    } catch {}
    return setState({ connected: true, serverId: sid, mode: "SUNGGUHAN", virtualIp: virtualIp ?? s.virtualIp, detail: "Status disinkronkan dari wg show (tunnel aktif)" });
  }
  if (!active && s.connected) {
    return setState({ connected: false, serverId: null, connectedAt: null, virtualIp: null, mode: "PUTUS", detail: "Status disinkronkan dari wg show (tidak ada interface aktif)" });
  }
  return s;
}
const SERVERS_FALLBACK_ID = "local-1";

export async function disconnectReal(serverId: string | null): Promise<{ detail: string }> {
  if (!serverId) return { detail: "tidak ada koneksi aktif" };
  const svc = serverId.replace(/[^a-z0-9_-]/gi, "");
  const WGUI = '"C:\\Program Files\\WireGuard\\wireguard.exe"';
  let r = await sh(`${WGUI} /uninstalltunnelservice ${svc}`, 15000);
  let log = r.stdout + " " + r.stderr;
  if (log.toLowerCase().includes("not recognized")) {
    r = await sh(`wireguard.exe /uninstalltunnelservice ${svc}`, 15000);
    log = r.stdout + " " + r.stderr;
  }
  return { detail: log.slice(0, 1000) };
}

// Ganti IP WARP TANPA menyentuh tunnel WireGuard lokal.
// Nama service yang BENAR di versi consumer: "CloudflareWARP" (bukan "warp-svc").
// Metode: warp-cli disconnect -> rotate-keys -> connect, agar sesi egress dibuat ulang.
// Kalau rotate-keys gagal (butuh admin), fallback ke disconnect/connect biasa.
// Tunnel WireGuard lokal (local-1) TIDAK disentuh sama sekali.
const WARP_CLI = '"C:\\Program Files\\Cloudflare\\Cloudflare WARP\\warp-cli.exe"';

export async function reconnectWarp(): Promise<{
  ok: boolean; before: string | null; after: string | null;
  changed: boolean; detail: string;
}> {
  const before = await getPublicIp();
  const steps: string[] = [`IP awal: ${before ?? "?"}`];

  // 1. Disconnect agar sesi egress lama dilepas
  const disc = await sh(`${WARP_CLI} disconnect`, 20000);
  steps.push("disconnect: " + (disc.stdout || disc.stderr || "").trim().slice(0, 200));
  await new Promise((x) => setTimeout(x, 3000));

  // 2. Buat keypair sesi baru (identitas sesi baru -> peluang IP baru lebih besar).
  //    Perintah ini TIDAK menghapus registrasi akun, hanya rotasi kunci tunnel.
  const rot = await sh(`${WARP_CLI} tunnel rotate-keys`, 25000);
  steps.push("rotate-keys: " + (rot.stdout || rot.stderr || "").trim().slice(0, 200));
  await new Promise((x) => setTimeout(x, 2000));

  // 3. Connect lagi
  const conn = await sh(`${WARP_CLI} connect`, 25000);
  steps.push("connect: " + (conn.stdout || conn.stderr || "").trim().slice(0, 200));

  // 4. Tunggu IP stabil (polling max ~40 detik)
  let after: string | null = null;
  for (let i = 0; i < 8; i++) {
    await new Promise((x) => setTimeout(x, 5000));
    after = await getPublicIp();
    if (after) break;
  }
  steps.push(`IP akhir: ${after ?? "?"}`);

  const all = steps.join(" | ");
  const denied = all.toLowerCase();
  if (denied.includes("access is denied") || denied.includes("akses ditolak") || denied.includes("failed 5") || denied.includes("permission")) {
    return {
      ok: false, before, after, changed: false,
      detail: "Butuh Administrator: jalankan Next.js / Electron sebagai Administrator, lalu coba lagi. " + all,
    };
  }

  const changed = !!before && !!after && before !== after;
  return {
    ok: !!after,
    before,
    after,
    changed,
    detail: all + (changed ? ` | ✅ IP BERUBAH ${before} -> ${after}` : " | IP masih sama — WARP kadang memberi IP yang sama. Coba klik lagi, atau reset registrasi (warp-cli registration delete + new) untuk identitas baru."),
  };
}
export async function proofTunnel(serverId: string): Promise<{
  interfaceFound: boolean;
  peerCount: number;
  latestHandshake: string | null;
  transfer: string | null;
  endpoint: string | null;
  pingOk: boolean;
  pingDetail: string;
  raw: string;
}> {
// Bukti tunnel asli: parse `wg show` + ping IP peer lewat tunnel + cek handshake
  const show = await wgShow();
  const svc = serverId.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  const lower = show.toLowerCase();
  const interfaceFound = lower.includes(`interface: ${svc}`) || lower.includes("interface:");
  const peerCount = (show.match(/^peer:/gim) || []).length;
  const hs = show.match(/latest handshake:\s*(.+)/i);
  const tr = show.match(/transfer:\s*(.+)/i);
  const ep = show.match(/endpoint:\s*(.+)/i);

  // Ambil IP peer dari conf untuk ping (Address peer = server 10.9.0.1)
  let pingTarget = "10.9.0.1";
  try {
    const txt = fs.readFileSync(configPathFor(serverId), "utf8");
    const m = txt.match(/AllowedIPs\s*=\s*([0-9.\/,\s]+)/i);
    if (m) {
      const first = m[1].split(",")[0].trim().replace("/24", "").replace("/32", "");
      if (/^\d+\.\d+\.\d+\.\d+$/.test(first)) pingTarget = first;
    }
    // Untuk client local-1, AllowedIPs = 10.9.0.0/24 -> ping server 10.9.0.1
    if (pingTarget.endsWith(".0")) pingTarget = pingTarget.replace(/\.0$/, ".1");
  } catch {}

  const ping = await sh(`ping -n 3 ${pingTarget}`, 15000);
  const pingOk = ping.stdout.includes("Reply from") || ping.stdout.includes("bytes=32");
  return {
    interfaceFound,
    peerCount,
    latestHandshake: hs ? hs[1].trim() : null,
    transfer: tr ? tr[1].trim() : null,
    endpoint: ep ? ep[1].trim() : null,
    pingOk,
    pingDetail: (ping.stdout || ping.stderr).slice(0, 800),
    raw: show.slice(0, 2000),
  };
}
