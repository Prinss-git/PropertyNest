import type { NextConfig } from "next";

const https = (process.env.SITE_URL ?? "").startsWith("https://");

/** Origin of a URL template like "https://{s}.tiles.example.com/{z}/{x}/{y}.png", for the content policy. */
function originOf(template: string | undefined, fallback: string) {
  if (!template) return fallback;
  try {
    return new URL(template.replace(/\{s\}/g, "a").replace(/\{[^}]+\}/g, "0")).origin.replace("://a.", "://*.");
  } catch {
    return fallback;
  }
}

const tiles = originOf(process.env.NEXT_PUBLIC_MAP_TILE_URL, "https://tile.openstreetmap.org");
const media = process.env.MEDIA_BASE_URL ? new URL(process.env.MEDIA_BASE_URL).origin : "";

// What the browser may load. Next.js needs inline scripts and styles; everything else is our own origin,
// plus map tiles and the photo CDN. Blocks injected third-party scripts and framing by other sites.
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${tiles} ${media}`.trim(),
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location is used by "Use my current location" when posting; nothing else needs device access.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  // Once on https, browsers refuse plain http for a year (only sent on https, so local http keeps working).
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
