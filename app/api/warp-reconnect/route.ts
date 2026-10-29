import { NextResponse } from "next/server";
import { getPublicIp, getGeo, reconnectWarp } from "@/lib/real-vpn";

// POST /api/warp-reconnect -> ganti IP publik via Cloudflare WARP.
export async function POST() {
  const r = await reconnectWarp();
  const geoBefore = r.before ? await getGeo(r.before) : null;
  const geoAfter = r.after ? await getGeo(r.after) : null;
  return NextResponse.json(
    { ...r, geoBefore, geoAfter, checkedAt: new Date().toISOString() },
    { status: r.ok ? 200 : 500 },
  );
}

export async function GET() {
  const ip = await getPublicIp();
  const geo = ip ? await getGeo(ip) : null;
  return NextResponse.json({
    ip,
    geo,
    note: "POST ke endpoint ini untuk ganti IP via WARP",
  });
}
