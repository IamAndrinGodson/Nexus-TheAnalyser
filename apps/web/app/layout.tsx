// app/layout.tsx — Root layout with SessionProvider
import type { Metadata } from "next";
import "./globals.css";
import CyberCursor from "@/components/ui/CyberCursor";

export const metadata: Metadata = {
  title: "NEXUS TLS — Secure Session Management",
  description:
    "Domain-specific secure session management system for digital transactions and logistics platforms",
  keywords: ["session management", "security", "biometrics", "logistics"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <CyberCursor />
        {children}
      </body>
    </html>
  );
}
