import { NextResponse } from "next/server";
import { rotateTorIp, torStatus } from "@/lib/tor";

// POST /api/tor-rotate -> sinyal NEWNYM: Tor memilih exit node baru = IP publik baru.
// GET  /api/tor-status -> info Tor (running, versi, egress IP saat ini).
export async function POST() {
  const r = await rotateTorIp();
  return NextResponse.json(
    { ...r, checkedAt: new Date().toISOString() },
    { status: r.ok ? 200 : 500 },
  );
}

export async function GET() {
  const s = await torStatus();
  return NextResponse.json(s);
}
