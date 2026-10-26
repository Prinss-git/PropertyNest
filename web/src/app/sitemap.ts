import type { MetadataRoute } from "next";
import { MODE_KEYS, MODE_TYPES } from "@/lib/catalog";
import { db } from "@/lib/db";

export const revalidate = 3600;

// One sitemap is fine up to 50,000 URLs; split with generateSitemaps() past that.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const listings = await db.listing.findMany({
    where: { status: "ACTIVE" },
    select: { refCode: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 45000,
  });
  const searchPages = MODE_KEYS.flatMap((m) => [
    { url: `${base}/listings?mode=${m}`, changeFrequency: "hourly" as const },
    ...MODE_TYPES[m].map((t) => ({ url: `${base}/listings?mode=${m}&type=${t}`, changeFrequency: "daily" as const })),
  ]);
  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    ...searchPages,
    ...listings.map((l) => ({ url: `${base}/property/${l.refCode}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const })),
  ];
}
