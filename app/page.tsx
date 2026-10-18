"use client";
import { useEffect, useState } from "react";

type Server = {
  id: string; name: string; country: string; flag: string;
  host: string; port: number; protocol: string; load: number; pingMs: number;
  hasRealConfig?: boolean;
};

type Status = {
  connected: boolean; serverId: string | null; connectedAt: string | null;
  virtualIp: string | null; mode?: "SUNGGUHAN" | "PUTUS";
  publicIpBefore?: string | null; publicIpAfter?: string | null; detail?: string | null;
};

type Proof = {
  serverId: string; interfaceFound: boolean; peerCount: number;
  latestHandshake: string | null; transfer: string | null; endpoint: string | null;
  pingOk: boolean; pingDetail: string; raw: string;
};

export default function Page() {
  const [servers, setServers] = useState<Server[]>([]);
  const [wg, setWg] = useState<{ installed: boolean; detail: string } | null>(null);
  const [status, setStatus] = useState<Status>({ connected: false, serverId: null, connectedAt: null, virtualIp: null });
  const [selected, setSelected] = useState("local-1");
  const [loading, setLoading] = useState(false);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [ipInfo, setIpInfo] = useState<string | null>(null);
  const [ipCloudflare, setIpCloudflare] = useState(false);
  const [ipLoading, setIpLoading] = useState(false);
  const [warpLoading, setWarpLoading] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [log, setLog] = useState<string[]>(["VPN asli aktif. Klik Connect untuk nyalakan tunnel WireGuard."]);

  const loadAll = async () => {
    try {
      const r = await fetch("/api/servers");
      const data = await r.json();
      if (Array.isArray(data)) { setServers(data); setWg(null); }
      else { setServers(data.servers ?? []); setWg(data.wireguard ?? null); }
    } catch {}
    try { setStatus(await (await fetch("/api/status")).json()); } catch {}
    try {
      const ipData = await (await fetch("/api/ip")).json();
      setMyIp(ipData.ip ?? null);
      setIpInfo(ipData.detail ?? null);
      setIpCloudflare(!!ipData.isCloudflare);
    } catch {}
  };

  const checkIp = async () => {
    setIpLoading(true);
    try {
      const ipData = await (await fetch("/api/ip")).json();
      setMyIp(ipData.ip ?? null);
      setIpInfo(ipData.detail ?? null);
      setIpCloudflare(!!ipData.isCloudflare);
      setLog(p => [...p, `IP publik sekarang: ${ipData.ip ?? "?"} — ${ipData.detail ?? ""}`]);
    } catch (e: any) { setLog(p => [...p, `Gagal cek IP: ${e?.message}`]); }
    setIpLoading(false);
  };

  // Ganti IP WARP TANPA mematikan tunnel WireGuard lokal.
  const rotateIp = async () => {
    setWarpLoading(true);
    setLog(p => [...p, "Meminta IP baru ke WARP (tunnel lokal tetap jalan)..."]);
    try {
      const r = await fetch("/api/warp-reconnect", { method: "POST" });
      const data = await r.json();
      if (data.after) {
        setMyIp(data.after);
        setIpCloudflare(data.after.startsWith("104.") || data.after.startsWith("172.64.") || data.after.startsWith("172.65."));
      }
      if (r.ok && data.changed) {
        setLog(p => [...p, `✅ IP BERUBAH: ${data.before} → ${data.after}. Tunnel lokal TIDAK dimatikan.`]);
        setIpInfo(`IP baru via WARP — sebelumnya ${data.before}`);
      } else if (r.ok) {
        setLog(p => [...p, `IP masih sama (${data.after}). WARP kadang kasih IP yang sama — klik lagi atau toggle manual di aplikasi WARP.`]);
      } else {
        setLog(p => [...p, `❌ ${data.detail ?? "Gagal reconnect WARP."}`]);
      }
    } catch (e: any) { setLog(p => [...p, `Gagal ganti IP: ${e?.message}`]); }
    setWarpLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const connect = async () => {
    setLoading(true);
    setLog(p => [...p, `Menyalakan tunnel WireGuard ${selected}...`]);
    try {
      const r = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selected })
      });
      const data = await r.json();
      setStatus(data);
      if (!r.ok) setLog(p => [...p, `GAGAL: ${data.detail ?? "unknown"}`]);
      else setLog(p => [...p, `TERHUBUNG ASLI! IP virtual ${data.virtualIp}`]);
    } catch (e: any) { setLog(p => [...p, `Error: ${e?.message}`]); }
    setLoading(false);
    loadAll();
  };

  const disconnect = async () => {
    setLoading(true);
    setStatus(await (await fetch("/api/disconnect", { method: "POST" })).json());
    setProof(null);
    setLog(p => [...p, "Tunnel dimatikan."]);
    setLoading(false);
    loadAll();
  };

  const checkProof = async () => {
    setProofLoading(true);
    try {
      const r = await fetch(`/api/proof?serverId=${selected}`);
      const data = await r.json();
      setProof(data);
      setLog(p => [...p, data.pingOk ? `BUKTI SAH: ping via tunnel OK, handshake ${data.latestHandshake}` : "Bukti: tunnel belum ada traffic / handshake."]);
    } catch (e: any) { setLog(p => [...p, `Gagal cek bukti: ${e?.message}`]); }
    setProofLoading(false);
  };

  const active = servers.find(s => s.id === status.serverId);
  const dot = !status.connected ? "#ef4444" : "#22c55e";
  const title = !status.connected ? "Putus" : `TERHUBUNG ASLI — ${active?.name}`;


  return (
    <div className="container">
      <h1>🔒 VPN WireGuard Asli</h1>
      <p><small>100% tunnel WireGuard asli di OS. Tidak ada simulasi. Bukti: <code>wg show</code> + ping lewat tunnel.</small></p>

      <div className="card">
        <div className="row">
          <span className="status-dot" style={{ background: dot }} />
          <h2 style={{ margin: 0 }}>{title}</h2>
        </div>
        {status.connected && <p>IP Virtual: <code>{status.virtualIp}</code><br />Sejak: <code>{status.connectedAt}</code><br />IP Publik: <code>{status.publicIpBefore ?? "-"}</code> → <code>{status.publicIpAfter ?? "-"}</code></p>}
        <p><small>IP publik saya: <code>{myIp ?? "..."}</code> • WireGuard: <code>{wg ? (wg.installed ? "OK " + wg.detail : "BELUM INSTALL") : "..."}</code></small></p>
        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={connect} disabled={loading || status.connected}>Connect</button>
          <button className="danger" onClick={disconnect} disabled={loading || !status.connected}>Disconnect</button>
          <button onClick={loadAll} disabled={loading}>Refresh</button>
        </div>
      </div>

      <div className="card">
        <h3>🌐 IP Publik Live (bukti IP berubah)</h3>
        <p>
          IP sekarang: <code style={{ fontSize: 16 }}>{myIp ?? "..."}</code>{" "}
          <span className="badge">{ipCloudflare ? "☁️ via Cloudflare/WARP" : "🏠 IP ISP biasa"}</span>
        </p>
        <p><small>{ipInfo ?? "Mengecek..."}<br />Tombol <b>Ganti IP</b> = minta IP baru ke WARP tanpa mematikan tunnel lokal. Tunnel WireGuard tetap TERHUBUNG.</small></p>
        <div className="row">
          <button onClick={checkIp} disabled={ipLoading}>{ipLoading ? "Mengecek..." : "Cek IP Sekarang"}</button>
          <button onClick={rotateIp} disabled={warpLoading}>{warpLoading ? "Mengganti IP..." : "🔄 Ganti IP (tanpa matikan tunnel)"}</button>
        </div>
      </div>

      <div className="card">
        <h3>Server VPN Asli</h3>
        {servers.map(s => (
          <div key={s.id} className={`server ${selected === s.id ? "active" : ""}`} onClick={() => setSelected(s.id)}>
            <div>{s.flag} <b>{s.name}</b> {s.hasRealConfig ? <span className="badge">tunnel siap ✓</span> : <span className="badge">butuh .conf</span>}<br /><small>{s.country} • {s.host}:{s.port} • {s.protocol}</small></div>
            <span className="badge">{selected === s.id ? "dipilih" : "pilih"}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>🔍 Bukti Tunnel Asli</h3>
        <p><small>Menampilkan <code>wg show</code> asli dari OS + ping lewat tunnel terenkripsi. Ini tidak bisa dipalsukan simulasi.</small></p>
        <div className="row">
          <button onClick={checkProof} disabled={proofLoading}>{proofLoading ? "Mengecek..." : "Cek Bukti Tunnel"}</button>
        </div>
        {proof && (
          <div style={{ marginTop: 12 }}>
            <p>
              Interface: <code>{proof.interfaceFound ? "ADA ✓" : "TIDAK ADA ✗"}</code> •
              Peer: <code>{proof.peerCount}</code> •
              Handshake: <code>{proof.latestHandshake ?? "-"}</code><br />
              Transfer: <code>{proof.transfer ?? "-"}</code> •
              Endpoint: <code>{proof.endpoint ?? "-"}</code><br />
              Ping via tunnel: <code>{proof.pingOk ? "OK ✓ (terenkripsi)" : "GAGAL ✗"}</code>
            </p>
            <p><small>Ping detail:</small><br /><code>{proof.pingDetail.split("\n").slice(0, 6).join(" | ")}</code></p>
            <details><summary><small>wg show mentah</small></summary><pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}><code>{proof.raw}</code></pre></details>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Log</h3>
        {log.map((l, i) => <div key={i}><code>{l}</code></div>)}
      </div>

      <div className="card">
        <h3>Tambah server VPN asli</h3>
        <p><small>
          Taruh file <code>.conf</code> WireGuard asli (dari VPS / Mullvad / ProtonVPN) ke folder <code>D:\App\vpn-nextjs\configs\NAMASERVER.conf</code>,
          lalu daftarkan servernya di <code>lib/servers.ts</code>. Tanpa file .conf, Connect akan GAGAL (tidak ada simulasi).
        </small></p>
      </div>
    </div>
  );
}
