import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount } from "@/lib/account";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";

const schema = z.object({
  confirm: z.literal("DELETE", { errorMap: () => ({ message: "Type DELETE to confirm." }) }),
  password: z.string().max(128).optional(),
});

// POST /api/account/delete { confirm: "DELETE", password? } → removes the account and signs out.
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const d = schema.parse(await readJson(req));
  await deleteAccount(user, d.password);
  return NextResponse.json({ ok: true });
});
