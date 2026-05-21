import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Pic - Templates photobooth",
  description: "Choix et personnalisation de templates photobooth Event Pic.",
  applicationName: "Event Pic",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "32x32 48x48", type: "image/x-icon" },
      { url: "/favicon-32x32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png?v=3", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png?v=3", sizes: "512x512", type: "image/png" }
    ],
    shortcut: [{ url: "/favicon.ico?v=3" }],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "Event Pic",
    statusBarStyle: "black-translucent"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
