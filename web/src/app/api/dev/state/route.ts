import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { devToolsEnabled } from "@/lib/devTools";

export const dynamic = "force-dynamic";

const ROLE_ORDER = ["ADMIN", "MODERATOR", "AGENT", "OWNER", "SEEKER", "AGENCY_ADMIN"];

// GET /api/dev/state → accounts to switch to, who's logged in, and the latest SMS/emails (development only).
export async function GET() {
  if (!devToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [me, users, messages] = await Promise.all([
    getCurrentUser(),
    db.user.findMany({
      where: { status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true, name: true, email: true, phone: true, role: true, status: true,
        agentProfile: { select: { licenseVerifiedAt: true } },
        _count: { select: { postedListings: true } },
      },
    }),
    db.outboundMessage.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, channel: true, to: true, subject: true, body: true, createdAt: true } }),
  ]);
  users.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
  return NextResponse.json(
    {
      meId: me?.id ?? null,
      users: users.map((u) => ({
        id: u.id, name: u.name, role: u.role, status: u.status, contact: u.email ?? u.phone ?? "",
        listings: u._count.postedListings, verifiedAgent: !!u.agentProfile?.licenseVerifiedAt,
      })),
      messages,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
