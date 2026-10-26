import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { clientIp, hashIp } from "@/lib/request";

const inquirySchema = z.object({
  listingRef: z.string().min(1).max(20),
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email address.").max(120),
  phone: z.string().trim().max(20).regex(/^[+\d\s()-]*$/, "Use digits only for the mobile number.").optional().or(z.literal("")),
  company: z.string().trim().max(120).optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Write a short message (at least 10 characters).").max(2000),
  website: z.string().max(0).optional(), // honeypot must stay empty
});

// Until Redis arrives (Phase 3) limits are counted in Postgres, which is fine at launch volumes.
const PER_IP_PER_HOUR = 10;
const PER_IP_PER_LISTING_PER_DAY = 3;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Bots that fill the honeypot get a fake success so they don't adapt.
    if (issue?.path[0] === "website") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: issue?.message ?? "Check the form and try again." }, { status: 400 });
  }
  const d = parsed.data;

  const listing = await db.listing.findUnique({ where: { refCode: d.listingRef }, select: { id: true, status: true } });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "This listing is no longer accepting inquiries." }, { status: 404 });
  }

  const ipHash = hashIp(clientIp(req));
  const now = Date.now();
  const [lastHour, sameListing] = await Promise.all([
    db.inquiry.count({ where: { ipHash, createdAt: { gte: new Date(now - 3600e3) } } }),
    db.inquiry.count({ where: { ipHash, listingId: listing.id, createdAt: { gte: new Date(now - 864e5) } } }),
  ]);
  if (lastHour >= PER_IP_PER_HOUR || sameListing >= PER_IP_PER_LISTING_PER_DAY) {
    return NextResponse.json({ error: "You've sent several inquiries recently. Please wait a while before sending more." }, { status: 429 });
  }

  const sender = await getCurrentUser();
  const inquiry = await db.$transaction(async (tx) => {
    const created = await tx.inquiry.create({
      data: {
        listingId: listing.id,
        senderId: sender?.id,
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        company: d.company || null,
        preferredDate: d.preferredDate ? new Date(d.preferredDate + "T00:00:00+08:00") : null,
        message: d.message,
        ipHash,
      },
      select: { id: true },
    });
    await tx.listing.update({ where: { id: listing.id }, data: { inquiryCount: { increment: 1 } } });
    // Agent alerts go through the queue: the visitor gets an instant response even if SMS is slow.
    await enqueue("inquiry.notify", { inquiryId: created.id }, { tx });
    return created;
  });

  return NextResponse.json({ ok: true, id: inquiry.id }, { status: 201 });
}
