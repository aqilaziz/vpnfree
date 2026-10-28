import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VPN Localhost - Next.js",
  description: "Aplikasi VPN dashboard dengan Next.js + server localhost"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('vpn-theme')||'system';var m=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';var r=t==='system'?m:t;document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
