import { NextResponse } from "next/server";
import { z } from "zod";
import { updateProfile } from "@/lib/account";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(120).nullable().optional().or(z.literal("")),
});

// PATCH /api/account/profile { name?, email? }
export const PATCH = handle(async (req: Request) => {
  const user = await apiUser();
  const d = schema.parse(await readJson(req));
  const result = await updateProfile(user, { name: d.name, email: d.email === undefined ? undefined : d.email || null });
  return NextResponse.json({ ok: true, ...result });
});
