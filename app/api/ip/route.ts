import { NextResponse } from "next/server";
import { getPublicIp, getGeo } from "@/lib/real-vpn";

// GET /api/ip -> { ip, isCloudflare, detail, checkedAt, geo }
export async function GET() {
  const ip = await getPublicIp();
  const cfPrefixes = [
    "104.16.",
    "104.17.",
    "104.18.",
    "104.19.",
    "104.20.",
    "104.21.",
    "104.22.",
    "104.23.",
    "104.24.",
    "104.25.",
    "104.26.",
    "104.27.",
    "104.28.",
    "104.29.",
    "104.30.",
    "104.31.",
    "172.64.",
    "172.65.",
    "172.66.",
    "172.67.",
    "173.245.",
    "103.21.",
    "103.22.",
    "103.31.",
    "141.101.",
    "108.162.",
    "190.93.",
    "188.114.",
    "197.234.",
    "198.41.",
    "162.158.",
    "133.22.",
  ];
  const isCloudflare = ip ? cfPrefixes.some((p) => ip.startsWith(p)) : false;
  const geo = ip ? await getGeo(ip) : null;
  return NextResponse.json({
    ip,
    isCloudflare,
    detail: !ip
      ? "Tidak bisa cek IP (offline?)"
      : isCloudflare
        ? "IP Cloudflare — WARP kemungkinan ON"
        : "IP biasa (ISP) — WARP kemungkinan OFF / Disconnect",
    geo,
    checkedAt: new Date().toISOString(),
  });
}
