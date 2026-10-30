import { NextResponse } from "next/server";
import { getPublicIp, getGeo, getCfTrace } from "@/lib/real-vpn";

// GET /api/ip -> { ip, isCloudflare, detail, checkedAt, geo }
export async function GET() {
  const ip = await getPublicIp();
  // Deteksi WARP langsung dari endpoint trace Cloudflare — lebih akurat
  // daripada menebak dari rentang IP (cf-Pes). WARP yang ON akan
  // melaporkan `warp=on` di cdn-cgi/trace.
  const trace = await getCfTrace();
  const isCloudflare = trace.warp === "on";
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
