"use client";
import { useEffect, useRef, useState } from "react";

type IpHistoryEntry = {
  time: string;
  before: string | null;
  after: string | null;
  changed: boolean;
  source: "cek" | "ganti";
};

export default function Page() {
  const [myIp, setMyIp] = useState<string | null>(null);
  const [ipInfo, setIpInfo] = useState<string | null>(null);
  const [ipCloudflare, setIpCloudflare] = useState(false);
  const [ipLoading, setIpLoading] = useState(false);
  const [warpLoading, setWarpLoading] = useState(false);
  const [history, setHistory] = useState<IpHistoryEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const lastIpRef = useRef<string | null>(null);

  // Tick tiap detik agar "x detik/menit lalu" live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  const fmtAgo = (iso: string) => {
    const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
    if (diff < 60) return `${diff} detik lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) {
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      return m ? `${h} jam ${m} menit lalu` : `${h} jam lalu`;
    }
    const d = Math.floor(diff / 86400);
    return `${d} hari lalu`;
  };

  const recordHistory = async (
    before: string | null,
    after: string | null,
    source: "cek" | "ganti",
  ) => {
    try {
      const res = await fetch("/api/ip-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before, after, source }),
      });
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch {}
  };

  const loadAll = async () => {
    try {
      const ipData = await (await fetch("/api/ip")).json();
      setMyIp(ipData.ip ?? null);
      lastIpRef.current = ipData.ip ?? null;
      setIpInfo(ipData.detail ?? null);
      setIpCloudflare(!!ipData.isCloudflare);
    } catch {}
    try {
      const h = await (await fetch("/api/ip-history")).json();
      if (h.history) setHistory(h.history);
    } catch {}
  };

  const checkIp = async () => {
    setIpLoading(true);
    const before = lastIpRef.current;
    try {
      const ipData = await (await fetch("/api/ip")).json();
      const after = ipData.ip ?? null;
      lastIpRef.current = after;
      setMyIp(after);
      setIpInfo(ipData.detail ?? null);
      setIpCloudflare(!!ipData.isCloudflare);
      if (after) recordHistory(before, after, "cek");
    } catch {}
    setIpLoading(false);
  };

  const rotateIp = async () => {
    setWarpLoading(true);
    try {
      const r = await fetch("/api/warp-reconnect", { method: "POST" });
      const data = await r.json();
      if (data.after) {
        setMyIp(data.after);
        lastIpRef.current = data.after;
        setIpCloudflare(
          data.after.startsWith("104.") ||
            data.after.startsWith("172.64.") ||
            data.after.startsWith("172.65."),
        );
        recordHistory(data.before ?? lastIpRef.current, data.after, "ganti");
        if (r.ok && data.changed) {
          setIpInfo(`IP baru via WARP — sebelumnya ${data.before}`);
        }
      }
    } catch {}
    setWarpLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="container">
      <h1>🔄 Ganti IP</h1>
      <p>
        <small>Ganti IP publik via Cloudflare WARP. Klik tombol untuk dapat IP baru.</small>
      </p>

      <div className="layout">
        <div className="main">
          <div className="card">
            <h3>🌐 IP Publik</h3>
            <p>
              IP sekarang: <code style={{ fontSize: 18 }}>{myIp ?? "..."}</code>{" "}
              <span className="badge">
                {ipCloudflare ? "☁️ via Cloudflare/WARP" : "🏠 IP ISP biasa"}
              </span>
            </p>
            <p>
              <small>{ipInfo ?? "Mengecek..."}</small>
            </p>
            <div className="row">
              <button onClick={checkIp} disabled={ipLoading}>
                {ipLoading ? "Mengecek..." : "Cek IP Sekarang"}
              </button>
              <button onClick={rotateIp} disabled={warpLoading}>
                {warpLoading ? "Mengganti IP..." : "🔄 Ganti IP"}
              </button>
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <div className="card sidebar-card">
            <h3>📜 Riwayat Ganti IP</h3>
            <p>
              <small>jam:menit:detik • sebelum → sesudah • berubah/tidak</small>
            </p>
            {history.length === 0 ? (
              <p>
                <small>
                  Belum ada riwayat. Klik <b>Cek IP</b> / <b>Ganti IP</b> untuk mulai mencatat.
                </small>
              </p>
            ) : (
              <div className="hist-list">
                {[...history].reverse().map((h, i) => (
                  <div key={i} className="hist-item">
                    <div className="hist-head">
                      <div>
                        <code className="hist-time">{fmtTime(h.time)}</code>
                        <small className="hist-ago"> · {fmtAgo(h.time)}</small>
                      </div>
                      {h.changed ? (
                        <span className="badge hist-ok">✓ Berubah</span>
                      ) : (
                        <span className="badge hist-no">✗ Sama</span>
                      )}
                    </div>
                    <div className="hist-cols">
                      <div className="hist-col">
                        <small>Sebelum</small>
                        <code className="hist-ip">{h.before ?? "-"}</code>
                      </div>
                      <span className="hist-arrow">→</span>
                      <div className="hist-col">
                        <small>Sesudah</small>
                        <code className="hist-ip">{h.after ?? "-"}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
