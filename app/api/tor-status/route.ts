import { NextResponse } from "next/server";
import { torStatus } from "@/lib/tor";

// GET /api/tor-status -> info Tor (running, versi, egress IP saat ini).
export async function GET() {
  const s = await torStatus();
  return NextResponse.json(s);
}
