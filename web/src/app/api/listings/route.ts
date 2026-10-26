import { NextResponse } from "next/server";
import { parseSearch, searchListings } from "@/lib/listings";

// GET /api/listings?mode=rent&type=condo&q=makati&page=2 — same filters as the /listings page.
export async function GET(req: Request) {
  const filters = parseSearch(new URL(req.url).searchParams);
  const result = await searchListings(filters);
  return NextResponse.json(result, {
    // Let the CDN serve repeat searches for 30s, and a stale copy for 5 min while it refreshes.
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
  });
}
