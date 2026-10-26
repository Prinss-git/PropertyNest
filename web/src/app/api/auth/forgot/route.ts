import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { requestPasswordReset } from "@/lib/emailAuth";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(120) });

// POST /api/auth/forgot { email } → emails a reset link if the account exists. Same response either way.
export const POST = handle(async (req: Request) => {
  const { email } = schema.parse(await readJson(req));
  await requestPasswordReset(email);
  return NextResponse.json({ ok: true });
});
