import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError, STAFF_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { EXPIRY_DAYS } from "@/lib/moderation";

const schema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({ decision: z.literal("reject"), reason: z.string().trim().min(5, "Tell the poster what to fix.").max(500) }),
  z.object({ decision: z.literal("takedown"), reason: z.string().trim().min(5, "Give a reason for the takedown.").max(500) }),
]);

// POST /api/admin/listings/:ref { decision } → moderator approves, rejects (poster can fix + resubmit), or takes down.
export const POST = handle(async (req: Request, { params }: { params: Promise<{ ref: string }> }) => {
  const mod = await apiUser(STAFF_ROLES);
  const d = schema.parse(await readJson(req));
  const ref = (await params).ref;
  const l = await db.listing.findUnique({ where: { refCode: ref }, select: { id: true, mode: true, publishedAt: true, status: true } });
  if (!l) throw new HttpError(404, "Listing not found.");

  const now = new Date();
  const data =
    d.decision === "approve"
      ? {
          status: "ACTIVE" as const,
          reviewedAt: now,
          rejectionReason: null,
          moderationFlags: [],
          publishedAt: l.publishedAt ?? now,
          expiresAt: new Date(now.getTime() + EXPIRY_DAYS[l.mode.toLowerCase() as "buy"] * 864e5),
        }
      : { status: d.decision === "reject" ? ("REJECTED" as const) : ("ARCHIVED" as const), reviewedAt: now, rejectionReason: d.reason };

  await db.$transaction(async (tx) => {
    await tx.listing.update({ where: { id: l.id }, data });
    // Reports on this listing are resolved by the decision.
    await tx.report.updateMany({
      where: { listingId: l.id, status: "OPEN" },
      data: { status: d.decision === "approve" ? "DISMISSED" : "ACTION_TAKEN", handledById: mod.id, resolvedAt: now },
    });
    await tx.auditLog.create({
      data: { actorId: mod.id, action: `listing.${d.decision}`, entityType: "Listing", entityId: l.id, data: "reason" in d ? { reason: d.reason } : undefined },
    });
    await enqueue("listing.reviewed", { listingId: l.id }, { tx });
  });

  revalidatePath(`/property/${ref}`);
  revalidatePath("/");
  revalidateTag("listings");
  return NextResponse.json({ ok: true });
});
