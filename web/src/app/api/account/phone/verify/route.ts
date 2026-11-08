import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmPhoneChange } from "@/lib/account";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { normalizePhMobile } from "@/lib/phone";

const schema = z.object({ phone: z.string().max(30), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });

// POST /api/account/phone/verify { phone, code } → saves the new, verified number.
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const d = schema.parse(await readJson(req));
  const phone = normalizePhMobile(d.phone);
  if (!phone) throw new HttpError(400, "Enter a Philippine mobile number.");
  await confirmPhoneChange(user, phone, d.code);
  return NextResponse.json({ ok: true });
});
