import { NextResponse } from "next/server";
import { SERVERS } from "@/lib/servers";
import { getState, setState } from "@/lib/store";
import { connectReal, getPublicIp } from "@/lib/real-vpn";

// HANYA koneksi ASLI. Tidak ada lagi mode simulasi / otomatis.
// POST { serverId } -> wajib ada configs/<id>.conf + WireGuard terinstall.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sid = String(body.serverId ?? "").trim();
  const server = SERVERS.find((s) => s.id === sid);
  if (!server) {
    return NextResponse.json({ error: `server '${sid}' tidak ditemukan`, validIds: SERVERS.map(s => s.id) }, { status: 404 });
  }

  const before = await getPublicIp();
  const real = await connectReal(server.id);
  const after = await getPublicIp();

  if (!real.ok) {
    setState({
      connected: false, serverId: null, connectedAt: null, virtualIp: null,
      mode: "PUTUS", publicIpBefore: before, publicIpAfter: after,
      detail: "GAGAL: " + real.detail,
    });
    return NextResponse.json(getState(), { status: 500 });
  }

  return NextResponse.json(setState({
    connected: true,
    serverId: server.id,
    connectedAt: new Date().toISOString(),
    virtualIp: real.virtualIp ?? "lihat wg show",
    mode: "SUNGGUHAN",
    publicIpBefore: before,
    publicIpAfter: after,
    detail: real.detail,
  }));
}

export async function GET() {
  return NextResponse.json(getState());
}


