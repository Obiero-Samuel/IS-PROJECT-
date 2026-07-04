/**
 * This file handles the root app layout, fonts, metadata, and global styles.
 */
import type { Metadata } from "next";
import { Space_Grotesk, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

// Primary UI font used for headings and general text.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

// Monospace font used where code-like text appears.
const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code",
  subsets: ["latin"],
});

// Static metadata used by browser tabs and SEO previews.
export const metadata: Metadata = {
  title: "IS Project — Civic Reports & Dashboards",
  description: "Resident portal with officer, admin, and analytics dashboards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font CSS variables are attached at html level so all pages can use them.
    <html lang="en" className={`${spaceGrotesk.variable} ${sourceCodePro.variable}`}>
      {/* suppressHydrationWarning avoids noisy warnings from harmless extension DOM mutations. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
