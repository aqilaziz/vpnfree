import { NextResponse } from "next/server";
import { getState } from "@/lib/store";
import { proofTunnel } from "@/lib/real-vpn";

// GET /api/proof?serverId=local-1 -> bukti tunnel asli live
export async function GET(req: Request) {
  const url = new URL(req.url);
  const serverId = url.searchParams.get("serverId") || getState().serverId || "local-1";
  const proof = await proofTunnel(serverId);
  return NextResponse.json({ serverId, ...proof });
}