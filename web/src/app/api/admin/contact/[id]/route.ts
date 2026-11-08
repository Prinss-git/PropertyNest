import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { apiUser, STAFF_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/admin/contact/:id { status } → staff mark a support message answered or closed.
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await apiUser(STAFF_ROLES);
  const { status } = z.object({ status: z.enum(["OPEN", "ANSWERED", "CLOSED"]) }).parse(await readJson(req));
  const id = (await params).id;
  await db.$transaction([
    db.contactMessage.update({ where: { id }, data: { status, handledAt: status === "OPEN" ? null : new Date() } }),
    db.auditLog.create({ data: { actorId: staff.id, action: `support.${status.toLowerCase()}`, entityType: "ContactMessage", entityId: id } }),
  ]);
  return NextResponse.json({ ok: true });
});
