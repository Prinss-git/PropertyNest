import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// The logo's "PropertyNest" lettering.
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["600"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "PropertyNest: Buy, Rent & Lease Property in the Philippines", template: "%s | PropertyNest" },
  description: "Search houses, condos, offices, retail spaces and warehouses to buy, rent, or lease across the Philippines.",
};

// Site pages add the header and footer in (site)/layout; sign-in pages use the bare (auth)/layout.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        {children}
        {/* Visitor statistics: Cloudflare Web Analytics sets no cookies and doesn't track people across sites. */}
        {process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={JSON.stringify({ token: process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN, spa: true })}
          />
        )}
      </body>
    </html>
  );
}
