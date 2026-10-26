import { NextResponse } from "next/server";
import { publicPoint } from "@/lib/geo";
import { getListing } from "@/lib/listings";

// GET /api/listings/PN-10042 — public listing details.
export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const l = await getListing(decodeURIComponent((await params).ref));
  if (!l) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const agentProfile = l.agent?.agentProfile;
  return NextResponse.json(
    {
      ref: l.refCode,
      mode: l.mode.toLowerCase(),
      type: l.type.toLowerCase(),
      status: l.status.toLowerCase(),
      title: l.title,
      description: l.description,
      price: l.price.toNumber(),
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      floorArea: l.floorArea,
      lotArea: l.lotArea,
      parking: l.parking,
      furnishing: l.furnishing,
      terms: l.terms,
      // Approximate unless the poster chose to show the exact spot.
      location: { area: l.area?.name ?? null, city: l.city.name, province: l.city.parent?.name ?? null, point: publicPoint(l) },
      photos: l.photos.map((p) => p.storageKey),
      amenities: l.amenities.map((a) => a.amenity.name),
      agent: l.agent ? { name: l.agent.name, agency: agentProfile?.agency?.name ?? null, verified: !!agentProfile?.licenseVerifiedAt } : null,
      verified: !!l.verifiedAt,
      publishedAt: l.publishedAt,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
