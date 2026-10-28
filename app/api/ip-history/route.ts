import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Riwayat ganti IP / cek IP. Tersimpan di file agar tahan refresh & restart.
// Setiap entri: waktu (ISO), IP sebelum, IP sesudah, berubah atau tidak.

export type IpHistoryEntry = {
  time: string; // ISO (tampil sebagai HH:MM:SS di UI)
  before: string | null;
  after: string | null;
  changed: boolean;
  source: "cek" | "ganti"; // "cek" = Cek IP Sekarang, "ganti" = Ganti IP WARP
};

const FILE = path.join(process.cwd(), ".vpn-ip-history.json");
const MAX = 300;

function read(): IpHistoryEntry[] {
  try {
    if (fs.existsSync(FILE)) {
      const arr = JSON.parse(fs.readFileSync(FILE, "utf8"));
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

function write(list: IpHistoryEntry[]) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
  } catch {}
}

export async function GET() {
  return NextResponse.json({ history: read() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const before = body?.before ?? null;
  const after = body?.after ?? null;
  const changed = !!before && !!after && before !== after;

  const entry: IpHistoryEntry = {
    time: new Date().toISOString(),
    before,
    after,
    changed,
    source: body?.source === "ganti" ? "ganti" : "cek",
  };

  const list = read();
  list.push(entry);
  if (list.length > MAX) list.splice(0, list.length - MAX);
  write(list);

  return NextResponse.json({ ok: true, entry, history: list });
}
