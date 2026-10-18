import { NextResponse } from "next/server";
import { getState, setState } from "@/lib/store";
import { disconnectReal } from "@/lib/real-vpn";

export async function POST() {
  const s = getState();
  const d = await disconnectReal(s.serverId);
  return NextResponse.json(setState({
    connected: false, serverId: null, connectedAt: null, virtualIp: null,
    mode: "PUTUS", detail: "Tunnel dimatikan: " + d.detail,
  }));
}
