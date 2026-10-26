import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { distanceM, publicPoint, walkMinutes } from "@/lib/geo";
import { ensureNearbyCell } from "@/lib/jobs";
import { cellKey, type NearbyPlace } from "@/lib/nearby";

const RADIUS_M = 1000;
const MAX_PER_CATEGORY = 12;

// GET /api/nearby?ref=PN-10042 → places within 1 km of the listing's public position.
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref") ?? "";
  const l = await db.listing.findUnique({
    where: { refCode: ref },
    select: { refCode: true, status: true, lat: true, lng: true, hideAddress: true },
  });
  if (!l || !["ACTIVE", "CLOSED", "EXPIRED"].includes(l.status)) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  const center = publicPoint(l);
  if (!center) return NextResponse.json({ status: "none", places: [] });

  const cell = await ensureNearbyCell(cellKey(center.lat, center.lng));
  const perCat: Record<string, number> = {};
  const places = (cell.places as NearbyPlace[])
    .map((p) => ({ ...p, distance: Math.round(distanceM(center.lat, center.lng, p.lat, p.lng)) }))
    .filter((p) => p.distance <= RADIUS_M)
    .sort((a, b) => a.distance - b.distance)
    .filter((p) => (perCat[p.cat] = (perCat[p.cat] ?? 0) + 1) <= MAX_PER_CATEGORY)
    .map((p) => ({ ...p, walk: walkMinutes(p.distance) }));

  return NextResponse.json(
    { status: cell.status, center, radius: RADIUS_M, places },
    // Ready answers can sit in the CDN for an hour; pending ones must not be cached.
    { headers: { "Cache-Control": cell.status === "ready" ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" } },
  );
}
