import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Pages stay cacheable for everyone; the header asks this endpoint who's signed in.
export async function GET() {
  const u = await getCurrentUser();
  return NextResponse.json(
    u ? { user: { name: u.name, role: u.role, phone: u.phone } } : { user: null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
