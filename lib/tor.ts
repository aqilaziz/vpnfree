import { execFile } from "child_process";
import { promisify } from "util";

const pexec = promisify(execFile);

// ============================================================
// KONTROL TOR — ganti IP via SOCKS proxy + sinyal NEWNYM.
// Sumber IP: ribuan exit node Tor di seluruh dunia (rentang sangat panjang).
// Prasyarat (sudah dipasang di PC ini):
//   - Tor:    C:\Tor\Browser\TorBrowser\Tor\tor.exe  (dari Tor Browser portable)
//   - torrc:  C:\Tor\torrc  (SocksPort 9050, ControlPort 9051 + hashed password)
//   - Stem:   pip install stem  (Python >= 3)
// Endpoint:
//   POST /api/tor-rotate -> NEWNYM (IP baru), auto-start Tor bila mati
//   GET  /api/tor-status -> info Tor, port, versi Stem
// ============================================================

export const TOR_EXE = "C:\\Tor\\Browser\\TorBrowser\\Tor\\tor.exe";
export const TORRC = "C:\\Tor\\torrc";
export const TOR_LOG = "C:\\Tor\\tor.log";
export const TOR_SOCKS_PORT = Number(process.env.TOR_SOCKS_PORT || 9050);
export const TOR_CONTROL_PORT = Number(process.env.TOR_CONTROL_PORT || 9051);
export const TOR_CONTROL_PASSWORD =
  process.env.TOR_CONTROL_PASSWORD || "vpnfree-tor";

// Cari python yang benar-benar punya modul stem (beberapa PC punya banyak python).
async function findPython(): Promise<string | null> {
  const candidates = [
    "C:\\Users\\Admin\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
    "python",
    "python3",
  ];
  for (const py of candidates) {
    try {
      await pexec(py, ["-c", "import stem"], {
        timeout: 15000,
        windowsHide: true,
      });
      return py;
    } catch {}
  }
  return null;
}

export async function torRunning(): Promise<boolean> {
  try {
    const { stdout } = await pexec(
      "tasklist",
      ["/FI", "IMAGENAME eq tor.exe", "/NH"],
      { timeout: 10000, windowsHide: true },
    );
    return /tor\.exe/i.test(stdout);
  } catch {
    return false;
  }
}

export async function startTor(): Promise<{ ok: boolean; detail: string }> {
  if (await torRunning()) return { ok: true, detail: "Tor sudah jalan" };
  try {
    const child = require("child_process").spawn(TOR_EXE, ["-f", TORRC], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    });
    child.unref();
    // Tunggu bootstrap sampai SOCKS menjawab (maks ~60 dtk)
    for (let i = 0; i < 12; i++) {
      await new Promise((x) => setTimeout(x, 5000));
      const ip = await ipViaTor();
      if (ip) return { ok: true, detail: `Tor aktif, egress ${ip}` };
    }
    return {
      ok: false,
      detail:
        "Tor jalan tapi SOCKS belum bisa keluar (bootstrap lama? cek C:\\Tor\\tor.log)",
    };
  } catch (e: any) {
    return { ok: false, detail: "Gagal start Tor: " + String(e?.message ?? e) };
  }
}

export async function ipViaTor(): Promise<string | null> {
  try {
    const { stdout } = await pexec(
      "curl",
      [
        "-s",
        "-m",
        "15",
        "--socks5-hostname",
        `127.0.0.1:${TOR_SOCKS_PORT}`,
        "https://api.ipify.org",
      ],
      { timeout: 20000, windowsHide: true },
    );
    const ip = stdout.trim();
    return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : null;
  } catch {
    return null;
  }
}

// Jalankan skrip Python/Stem: authenticate ke control port lalu kirim NEWNYM.
// Skrip dibangun dari array baris agar bebas masalah escaping template string.
const ROTATE_PY = [
  "import sys, subprocess, time",
  "from stem import Signal",
  "from stem.control import Controller",
  "socks, port, pwd = sys.argv[1], int(sys.argv[2]), sys.argv[3]",
  "def ip_now():",
  "    r = subprocess.run(['curl','-s','-m','15','--socks5-hostname',socks,'https://api.ipify.org'], capture_output=True, text=True)",
  "    return r.stdout.strip()",
  "with Controller.from_port(port=port) as c:",
  "    c.authenticate(password=pwd)",
  "    before = ip_now()",
  "    c.signal(Signal.NEWNYM)",
  "    after = before",
  "    for _ in range(8):",
  "        time.sleep(4)",
  "        a = ip_now()",
  "        if a and a != before:",
  "            after = a; break",
  "        if a: after = a",
  "print(before + '|' + after)",
].join("\n");

export async function rotateTorIp(): Promise<{
  ok: boolean;
  before: string | null;
  after: string | null;
  changed: boolean;
  detail: string;
}> {
  const py = await findPython();
  if (!py) {
    return {
      ok: false,
      before: null,
      after: null,
      changed: false,
      detail: "Python/STEM tidak ditemukan. Jalankan: pip install stem",
    };
  }
  if (!(await torRunning())) {
    const s = await startTor();
    if (!s.ok)
      return {
        ok: false,
        before: null,
        after: null,
        changed: false,
        detail: s.detail,
      };
  }
  try {
    const { stdout } = await pexec(
      py,
      [
        "-c",
        ROTATE_PY,
        `127.0.0.1:${TOR_SOCKS_PORT}`,
        String(TOR_CONTROL_PORT),
        TOR_CONTROL_PASSWORD,
      ],
      {
        timeout: 120000,
        windowsHide: true,
      },
    );
    const [before, after] = stdout.trim().split("|");
    const b = before && before !== "?" ? before : null;
    const a = after && after !== "?" ? after : null;
    const changed = !!b && !!a && b !== a;
    return {
      ok: !!a,
      before: b,
      after: a,
      changed,
      detail: changed
        ? `✅ IP TOR BERUBAH ${b} -> ${a} (exit node baru)`
        : "IP Tor masih sama — coba klik lagi (NEWNYM kadang memilih exit yang sama dalam 10 menit).",
    };
  } catch (e: any) {
    const msg = String(e?.stderr || e?.message || e);
    let hint = "";
    if (/No module named ['"]?stem/.test(msg)) hint = " → pip install stem";
    if (/Connection refused|Could not connect/.test(msg))
      hint =
        " → ControlPort Tor mati? Start ulang Tor (tombol ini otomatis menyalakan).";
    if (/Unauthenticated|Bad authentication/.test(msg))
      hint =
        " → Password kontrol salah. Cek HashedControlPassword di C:\\Tor\\torrc.";
    return {
      ok: false,
      before: null,
      after: null,
      changed: false,
      detail: "Rotasi gagal: " + msg.slice(0, 300) + hint,
    };
  }
}

export async function torStatus(): Promise<Record<string, unknown>> {
  const running = await torRunning();
  const py = await findPython();
  let version: string | null = null;
  try {
    const { stdout } = await pexec(TOR_EXE, ["--version"], {
      timeout: 10000,
      windowsHide: true,
    });
    version = stdout.split("\n")[0].trim();
  } catch {}
  const ip = running ? await ipViaTor() : null;
  return {
    running,
    socksPort: TOR_SOCKS_PORT,
    controlPort: TOR_CONTROL_PORT,
    python: py,
    stemInstalled: !!py,
    version,
    egressIp: ip,
  };
}
