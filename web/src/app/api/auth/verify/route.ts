import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { createSession, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOtp, consumeOtp } from "@/lib/otp";
import { normalizePhMobile } from "@/lib/phone";
import { clientIp, hashIp } from "@/lib/request";

const schema = z.object({
  phone: z.string().max(30),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  // Only needed the first time a number signs in.
  name: z.string().trim().min(2, "Enter your full name.").max(80).optional(),
  email: z.string().trim().email("Enter a valid email address.").max(120).optional().or(z.literal("")),
  role: z.enum(["SEEKER", "OWNER", "AGENT"]).optional(),
  prcLicenseNo: z.string().trim().regex(/^[A-Za-z0-9-]{4,15}$/, "Enter your PRC license number as printed on your ID.").optional().or(z.literal("")),
});

// POST /api/auth/verify → signs in (or creates the account), sets the session cookie.
export const POST = handle(async (req: Request) => {
  const d = schema.parse(await readJson(req));
  const phone = normalizePhMobile(d.phone);
  if (!phone) throw new HttpError(400, "Enter a Philippine mobile number.");
  const otpId = await checkOtp(phone, d.code);

  let user = await db.user.findUnique({ where: { phone }, select: { id: true, status: true } });
  if (user && user.status !== "ACTIVE") throw new HttpError(403, "This account is suspended. Contact support.");

  if (!user) {
    // New number: the code is right, but we need a name before creating the account.
    if (!d.name) return NextResponse.json({ needsProfile: true });
    const role = d.role ?? "SEEKER";
    if (role === "AGENT" && !d.prcLicenseNo) throw new HttpError(400, "Agents need a PRC license number. Choose Owner if you're listing your own property.");
    try {
      user = await db.user.create({
        data: {
          phone,
          name: d.name,
          email: d.email || null,
          role,
          phoneVerifiedAt: new Date(),
          agentProfile: role === "AGENT" ? { create: { prcLicenseNo: d.prcLicenseNo!.toUpperCase(), publicPhone: phone } } : undefined,
        },
        select: { id: true, status: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const field = String(e.meta?.target ?? "");
        throw new HttpError(409, field.includes("email") ? "That email is already used by another account." : "That PRC license number is already registered.");
      }
      throw e;
    }
    await db.auditLog.create({ data: { actorId: user.id, action: "user.signup", entityType: "User", entityId: user.id, data: { role } } });
  }

  await consumeOtp(otpId);
  await createSession(user.id, { userAgent: req.headers.get("user-agent"), ipHash: hashIp(clientIp(req)) });
  return NextResponse.json({ ok: true });
});
