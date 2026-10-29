"use client";
import { useEffect, useState } from "react";

export default function Page() {
  const [myIp, setMyIp] = useState<string | null>(null);
  const [ipInfo, setIpInfo] = useState<string | null>(null);
  const [ipCloudflare, setIpCloudflare] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadIp = async () => {
    try {
      const ipData = await (await fetch("/api/ip")).json();
      setMyIp(ipData.ip ?? null);
      setIpInfo(ipData.detail ?? null);
      setIpCloudflare(!!ipData.isCloudflare);
    } catch {}
  };

  const checkIp = async () => {
    setLoading(true);
    try {
      await loadIp();
    } finally {
      setLoading(false);
    }
  };

  const rotateIp = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/warp-reconnect", { method: "POST" });
      const data = await r.json();
      if (data.after) {
        setMyIp(data.after);
        setIpCloudflare(
          data.after.startsWith("104.") ||
            data.after.startsWith("172.64.") ||
            data.after.startsWith("172.65."),
        );
        if (r.ok && data.changed) {
          setIpInfo(`IP baru via WARP — sebelumnya ${data.before}`);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadIp();
  }, []);

  return (
    <div className="container">
      <div className="header-bar">
        <div>
          <h1 style={{ margin: 0 }}>🔄 Ganti IP</h1>
          <p style={{ margin: "4px 0 0" }}>
            <small>
              Ganti IP publik via Cloudflare WARP. Klik tombol untuk dapat IP
              baru.
            </small>
          </p>
        </div>
      </div>

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
          <button onClick={checkIp} disabled={loading}>
            {loading ? "Mengecek..." : "Cek IP Sekarang"}
          </button>
          <button onClick={rotateIp} disabled={loading}>
            {loading ? "Mengganti IP..." : "🔄 Ganti IP"}
          </button>
        </div>
      </div>
    </div>
  );
}
