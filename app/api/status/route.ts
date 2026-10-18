import { NextResponse } from "next/server";
import { syncStateWithReality } from "@/lib/real-vpn";

// Sinkronkan dulu dengan `wg show` agar status tidak basi, lalu kembalikan state.
export async function GET() {
  const state = await syncStateWithReality();
  return NextResponse.json(state);
}
