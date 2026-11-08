import { NextResponse } from "next/server";
import { z } from "zod";
import { setPassword } from "@/lib/account";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";

const schema = z.object({ currentPassword: z.string().max(128).optional(), newPassword: z.string().max(128) });

// POST /api/account/password { currentPassword?, newPassword }
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const d = schema.parse(await readJson(req));
  await setPassword(user, d.currentPassword, d.newPassword);
  return NextResponse.json({ ok: true });
});
