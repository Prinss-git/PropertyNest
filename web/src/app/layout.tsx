import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "PropertyNest: Buy, Rent & Lease Property in the Philippines", template: "%s | PropertyNest" },
  description: "Search houses, condos, offices, retail spaces and warehouses to buy, rent, or lease across the Philippines.",
};

// Site pages add the header and footer in (site)/layout; sign-in pages use the bare (auth)/layout.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
