import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { requestOtp } from "@/lib/otp";
import { maskPhMobile, normalizePhMobile } from "@/lib/phone";
import { clientIp, hashIp } from "@/lib/request";

// POST /api/auth/otp { phone } → texts a sign-in code.
export const POST = handle(async (req: Request) => {
  const { phone } = z.object({ phone: z.string().max(30) }).parse(await readJson(req));
  const e164 = normalizePhMobile(phone);
  if (!e164) throw new HttpError(400, "Enter a Philippine mobile number, like 0917 123 4567.");
  const { devCode } = await requestOtp(e164, hashIp(clientIp(req)));
  return NextResponse.json({ ok: true, phone: e164, sentTo: maskPhMobile(e164), devCode });
});
