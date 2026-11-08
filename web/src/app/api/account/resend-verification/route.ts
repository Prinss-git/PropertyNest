import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { resendVerification } from "@/lib/emailAuth";

// POST /api/account/resend-verification → emails a new confirmation link.
export const POST = handle(async () => {
  const user = await apiUser();
  const sentTo = await resendVerification(user.id);
  return NextResponse.json({ ok: true, sentTo });
});
