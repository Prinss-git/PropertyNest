import { NextResponse } from "next/server";
import { z } from "zod";
import { ASSIGNABLE_ROLES, reactivateUser, setUserRole, suspendUser } from "@/lib/adminUsers";
import { handle, readJson } from "@/lib/api";
import { apiUser, STAFF_ROLES } from "@/lib/auth";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: z.string().trim().min(5, "Give a reason (staff can see it).").max(300) }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("role"), role: z.enum(ASSIGNABLE_ROLES) }),
]);

// POST /api/admin/users/:id { action: "suspend" | "reactivate" | "role" }
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await apiUser(STAFF_ROLES);
  const id = (await params).id;
  const d = schema.parse(await readJson(req));
  if (d.action === "suspend") return NextResponse.json({ ok: true, ...(await suspendUser(actor, id, d.reason)) });
  if (d.action === "reactivate") await reactivateUser(actor, id);
  else await setUserRole(actor, id, d.role);
  return NextResponse.json({ ok: true });
});
