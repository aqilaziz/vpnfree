import { NextResponse } from "next/server";
import { getPublicIp, reconnectWarp } from "@/lib/real-vpn";

// POST /api/warp-reconnect -> ganti IP publik via Cloudflare WARP.
// Butuh Next.js berjalan sebagai Administrator. Kalau gagal, response kasih cara manual.
export async function POST() {
  const r = await reconnectWarp();
  return NextResponse.json(
    { ...r, checkedAt: new Date().toISOString() },
    { status: r.ok ? 200 : 500 },
  );
}

export async function GET() {
  const ip = await getPublicIp();
  return NextResponse.json({
    ip,
    note: "POST ke endpoint ini untuk ganti IP via WARP",
  });
}
