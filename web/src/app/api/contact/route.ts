import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { rateLimit } from "@/lib/rateLimit";
import { clientIp, hashIp } from "@/lib/request";
import { CONTACT_TOPICS } from "@/lib/support";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address so we can reply.").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  topic: z.enum(CONTACT_TOPICS.map(([v]) => v) as [string, ...string[]]),
  message: z.string().trim().min(10, "Tell us a bit more (at least 10 characters).").max(4000),
  listingRef: z.string().trim().max(20).optional().or(z.literal("")),
  website: z.string().max(0).optional(), // honeypot
});

// POST /api/contact → saves a support message (Moderation → Support) and emails it to SUPPORT_EMAIL.
export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  // Bots that fill the hidden field get a quiet "success".
  if (!parsed.success && parsed.error.issues[0]?.path[0] === "website") return NextResponse.json({ ok: true });
  const d = schema.parse(body);
  const ipHash = hashIp(clientIp(req));
  await rateLimit(`contact:${ipHash}`, 5, 3600e3, "You've sent several messages in the last hour. We'll reply to those first.");
  const user = await getCurrentUser();
  const topicLabel = CONTACT_TOPICS.find(([v]) => v === d.topic)![1];
  const msg = await db.$transaction(async (tx) => {
    const m = await tx.contactMessage.create({
      data: { userId: user?.id, name: d.name, email: d.email, phone: d.phone || null, topic: d.topic, message: d.message, listingRef: d.listingRef || null, ipHash },
    });
    if (process.env.SUPPORT_EMAIL) {
      await enqueue("email.send", {
        to: process.env.SUPPORT_EMAIL,
        subject: `[Support] ${topicLabel}: ${d.name}`,
        text: [
          `From: ${d.name} <${d.email}>${d.phone ? `, ${d.phone}` : ""}${user ? ` (account ${user.id})` : " (not logged in)"}`,
          `Topic: ${topicLabel}${d.listingRef ? `, listing ${d.listingRef}` : ""}`,
          "",
          d.message,
          "",
          `Reply to ${d.email}. Mark it handled under Moderation → Support.`,
        ].join("\n"),
      }, { tx });
    }
    return m;
  });
  return NextResponse.json({ ok: true, id: msg.id }, { status: 201 });
});
