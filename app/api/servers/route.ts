import { NextResponse } from "next/server";
import { SERVERS } from "@/lib/servers";
import { hasConfig, checkWireGuard } from "@/lib/real-vpn";

export async function GET() {
  const wg = await checkWireGuard();
  return NextResponse.json({
    wireguard: wg,
    servers: SERVERS.map((s) => ({ ...s, hasRealConfig: hasConfig(s.id) })),
  });
}
