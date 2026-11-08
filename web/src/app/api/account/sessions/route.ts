import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { apiUser, signOutOtherSessions } from "@/lib/auth";

// POST /api/account/sessions → signs out every other device.
export const POST = handle(async () => {
  const user = await apiUser();
  const ended = await signOutOtherSessions(user.id);
  return NextResponse.json({ ok: true, ended });
});
