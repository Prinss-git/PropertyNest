import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { resetPassword } from "@/lib/emailAuth";
import { clientIp, hashIp } from "@/lib/request";

const schema = z.object({ token: z.string().min(20).max(100), password: z.string().max(128) });

// POST /api/auth/reset { token, password } → sets the new password, signs out other devices, signs in here.
export const POST = handle(async (req: Request) => {
  const { token, password } = schema.parse(await readJson(req));
  await resetPassword(token, password, { ipHash: hashIp(clientIp(req)), userAgent: req.headers.get("user-agent") });
  return NextResponse.json({ ok: true });
});
