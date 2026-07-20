import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITspot evidencia",
  description: "Evidencia zákaziek, požiadaviek a výkazov práce",
  icons: {
    icon: "/app-icon.png",
    apple: "/app-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
