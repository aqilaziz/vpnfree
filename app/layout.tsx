import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VPN Localhost - Next.js",
  description: "Aplikasi VPN dashboard dengan Next.js + server localhost"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
