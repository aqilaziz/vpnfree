const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");

const PORT = 3001;
let nextProc = null;
let mainWin = null;

// Daftarkan app ke global agar lib/real-vpn.ts bisa pakai app.getPath("userData")
global.electronApp = app;

// Siapkan folder configs yang BISA DITULISI di userData + copy contoh bila kosong.
// Alasan: file di dalam app.asar read-only, jadi local-1.conf milik user harus
// tinggal di %APPDATA%/VPN WireGuard Asli/configs (per-mesin, unik per komputer).
function ensureUserConfigs() {
  try {
    const dir = path.join(app.getPath("userData"), "configs");
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, "local-1.conf");
    if (!fs.existsSync(dest)) {
      // Cari contoh conf dari resourcesextraResources -> resources/configs/CONTOH...
      const candidates = [
        path.join(process.resourcesPath || "", "configs", "CONTOH.local-1.conf.txt"),
        path.join(__dirname, "..", "configs", "CONTOH.local-1.conf.txt"),
      ];
      for (const c of candidates) {
        try {
          if (c && fs.existsSync(c)) {
            fs.copyFileSync(c, path.join(dir, "PETUNJUK.txt"));
            break;
          }
        } catch {}
      }
      const petunjuk =
        "Taruh file local-1.conf WireGuard asli milik komputer ini di folder ini.\n" +
        "JANGAN pakai private key dari komputer lain — tiap mesin harus punya keypair sendiri.\n" +
        "Lalu restart aplikasi dan klik Connect.\n";
      fs.writeFileSync(path.join(dir, "BACA-DULU.txt"), petunjuk);
    }
    // Beri tahu server Next lokasi configs via ENV (dipakai bila userData tidak terbaca)
    process.env.VPN_CONFIG_DIR = dir;
    return dir;
  } catch (e) {
    console.log("ensureUserConfigs gagal:", e?.message);
    return null;
  }
}

// Cek + minta hak admin untuk fitur ganti IP (warp-cli butuh admin).
// Tanpa admin, tombol Ganti IP akan gagal dengan pesan yang jelas.
function ensureAdmin() {
  try {
    execSync('net session >nul 2>&1');
    return true;
  } catch {
    const r = dialog.showMessageBoxSync({
      type: "warning",
      buttons: ["Jalankan ulang sebagai Administrator", "Lanjut tanpa admin"],
      defaultId: 0,
      title: "Butuh hak Administrator",
      message: "Agar tombol Ganti IP (WARP) dan Connect WireGuard berfungsi, aplikasi harus berjalan sebagai Administrator.",
      detail: "Pilih 'Jalankan ulang sebagai Administrator' (disarankan). Tanpa admin, Connect/Ganti IP akan gagal.",
    });
    if (r === 0) {
      try {
        const exe = process.execPath;
        spawn("powershell", ["-Command", `Start-Process "${exe}" -Verb RunAs`], { detached: true, stdio: "ignore" });
      } catch {}
      app.quit();
      return false;
    }
    return true;
  }
}

// Next standalone hasil `next build` ada di .next/standalone/server.js
function getServerEntry() {
  const prod = path.join(__dirname, "..", ".next", "standalone", "server.js");
  if (fs.existsSync(prod)) return { cmd: process.execPath, args: [prod], env: { PORT: String(PORT), HOSTNAME: "127.0.0.1" } };
  // fallback dev: jalankan next start dari source (untuk npm run electron-dev)
  return { cmd: "npm", args: ["start", "--prefix", path.join(__dirname, "..")], env: { PORT: String(PORT) } };
}

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      const req = http.get(`http://127.0.0.1:${PORT}/api/ip`, (res) => {
        clearInterval(t);
        resolve(true);
      });
      req.on("error", () => {
        if (n >= retries) { clearInterval(t); reject(new Error("Next.js tidak старт dalam 60 detik")); }
      });
      req.setTimeout(1500);
    }, 1000);
  });
}

async function createWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 850,
    title: "VPN WireGuard Asli",
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWin.on("closed", () => { mainWin = null; });

  try {
    // 0. Siapkan folder configs per-mesin + pastikan admin (agar Ganti IP bisa)
    const cfgDir = ensureUserConfigs();
    const isAdmin = ensureAdmin();
    if (!isAdmin) return; // app quit dan dibuka ulang sebagai admin

    const entry = getServerEntry();
    nextProc = spawn(entry.cmd, entry.args, {
      env: { ...process.env, ...entry.env, NODE_ENV: "production" },
      cwd: path.join(__dirname, ".."),
      windowsHide: true,
    });
    nextProc.stdout?.on("data", (d) => console.log("[next]", String(d).slice(0, 300)));
    nextProc.stderr?.on("data", (d) => console.log("[next-err]", String(d).slice(0, 300)));

    await waitForServer();
    await mainWin.loadURL(`http://127.0.0.1:${PORT}`);
  } catch (e) {
    dialog.showErrorBox("Gagal menjalankan server VPN", String(e?.message || e));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (mainWin === null) createWindow(); });
app.on("before-quit", () => { try { nextProc?.kill(); } catch {} });
