"use client";
import { useEffect, useState } from "react";

const HIST_KEY = "vpn-history";
const HIST_MAX = 5;

type GeoInfo = {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  flag: string;
  label: string;
};

type HistEntry = {
  ip: string;
  before: string | null;
  changed: boolean;
  at: number;
  geo: GeoInfo | null;
  geoBefore: GeoInfo | null;
};

function loadHist(): HistEntry[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HIST_MAX);
  } catch {
    return [];
  }
}

function fmtClock(at: number) {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return `${hh}:${mm}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtAgo(at: number, now: number) {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 5) return "baru saja";
  if (s < 60) return `${s} detik lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export default function Page() {
  const [myIp, setMyIp] = useState<string | null>(null);
  const [ipInfo, setIpInfo] = useState<string | null>(null);
  const [ipCloudflare, setIpCloudflare] = useState(false);
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  const loadIp = async () => {
    try {
      const ipData = await (await fetch("/api/ip")).json();
      setMyIp(ipData.ip ?? null);
      setIpInfo(ipData.detail ?? null);
      setIpCloudflare(!!ipData.isCloudflare);
      setGeo(ipData.geo ?? null);
    } catch {}
  };

  const checkIp = async () => {
    setLoading(true);
    try {
      const before = myIp;
      const geoBefore = geo;
      const ipData = await (await fetch("/api/ip")).json();
      const cur = ipData.ip ?? null;
      setMyIp(cur);
      setIpInfo(ipData.detail ?? null);
      setIpCloudflare(!!ipData.isCloudflare);
      setGeo(ipData.geo ?? null);
      if (cur) {
        const changed = before !== null && before !== cur;
        pushHistory({
          ip: cur,
          before,
          changed,
          at: Date.now(),
          geo: ipData.geo ?? null,
          geoBefore,
        });
      }
    } catch {}
    setLoading(false);
  };

  const pushHistory = (e: HistEntry) => {
    setHistory((prev) => {
      const next = [e, ...prev].slice(0, HIST_MAX);
      try {
        localStorage.setItem(HIST_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
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
        let changed = !!data.changed;
        if (data.before && data.after) changed = data.before !== data.after;
        if (r.ok && changed) {
          setIpInfo(`IP baru via WARP — sebelumnya ${data.before}`);
        }
        if (data.geoAfter) setGeo(data.geoAfter);
        pushHistory({
          ip: data.after,
          before: data.before ?? null,
          changed,
          at: Date.now(),
          geo: data.geoAfter ?? null,
          geoBefore: data.geoBefore ?? null,
        });
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadIp();
  }, []);

  useEffect(() => {
    setHistory(loadHist());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
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
        {geo && (
          <p>
            <small>📍 {geo.label}</small>
          </p>
        )}
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

      <div className="card">
        <h3>
          📜 Riwayat ({history.length}/{HIST_MAX})
        </h3>
        {history.length === 0 ? (
          <p>
            <small>
              Belum ada riwayat. Klik "🔄 Ganti IP" untuk mulai mencatat.
            </small>
          </p>
        ) : (
          <div className="hist-list">
            {history.map((h) => (
              <div key={h.at} className="hist-item">
                <div className="row">
                  <span
                    className={`badge hist-badge ${h.changed ? "ganti" : "sama"}`}
                  >
                    {h.changed ? "🔄 Ganti" : "⚪ Sama"}
                  </span>
                  <small title={fmtClock(h.at)}>{fmtAgo(h.at, now)}</small>
                </div>
                <div className="hist-table">
                  <div className="hist-row hist-head">
                    <span>Sebelum</span>
                    <span>Sesudah</span>
                  </div>
                  <div className="hist-row">
                    <span>{h.before ?? "—"}</span>
                    <span>{h.ip}</span>
                  </div>
                  <div className="hist-row hist-loc">
                    <span>{h.geoBefore?.label ?? "—"}</span>
                    <span>{h.geo?.label ?? "—"}</span>
                  </div>
                </div>
                <small className="hist-clock">{fmtClock(h.at)}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
