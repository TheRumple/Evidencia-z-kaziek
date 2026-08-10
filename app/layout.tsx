import type { Metadata } from "next";
import type { Viewport } from "next";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITspot",
  description: "Evidencia zákaziek, požiadaviek a výkazov práce",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ITspot",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/app-icon.png",
    apple: "/app-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body>
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
