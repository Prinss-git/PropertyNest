import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { signUpWithEmail } from "@/lib/emailAuth";
import { clientIp, hashIp } from "@/lib/request";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(120),
  password: z.string().max(128),
  role: z.enum(["SEEKER", "OWNER", "AGENT"]),
  prcLicenseNo: z.string().trim().regex(/^[A-Za-z0-9-]{4,15}$/, "Enter your PRC license number as printed on your ID.").optional().or(z.literal("")),
});

// POST /api/auth/signup → creates an email + password account, emails a confirmation link, signs in.
export const POST = handle(async (req: Request) => {
  const d = schema.parse(await readJson(req));
  await signUpWithEmail(
    { ...d, prcLicenseNo: d.role === "AGENT" ? d.prcLicenseNo || undefined : undefined },
    { ipHash: hashIp(clientIp(req)), userAgent: req.headers.get("user-agent") },
  );
  return NextResponse.json({ ok: true }, { status: 201 });
});
