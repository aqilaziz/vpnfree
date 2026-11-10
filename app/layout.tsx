import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "vpnfree",
  description: "Ganti IP publik via Cloudflare WARP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
