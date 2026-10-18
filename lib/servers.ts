export type VpnServer = {
  id: string;
  name: string;
  country: string;
  flag: string;
  host: string;
  port: number;
  protocol: "WireGuard";
  load: number;
  pingMs: number;
};

export const SERVERS: VpnServer[] = [
  { id: "local-1", name: "WG Lokal Asli (10.9.0.2)", country: "Laptop ini — tunnel WireGuard asli", flag: "🔒", host: "127.0.0.1", port: 51821, protocol: "WireGuard", load: 5, pingMs: 1 },
];

export type VpnStatus = {
  connected: boolean;
  serverId: string | null;
  connectedAt: string | null;
  virtualIp: string | null;
};
