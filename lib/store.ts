// Shared state antar API routes (connect / disconnect / status)
// HANYA untuk koneksi WireGuard asli. Tidak ada simulasi.
import fs from "fs";
import path from "path";

export type VpnState = {
  connected: boolean;
  serverId: string | null;
  connectedAt: string | null;
  virtualIp: string | null;
  mode: "SUNGGUHAN" | "PUTUS";
  publicIpBefore: string | null;
  publicIpAfter: string | null;
  detail: string | null;
};

const FILE = path.join(process.cwd(), ".vpn-state.json");

export let state: VpnState = {
  connected: false,
  serverId: null,
  connectedAt: null,
  virtualIp: null,
  mode: "PUTUS",
  publicIpBefore: null,
  publicIpAfter: null,
  detail: null,
};

try {
  if (fs.existsSync(FILE)) {
    state = { ...state, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  }
} catch {}

export function setState(patch: Partial<VpnState>) {
  Object.assign(state, patch);
  try { fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); } catch {}
  return state;
}

export function getState() { return state; }
