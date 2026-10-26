import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { getCurrentUser, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  listingRef: z.string().min(1).max(20),
  reason: z.enum(["FAKE_LISTING", "DUPLICATE", "WRONG_PRICE", "ALREADY_SOLD_OR_RENTED", "SCAM", "OFFENSIVE", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
});

/** Listings with this many open reports are hidden until a moderator looks. */
const AUTO_HIDE_AT = 3;

// POST /api/reports → flag a listing for moderators. Signed-in users only, so reports can't be mass-faked.
export const POST = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sign in to report a listing.");
  const d = schema.parse(await readJson(req));
  const listing = await db.listing.findUnique({ where: { refCode: d.listingRef }, select: { id: true, status: true, posterId: true } });
  if (!listing) throw new HttpError(404, "Listing not found.");
  if (listing.posterId === user.id) throw new HttpError(400, "You can't report your own listing.");

  const dup = await db.report.findFirst({ where: { listingId: listing.id, reporterId: user.id, status: "OPEN" }, select: { id: true } });
  if (dup) return NextResponse.json({ ok: true, alreadyReported: true });

  await db.report.create({ data: { listingId: listing.id, reporterId: user.id, reason: d.reason, details: d.details || null } });
  const open = await db.report.count({ where: { listingId: listing.id, status: "OPEN" } });
  if (open >= AUTO_HIDE_AT && listing.status === "ACTIVE") {
    await db.listing.update({ where: { id: listing.id }, data: { status: "PENDING", moderationFlags: [{ code: "reported", message: `${open} open reports from users.` }] } });
    revalidatePath(`/property/${d.listingRef}`);
    revalidateTag("listings");
  }
  return NextResponse.json({ ok: true }, { status: 201 });
});
