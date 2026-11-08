import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { requestPasswordReset } from "@/lib/emailAuth";
import { rateLimit } from "@/lib/rateLimit";
import { clientIp, hashIp } from "@/lib/request";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(120) });

// POST /api/auth/forgot { email } → emails a reset link if the account exists. Same response either way.
export const POST = handle(async (req: Request) => {
  const { email } = schema.parse(await readJson(req));
  await rateLimit(`forgot:${hashIp(clientIp(req))}`, 10, 3600e3, "Too many reset requests from your network. Please try again in an hour.");
  await requestPasswordReset(email);
  return NextResponse.json({ ok: true });
});
