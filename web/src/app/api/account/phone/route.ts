import { NextResponse } from "next/server";
import { z } from "zod";
import { startPhoneChange } from "@/lib/account";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { maskPhMobile, normalizePhMobile } from "@/lib/phone";
import { clientIp, hashIp } from "@/lib/request";

// POST /api/account/phone { phone } → texts a code to the new number.
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const { phone } = z.object({ phone: z.string().max(30) }).parse(await readJson(req));
  const e164 = normalizePhMobile(phone);
  if (!e164) throw new HttpError(400, "Enter a Philippine mobile number, like 0917 123 4567.");
  if (e164 === user.phone) throw new HttpError(400, "That's already your number.");
  const { devCode } = await startPhoneChange(user, e164, hashIp(clientIp(req)));
  return NextResponse.json({ ok: true, phone: e164, sentTo: maskPhMobile(e164), devCode });
});
