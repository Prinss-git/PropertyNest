import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export const POST = handle(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
