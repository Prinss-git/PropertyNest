import { NextResponse } from "next/server";
import { z } from "zod";
import { becomeAgent } from "@/lib/account";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";

const schema = z.object({ prcLicenseNo: z.string().trim().regex(/^[A-Za-z0-9-]{4,15}$/, "Enter your PRC license number as printed on your ID.") });

// POST /api/account/agent { prcLicenseNo } → switches to an agent account (license checked by a moderator).
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const { prcLicenseNo } = schema.parse(await readJson(req));
  await becomeAgent(user, prcLicenseNo);
  return NextResponse.json({ ok: true });
});
