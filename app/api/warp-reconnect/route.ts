import { NextResponse } from "next/server";
import { getPublicIp, reconnectWarp } from "@/lib/real-vpn";

// POST /api/warp-reconnect -> restart warp-svc agar WARP dapat IP egress baru,
// TANPA mematikan tunnel WireGuard lokal (local-1 tetap jalan).
// Butuh Next.js berjalan sebagai Administrator. Kalau gagal, response kasih cara manual.
export async function POST() {
  const r = await reconnectWarp();
  return NextResponse.json({ ...r, checkedAt: new Date().toISOString() }, { status: r.ok ? 200 : 500 });
}

export async function GET() {
  const ip = await getPublicIp();
  return NextResponse.json({ ip, warpService: "warp-svc", note: "POST ke endpoint ini untuk ganti IP tanpa matikan tunnel lokal" });
}
