import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { logInWithEmail } from "@/lib/emailAuth";
import { clientIp, hashIp } from "@/lib/request";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(120),
  password: z.string().min(1, "Enter your password.").max(128),
});

// POST /api/auth/login { email, password }
export const POST = handle(async (req: Request) => {
  const { email, password } = schema.parse(await readJson(req));
  await logInWithEmail(email, password, { ipHash: hashIp(clientIp(req)), userAgent: req.headers.get("user-agent") });
  return NextResponse.json({ ok: true });
});
